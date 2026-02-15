import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BBContextService } from "../shared/bb-context.service";
import type { Principal } from "../../auth/access-policy.service";
import type {
  IssueBloodDto, BedsideVerifyDto, StartTransfusionDto,
  RecordVitalsDto, EndTransfusionDto, ReportReactionDto,
  ReturnUnitDto, ActivateMTPDto,
} from "./dto";

@Injectable()
export class IssueService {
  constructor(private readonly ctx: BBContextService) {}

  /**
   * Mandatory TTI tests for release / issue.
   * Note: stored as string in DB, so we normalize case when validating.
   */
  private static readonly REQUIRED_TTI = ["HIV", "HBsAg", "HCV", "Syphilis", "Malaria"] as const;

  private actorStaffId(principal: Principal): string {
    const p: any = principal as any;
    return String(p?.staffId ?? p?.userId ?? "SYSTEM");
  }

  private isABOCompatible(patient: string | null, unit: string | null): boolean {
    if (!patient || !unit) return false;
    const map: Record<string, string[]> = {
      O_NEG: ["O_NEG"],
      O_POS: ["O_NEG", "O_POS"],
      A_NEG: ["O_NEG", "A_NEG"],
      A_POS: ["O_NEG", "O_POS", "A_NEG", "A_POS"],
      B_NEG: ["O_NEG", "B_NEG"],
      B_POS: ["O_NEG", "O_POS", "B_NEG", "B_POS"],
      AB_NEG: ["O_NEG", "A_NEG", "B_NEG", "AB_NEG"],
      AB_POS: ["O_NEG", "O_POS", "A_NEG", "A_POS", "B_NEG", "B_POS", "AB_NEG", "AB_POS"],
    };
    return (map[patient] ?? []).includes(unit);
  }

  private normalizeTestName(name: string): string {
    return String(name ?? "").trim().toLowerCase();
  }

  private async assertSafetyGatesForIssue(principal: Principal, crossMatchId: string) {
    const crossMatch = await this.ctx.prisma.crossMatchTest.findUnique({
      where: { id: crossMatchId },
      include: {
        request: { select: { id: true, branchId: true, status: true, patientId: true } },
        bloodUnit: {
          include: {
            groupingResults: { orderBy: { createdAt: "desc" }, take: 1 },
            ttiTests: { orderBy: { createdAt: "desc" } },
            inventorySlot: { include: { equipment: true } },
          },
        },
      },
    });
    if (!crossMatch) throw new NotFoundException("Cross-match not found");

    const bid = this.ctx.resolveBranchId(principal, crossMatch.request.branchId);

    // --- Gate 1: Cross-match must be valid and compatible ---
    if (crossMatch.result !== "COMPATIBLE") {
      throw new BadRequestException("Cross-match result is not compatible");
    }
    if (crossMatch.validUntil && crossMatch.validUntil.getTime() < Date.now()) {
      throw new BadRequestException("Cross-match has expired. Re-cross-match required.");
    }
    // Backstop (older records may not have validUntil)
    const hoursElapsed = (Date.now() - crossMatch.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 72) {
      throw new BadRequestException("Cross-match has expired (>72 hours). Re-cross-match required.");
    }

    // --- Gate 2: Request lifecycle must be READY ---
    if (crossMatch.request.status !== "READY") {
      throw new BadRequestException(`Request is not READY for issue (current: ${crossMatch.request.status}).`);
    }

    const unit = crossMatch.bloodUnit;
    if (!unit) throw new BadRequestException("Blood unit is missing for this cross-match");

    // --- Gate 3: Unit state must be eligible ---
    if (!unit.isActive) throw new BadRequestException("Blood unit is inactive");
    if (unit.status !== "CROSS_MATCHED") {
      throw new BadRequestException(`Unit status ${unit.status} is not eligible for issue. Unit must be CROSS_MATCHED.`);
    }
    if (unit.expiryDate && unit.expiryDate.getTime() < Date.now()) {
      throw new BadRequestException("Unit has expired and cannot be issued");
    }

    // --- Gate 4: Grouping must be verified and discrepancy-free ---
    const latestGrouping = unit.groupingResults?.[0];
    if (!latestGrouping?.verifiedByStaffId) {
      throw new BadRequestException("Unit grouping is not verified");
    }
    if (latestGrouping.hasDiscrepancy) {
      throw new BadRequestException("Unit grouping has a discrepancy. Resolve discrepancy before issue.");
    }
    if (!unit.bloodGroup) {
      throw new BadRequestException("Unit blood group is not confirmed");
    }

    // --- Gate 5: TTI tests must be NON_REACTIVE and verified ---
    const latestByName = new Map<string, any>();
    for (const t of unit.ttiTests ?? []) {
      const k = this.normalizeTestName(t.testName);
      if (!latestByName.has(k)) latestByName.set(k, t);
    }

    const missing = IssueService.REQUIRED_TTI.filter((n) => !latestByName.has(this.normalizeTestName(n)));
    if (missing.length) {
      throw new BadRequestException(`Missing mandatory TTI test(s): ${missing.join(", ")}`);
    }

    const bad: string[] = [];
    for (const req of IssueService.REQUIRED_TTI) {
      const t = latestByName.get(this.normalizeTestName(req));
      const res = String(t?.result ?? "PENDING");
      if (!t?.verifiedByStaffId) bad.push(`${req}: NOT_VERIFIED`);
      else if (res === "PENDING") bad.push(`${req}: PENDING`);
      else if (res === "INDETERMINATE") bad.push(`${req}: INDETERMINATE`);
      else if (res === "REACTIVE") bad.push(`${req}: REACTIVE`);
    }
    if (bad.length) {
      // Defensive: quarantine if any reactive test is present
      const anyReactive = bad.some((x) => x.includes("REACTIVE"));
      if (anyReactive) {
        await this.ctx.prisma.bloodUnit.update({ where: { id: unit.id }, data: { status: "QUARANTINED" } });
      }
      throw new BadRequestException(`TTI safety gate failed: ${bad.join("; ")}`);
    }

    // --- Gate 6: Cold-chain & equipment compliance ---
    const slot = unit.inventorySlot;
    if (!slot?.equipment) {
      throw new BadRequestException("Unit has no assigned storage equipment. Assign storage location before issue.");
    }
    const eq = slot.equipment;
    if (!eq.isActive) throw new BadRequestException("Storage equipment is inactive");
    if (eq.calibrationDueDate && eq.calibrationDueDate.getTime() < Date.now()) {
      throw new BadRequestException(
        `Storage equipment calibration is overdue (equipment: ${eq.equipmentId}). Calibrate before issuing units stored here.`,
      );
    }

    const breach = await this.ctx.prisma.equipmentTempLog.findFirst({
      where: {
        equipmentId: eq.id,
        isBreaching: true,
        acknowledged: false,
      },
      orderBy: { recordedAt: "desc" },
      select: { id: true, recordedAt: true, temperatureC: true },
    });
    if (breach) {
      throw new BadRequestException(
        `Temperature breach pending acknowledgement for equipment ${eq.equipmentId}. ` +
          `Breach log ${breach.id} at ${breach.recordedAt.toISOString()} (temp: ${String(breach.temperatureC)}°C).`,
      );
    }

    return { bid, crossMatch, unit, equipment: eq };
  }

  private buildVitals(dto: any, principal: Principal) {
    const base = dto?.vitals && typeof dto.vitals === "object" ? { ...dto.vitals } : {};
    const direct = {
      temperature: dto?.temperature,
      pulseRate: dto?.pulseRate,
      bloodPressure: dto?.bloodPressure,
      respiratoryRate: dto?.respiratoryRate,
      notes: dto?.notes,
    };
    const merged: any = { ...base };
    for (const [k, v] of Object.entries(direct)) {
      if (v !== undefined && v !== null && v !== "") merged[k] = v;
    }
    merged.recordedAt = new Date();
    merged.recordedBy = this.actorStaffId(principal);
    return merged;
  }

  private appendVitals(existing: any, entry: any) {
    if (!existing) return entry;
    if (Array.isArray(existing)) return [...existing, entry];
    return [existing, entry];
  }

  async listIssues(
    principal: Principal,
    opts: {
      branchId?: string | null;
      transfusing?: boolean;
      transfusedToday?: boolean;
    },
  ) {
    const bid = this.ctx.resolveBranchId(principal, opts.branchId);

    const issues = await this.ctx.prisma.bloodIssue.findMany({
      where: { branchId: bid },
      include: {
        bloodUnit: {
          select: {
            id: true,
            unitNumber: true,
            bloodGroup: true,
            componentType: true,
            status: true,
          },
        },
        request: {
          select: {
            id: true,
            patient: {
              select: {
                name: true,
                uhid: true,
              },
            },
          },
        },
        crossMatch: {
          select: {
            id: true,
            certificateNumber: true,
          },
        },
        transfusionRecord: {
          select: {
            startedAt: true,
            endedAt: true,
            hasReaction: true,
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });

    let rows = issues.map((issue) => {
      const patientName = (issue.request?.patient?.name ?? "").trim();
      const [firstName, ...rest] = patientName ? patientName.split(/\s+/) : [];
      const lastName = rest.join(" ");
      const startedAt = issue.transfusionRecord?.startedAt ?? null;
      const endedAt = issue.transfusionRecord?.endedAt ?? null;
      const status = this.deriveIssueStatus(issue);

      return {
        id: issue.id,
        issueNumber: issue.issueNumber,
        unitNumber: issue.bloodUnit?.unitNumber ?? null,
        patient: {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          uhid: issue.request?.patient?.uhid ?? undefined,
        },
        patientName: patientName || null,
        crossMatchRef: issue.crossMatch?.certificateNumber ?? issue.crossMatch?.id ?? null,
        crossMatchId: issue.crossMatchId ?? null,
        issuedToPerson: issue.issuedToPerson ?? null,
        issuedToWard: issue.issuedToWard ?? null,
        transportBoxTemp: this.normalizeDecimal(issue.transportBoxTemp),
        status,
        issuedAt: issue.issuedAt,
        createdAt: issue.createdAt,
        notes: issue.inspectionNotes ?? issue.returnReason ?? null,
        startedAt,
        endedAt,
        component: issue.bloodUnit?.componentType ?? null,
        bloodGroup: issue.bloodUnit?.bloodGroup ?? null,
        reactionFlagged: issue.transfusionRecord?.hasReaction ?? false,
      };
    });

    if (opts.transfusing) {
      rows = rows.filter((r) => r.status === "ACTIVE" || r.status === "IN_PROGRESS");
    }

    if (opts.transfusedToday) {
      const today = new Date().toISOString().slice(0, 10);
      rows = rows.filter((r) => {
        if (r.status !== "COMPLETED") return false;
        if (!r.endedAt) return false;
        return new Date(r.endedAt).toISOString().slice(0, 10) === today;
      });
    }

    return rows;
  }

  async listMtpSessions(principal: Principal, branchId?: string | null) {
    const bid = this.ctx.resolveBranchId(principal, branchId);

    const sessions = await this.ctx.prisma.mTPSession.findMany({
      where: { branchId: bid },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
        bloodIssues: {
          select: {
            id: true,
            bloodUnit: {
              select: {
                componentType: true,
              },
            },
          },
        },
      },
      orderBy: { activatedAt: "desc" },
    });

    return sessions.map((session) => {
      let prbcCount = 0;
      let ffpCount = 0;
      let pltCount = 0;

      for (const issue of session.bloodIssues) {
        const component = String(issue.bloodUnit?.componentType ?? "");
        if (component === "PRBC") prbcCount += 1;
        else if (component === "FFP") ffpCount += 1;
        else if (component === "PLATELET_RDP" || component === "PLATELET_SDP") pltCount += 1;
      }

      const summary = session.summary && typeof session.summary === "object" ? (session.summary as any) : null;
      const indication = summary?.clinicalIndication ?? summary?.indication ?? null;

      return {
        id: session.id,
        mtpId: session.id,
        patientId: session.patient?.id ?? session.patientId,
        patientName: session.patient?.name ?? null,
        patient: session.patient?.name ?? null,
        indication,
        activatedAt: session.activatedAt,
        deactivatedAt: session.deactivatedAt,
        completedAt: session.deactivatedAt,
        status: session.status === "DEACTIVATED" ? "COMPLETED" : session.status,
        unitsIssued: session.bloodIssues.length,
        prbcCount,
        ffpCount,
        pltCount,
      };
    });
  }

  async issueBlood(principal: Principal, dto: IssueBloodDto) {
    const crossMatchId = String(dto.crossMatchId ?? "").trim();
    if (!crossMatchId) throw new BadRequestException("crossMatchId is required");
    const { bid, crossMatch, unit } = await this.assertSafetyGatesForIssue(principal, crossMatchId);

    const issueNumber = `BI-${Date.now().toString(36).toUpperCase()}`;
    const result = await this.ctx.prisma.bloodIssue.create({
      data: {
        branchId: bid,
        issueNumber,
        bloodUnitId: crossMatch.bloodUnitId,
        requestId: crossMatch.requestId,
        crossMatchId: dto.crossMatchId!,
        issuedToPerson: (dto.issuedToPerson ?? dto.issuedTo) || null,
        issuedToWard: dto.issuedToWard,
        transportBoxTemp: (dto.transportBoxTemp ?? dto.transportTemp) ?? null,
        issuedByStaffId: this.actorStaffId(principal),
        inspectionNotes: dto.inspectionNotes ?? dto.notes,
      },
    });

    await this.ctx.prisma.bloodUnit.update({ where: { id: crossMatch.bloodUnitId }, data: { status: "ISSUED" } });
    await this.ctx.prisma.bloodRequest.update({ where: { id: crossMatch.requestId }, data: { status: "ISSUED" } });

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_BLOOD_ISSUED", entity: "BloodIssue", entityId: result.id,
      meta: {
        unitId: crossMatch.bloodUnitId,
        requestId: crossMatch.requestId,
        issuedTo: dto.issuedToPerson ?? dto.issuedTo,
        transportBoxTemp: dto.transportBoxTemp ?? dto.transportTemp,
        unitNumber: unit.unitNumber,
        bloodGroup: unit.bloodGroup,
        componentType: unit.componentType,
      },
    });
    return result;
  }

  async bedsideVerify(principal: Principal, issueId: string, dto: BedsideVerifyDto) {
    const issue = await this.ctx.prisma.bloodIssue.findUnique({
      where: { id: issueId },
      include: { bloodUnit: true, request: { include: { patient: true } } },
    });
    if (!issue) throw new NotFoundException("Issue record not found");
    const bid = this.ctx.resolveBranchId(principal, issue.branchId);

    // Safety: Block bedside mismatch
    if (dto.scannedPatientId && dto.scannedPatientId !== issue.request.patientId) {
      throw new BadRequestException("Patient ID mismatch! Scanned patient does not match request patient.");
    }
    if (dto.scannedUnitBarcode && dto.scannedUnitBarcode !== issue.bloodUnit.barcode) {
      throw new BadRequestException("Unit barcode mismatch! Scanned unit does not match issued unit.");
    }

    // Safety: ABO compatibility (strict). Uses sample blood group if available.
    const sample = await this.ctx.prisma.patientBloodSample.findUnique({ where: { requestId: issue.requestId } });
    if (sample?.patientBloodGroup && issue.bloodUnit.bloodGroup) {
      const ok = this.isABOCompatible(sample.patientBloodGroup as any, issue.bloodUnit.bloodGroup as any);
      if (!ok) throw new BadRequestException("ABO mismatch! Patient and unit are incompatible.");
    }

    const result = await this.ctx.prisma.transfusionRecord.upsert({
      where: { issueId },
      create: {
        branchId: bid,
        issueId,
        patientId: issue.request.patientId,
        bedsideVerifier1StaffId: this.actorStaffId(principal),
        bedsideVerifier2StaffId: (dto as any).verifier2StaffId ?? null,
        bedsideVerifiedAt: new Date(),
        patientWristbandScan: !!dto.scannedPatientId,
        unitBarcodeScan: !!dto.scannedUnitBarcode,
        bedsideVerificationOk: true,
      },
      update: {
        bedsideVerifier1StaffId: this.actorStaffId(principal),
        bedsideVerifier2StaffId: (dto as any).verifier2StaffId ?? undefined,
        bedsideVerifiedAt: new Date(),
        patientWristbandScan: !!dto.scannedPatientId,
        unitBarcodeScan: !!dto.scannedUnitBarcode,
        bedsideVerificationOk: true,
      },
    });

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_BEDSIDE_VERIFIED", entity: "BloodIssue", entityId: issueId,
      meta: { scannedPatientId: dto.scannedPatientId, scannedUnitBarcode: dto.scannedUnitBarcode },
    });
    return result;
  }

  async startTransfusion(principal: Principal, issueId: string, dto: StartTransfusionDto) {
    const issue = await this.ctx.prisma.bloodIssue.findUnique({
      where: { id: issueId },
      include: { request: true },
    });
    if (!issue) throw new NotFoundException("Issue record not found");
    const bid = this.ctx.resolveBranchId(principal, issue.branchId);

    // If bedside verification isn't recorded, treat `verifiedBy` as manual bedside verification.
    const existingRecord = await this.ctx.prisma.transfusionRecord.findUnique({ where: { issueId } });
    const now = new Date();
    const bedsideVerifier = (dto as any).verifiedBy ? String((dto as any).verifiedBy) : this.actorStaffId(principal);

    const result = await this.ctx.prisma.transfusionRecord.upsert({
      where: { issueId },
      create: {
        branchId: bid,
        issueId,
        patientId: issue.request.patientId,
        bedsideVerifier1StaffId: bedsideVerifier,
        bedsideVerifiedAt: now,
        bedsideVerificationOk: true,
        startedAt: now,
        preVitals: { ...(dto.vitals ?? {}), startNotes: (dto as any).startNotes ?? null },
        administeredByStaffId: this.actorStaffId(principal),
      },
      update: {
        bedsideVerifier1StaffId: existingRecord?.bedsideVerifier1StaffId ?? bedsideVerifier,
        bedsideVerifiedAt: existingRecord?.bedsideVerifiedAt ?? now,
        bedsideVerificationOk: true,
        startedAt: existingRecord?.startedAt ?? now,
        preVitals: { ...(dto.vitals ?? {}), startNotes: (dto as any).startNotes ?? null },
        administeredByStaffId: this.actorStaffId(principal),
      },
    });

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_TRANSFUSION_STARTED", entity: "TransfusionRecord", entityId: result.id,
      meta: { issueId, bloodUnitId: issue.bloodUnitId },
    });
    return result;
  }

  async recordVitals(principal: Principal, issueId: string, dto: RecordVitalsDto) {
    const transfusion = await this.ctx.prisma.transfusionRecord.findFirst({ where: { issueId } });
    if (!transfusion) throw new NotFoundException("Transfusion record not found");
    const bid = this.ctx.resolveBranchId(principal, transfusion.branchId);

    const intervalRaw = String((dto as any).interval ?? "AUTO").trim().toUpperCase();
    const entry = this.buildVitals(dto, principal);

    let bucket: "vitals15Min" | "vitals30Min" | "vitals1Hr" = "vitals15Min";
    if (intervalRaw === "15MIN") bucket = "vitals15Min";
    else if (intervalRaw === "30MIN") bucket = "vitals30Min";
    else if (intervalRaw === "1HR") bucket = "vitals1Hr";
    else if (intervalRaw === "AUTO") {
      bucket = !transfusion.vitals15Min ? "vitals15Min" : !transfusion.vitals30Min ? "vitals30Min" : "vitals1Hr";
    }

    const vitalsData: Record<string, unknown> = {
      [bucket]: this.appendVitals((transfusion as any)[bucket], entry),
    };

    if ((dto as any).volumeTransfused !== undefined && (dto as any).volumeTransfused !== null) {
      vitalsData.totalVolumeMl = (dto as any).volumeTransfused;
    }

    const result = await this.ctx.prisma.transfusionRecord.update({
      where: { id: transfusion.id },
      data: vitalsData,
    });

    await this.ctx.audit.log({
      branchId: bid,
      actorUserId: principal.userId,
      action: "BB_VITALS_RECORDED",
      entity: "TransfusionRecord",
      entityId: transfusion.id,
      meta: { issueId, bucket },
    });
    return result;
  }

  async endTransfusion(principal: Principal, issueId: string, dto: EndTransfusionDto) {
    const transfusion = await this.ctx.prisma.transfusionRecord.findFirst({ where: { issueId } });
    if (!transfusion) throw new NotFoundException("Transfusion record not found");
    const bid = this.ctx.resolveBranchId(principal, transfusion.branchId);

    const result = await this.ctx.prisma.transfusionRecord.update({
      where: { id: transfusion.id },
      data: {
        endedAt: new Date(),
        postVitals: this.buildVitals(dto, principal),
        totalVolumeMl: dto.volumeTransfused ?? transfusion.totalVolumeMl,
        hasReaction: dto.hasReaction ?? false,
      },
    });

    const issue = await this.ctx.prisma.bloodIssue.findUnique({
      where: { id: issueId },
      select: { bloodUnitId: true, requestId: true },
    });
    if (issue) {
      await this.ctx.prisma.bloodUnit.update({ where: { id: issue.bloodUnitId }, data: { status: "TRANSFUSED" } });
      await this.ctx.prisma.bloodRequest.update({ where: { id: issue.requestId }, data: { status: "COMPLETED" } });
    }

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_TRANSFUSION_ENDED", entity: "TransfusionRecord", entityId: transfusion.id,
      meta: { volumeTransfused: dto.volumeTransfused, hasReaction: dto.hasReaction },
    });
    return result;
  }

  async reportReaction(principal: Principal, issueId: string, dto: ReportReactionDto) {
    const transfusion = await this.ctx.prisma.transfusionRecord.findFirst({ where: { issueId } });
    if (!transfusion) throw new NotFoundException("Transfusion record not found");
    const bid = this.ctx.resolveBranchId(principal, transfusion.branchId);

    const result = await this.ctx.prisma.transfusionReaction.create({
      data: {
        transfusionId: transfusion.id,
        reactionType: dto.reactionType as any,
        severity: dto.severity ?? "UNKNOWN",
        description: dto.description,
        onsetAt: dto.onsetTime ? new Date(dto.onsetTime) : new Date(),
        managementNotes: dto.managementNotes,
        investigationResults: dto.investigationResults,
        reportedByStaffId: this.actorStaffId(principal),
      },
    });

    await this.ctx.prisma.transfusionRecord.update({
      where: { id: transfusion.id },
      data: { hasReaction: true },
    });

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_REACTION_REPORTED", entity: "TransfusionReaction", entityId: result.id,
      meta: { transfusionId: transfusion.id, reactionType: dto.reactionType, severity: dto.severity },
    });
    return result;
  }

  async returnUnit(principal: Principal, issueId: string, dto: ReturnUnitDto) {
    const issue = await this.ctx.prisma.bloodIssue.findUnique({ where: { id: issueId }, include: { bloodUnit: true } });
    if (!issue) throw new NotFoundException("Issue record not found");
    const bid = this.ctx.resolveBranchId(principal, issue.branchId);

    // Check return timeout (4 hours)
    const hoursSinceIssue = (Date.now() - issue.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceIssue > 4) {
      throw new BadRequestException("Return timeout exceeded (>4 hours). Unit must be discarded.");
    }

    await this.ctx.prisma.bloodUnit.update({ where: { id: issue.bloodUnitId }, data: { status: "RETURNED" } });
    const result = await this.ctx.prisma.bloodIssue.update({
      where: { id: issueId },
      data: { isReturned: true, returnedAt: new Date(), returnReason: dto.reason },
    });

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_UNIT_RETURNED", entity: "BloodIssue", entityId: issueId,
      meta: { reason: dto.reason, unitId: issue.bloodUnitId },
    });
    return result;
  }

  async activateMTP(principal: Principal, dto: ActivateMTPDto) {
    const bid = this.ctx.resolveBranchId(principal, dto.branchId);
    const notes = (dto as any)?.notes ?? null;
    const clinicalIndication = dto.clinicalIndication ?? null;
    const result = await this.ctx.prisma.mTPSession.create({
      data: {
        branchId: bid,
        patientId: dto.patientId!,
        encounterId: dto.encounterId,
        summary:
          clinicalIndication || notes
            ? {
                clinicalIndication,
                notes,
              }
            : undefined,
        activatedByStaffId: this.actorStaffId(principal),
        activatedAt: new Date(),
        status: "ACTIVE",
      },
    });

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_MTP_ACTIVATED", entity: "MTPSession", entityId: result.id,
      meta: { patientId: dto.patientId, clinicalIndication, notes },
    });
    return result;
  }

  async deactivateMTP(principal: Principal, id: string) {
    const mtp = await this.ctx.prisma.mTPSession.findUnique({ where: { id } });
    if (!mtp) throw new NotFoundException("MTP session not found");
    const bid = this.ctx.resolveBranchId(principal, mtp.branchId);

    const result = await this.ctx.prisma.mTPSession.update({
      where: { id },
      data: { status: "DEACTIVATED", deactivatedAt: new Date(), deactivatedByStaffId: this.actorStaffId(principal) },
    });

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_MTP_DEACTIVATED", entity: "MTPSession", entityId: id, meta: {},
    });
    return result;
  }

  async getMTP(principal: Principal, id: string) {
    const mtp = await this.ctx.prisma.mTPSession.findUnique({
      where: { id },
      include: { patient: { select: { id: true, name: true, uhid: true } } },
    });
    if (!mtp) throw new NotFoundException("MTP session not found");
    this.ctx.resolveBranchId(principal, mtp.branchId);

    // Get all issues during MTP
    const issues = await this.ctx.prisma.bloodIssue.findMany({
      where: { branchId: mtp.branchId, createdAt: { gte: mtp.activatedAt, lte: mtp.deactivatedAt ?? new Date() } },
      include: { bloodUnit: { select: { id: true, unitNumber: true, bloodGroup: true, componentType: true } } },
    });

    return { ...mtp, issues };
  }

  private deriveIssueStatus(issue: {
    isReturned: boolean;
    returnedAt: Date | null;
    transfusionRecord: { startedAt: Date | null; endedAt: Date | null } | null;
    bloodUnit: { status: string } | null;
  }): string {
    if (issue.isReturned || issue.returnedAt || issue.bloodUnit?.status === "RETURNED") return "RETURNED";
    if (issue.transfusionRecord?.endedAt || issue.bloodUnit?.status === "TRANSFUSED") return "COMPLETED";
    if (issue.transfusionRecord?.startedAt) return "ACTIVE";
    if (issue.bloodUnit?.status === "DISCARDED") return "DISCARDED";
    if (issue.bloodUnit?.status) return issue.bloodUnit.status;
    return "ISSUED";
  }

  private normalizeDecimal(value: unknown): number | string | null {
    if (value == null) return null;
    if (typeof value === "number" || typeof value === "string") return value;
    const numeric = Number(value as any);
    if (Number.isFinite(numeric)) return numeric;
    return String(value);
  }
}
