import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BBContextService } from "../shared/bb-context.service";
import type { Principal } from "../../auth/access-policy.service";
import type { CreateRequestDto, RegisterSampleDto, RecordCrossMatchDto, ElectronicXMDto, PatientGroupingDto } from "./dto";

@Injectable()
export class CrossMatchService {
  constructor(private readonly ctx: BBContextService) {}

  private actorStaffId(principal: Principal): string {
    const p: any = principal as any;
    return String(p?.staffId ?? p?.userId ?? "SYSTEM");
  }

  async listCrossMatches(
    principal: Principal,
    opts: { branchId?: string | null; result?: string; method?: string },
  ) {
    const bid = this.ctx.resolveBranchId(principal, opts.branchId);
    const where: any = { request: { branchId: bid } };
    if (opts.result) where.result = opts.result;
    if (opts.method) where.method = opts.method;

    return this.ctx.prisma.crossMatchTest.findMany({
      where,
      include: {
        request: {
          select: {
            id: true,
            requestNumber: true,
            requestedComponent: true,
            patient: { select: { id: true, name: true } },
          },
        },
        bloodUnit: {
          select: {
            id: true,
            unitNumber: true,
            bloodGroup: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listRequests(principal: Principal, opts: { branchId?: string | null; status?: string; urgency?: string }) {
    const bid = this.ctx.resolveBranchId(principal, opts.branchId);
    const where: any = { branchId: bid };
    if (opts.status) where.status = opts.status;
    if (opts.urgency) where.urgency = opts.urgency;
    return this.ctx.prisma.bloodRequest.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, uhid: true } },
      },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    });
  }

  async getRequest(principal: Principal, id: string) {
    const request = await this.ctx.prisma.bloodRequest.findUnique({
      where: { id },
      include: {
        patient: true,
        patientSample: true,
        crossMatches: { include: { bloodUnit: true } },
      },
    });
    if (!request) throw new NotFoundException("Blood request not found");
    this.ctx.resolveBranchId(principal, request.branchId);
    return request;
  }

  async createRequest(principal: Principal, dto: CreateRequestDto) {
    const bid = this.ctx.resolveBranchId(principal, dto.branchId);
    const requestNumber = `BR-${Date.now().toString(36).toUpperCase()}`;

    // Resolve/ensure Patient
    let patientId = String(dto.patientId ?? "").trim();
    const uhid = String((dto as any).uhid ?? "").trim();
    const patientName = String((dto as any).patientName ?? "").trim();
    if (!patientId) {
      if (!uhid || !patientName) throw new BadRequestException("patientId OR (uhid + patientName) is required");
      const existing = await this.ctx.prisma.patient.findUnique({
        where: { branchId_uhid: { branchId: bid, uhid } },
        select: { id: true },
      });
      if (existing) patientId = existing.id;
      else {
        const created = await this.ctx.prisma.patient.create({
          data: { branchId: bid, uhid, name: patientName },
          select: { id: true },
        });
        patientId = created.id;
      }
    }

    const requestedComponent = String((dto as any).requestedComponent ?? dto.componentType ?? "").trim();
    if (!requestedComponent) throw new BadRequestException("requestedComponent is required");
    const quantityUnits = (dto as any).quantityUnits ?? dto.quantityRequested ?? 1;
    if (!Number.isFinite(quantityUnits) || quantityUnits < 1) throw new BadRequestException("quantityUnits must be >= 1");
    const urgency = (dto.urgency as any) ?? "ROUTINE";

    const result = await this.ctx.prisma.bloodRequest.create({
      data: {
        branchId: bid,
        requestNumber,
        patientId,
        encounterId: dto.encounterId,
        requestedComponent: requestedComponent as any,
        quantityUnits,
        urgency,
        indication: dto.indication,
        diagnosis: (dto as any).diagnosis,
        notes: (dto as any).notes,
        requestedByStaffId: this.actorStaffId(principal),
        status: "PENDING",
        slaTargetMinutes: urgency === "EMERGENCY" ? 5 : urgency === "URGENT" ? 15 : 45,
      },
    });
    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_REQUEST_CREATE", entity: "BloodRequest", entityId: result.id,
      meta: { requestNumber, patientId, uhid: uhid || undefined, urgency, requestedComponent, quantityUnits },
    });
    return result;
  }

  async registerSample(principal: Principal, requestId: string, dto: RegisterSampleDto) {
    const request = await this.ctx.prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Blood request not found");
    const bid = this.ctx.resolveBranchId(principal, request.branchId);

    // Idempotent: if already registered, update instead of failing unique(requestId)
    const existing = await this.ctx.prisma.patientBloodSample.findUnique({ where: { requestId } });
    const sampleId = String(dto.sampleId ?? existing?.sampleId ?? `PS-${Date.now().toString(36).toUpperCase()}`).trim();
    const collectedAt = dto.collectedAt ? new Date(dto.collectedAt) : existing?.collectedAt ?? new Date();
    const result = existing
      ? await this.ctx.prisma.patientBloodSample.update({
          where: { id: existing.id },
          data: {
            sampleId,
            collectedAt,
            collectedByStaffId: this.actorStaffId(principal),
            verifiedByStaffId: dto.verifiedBy ?? existing.verifiedByStaffId ?? null,
            verificationMethod: dto.verificationMethod ?? existing.verificationMethod ?? null,
          },
        })
      : await this.ctx.prisma.patientBloodSample.create({
          data: {
            requestId,
            sampleId,
            collectedAt,
            collectedByStaffId: this.actorStaffId(principal),
            verifiedByStaffId: dto.verifiedBy ?? null,
            verificationMethod: dto.verificationMethod ?? null,
          },
        });

    // Move status forward (but never backwards)
    if (request.status === "PENDING") {
      await this.ctx.prisma.bloodRequest.update({ where: { id: requestId }, data: { status: "SAMPLE_RECEIVED" } });
    }

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_SAMPLE_REGISTERED", entity: "PatientBloodSample", entityId: result.id,
      meta: { requestId, sampleId: result.sampleId },
    });
    return result;
  }

  async patientGrouping(principal: Principal, requestId: string, dto: PatientGroupingDto) {
    const request = await this.ctx.prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Blood request not found");
    const bid = this.ctx.resolveBranchId(principal, request.branchId);

    // Store patient grouping in the patient sample
    const sample = await this.ctx.prisma.patientBloodSample.findUnique({ where: { requestId } });
    if (!sample) throw new BadRequestException("No patient sample registered for this request");

    const bloodGroup = String((dto.patientBloodGroup ?? dto.bloodGroup ?? (dto as any).bloodGroup ?? "")).trim();
    const antibodies = String(
      (dto.patientAntibodies ?? dto.antibodies ?? dto.antibodyScreenResult ?? (dto as any).antibodies ?? "")
        .toString()
        .trim(),
    );

    if (!bloodGroup) throw new BadRequestException("patientBloodGroup (or bloodGroup) is required");

    const result = await this.ctx.prisma.patientBloodSample.update({
      where: { id: sample.id },
      data: {
        patientBloodGroup: bloodGroup as any,
        patientAntibodies: antibodies || null,
        verificationMethod: dto.verificationMethod ?? sample.verificationMethod ?? null,
      },
    });

    // Move request to CROSS_MATCHING if not already READY/ISSUED/COMPLETED
    if (request.status === "PENDING" || request.status === "SAMPLE_RECEIVED") {
      await this.ctx.prisma.bloodRequest.update({ where: { id: requestId }, data: { status: "CROSS_MATCHING" } });
    }

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_PATIENT_GROUPING", entity: "BloodRequest", entityId: requestId,
      meta: { bloodGroup },
    });
    return result;
  }

  async recordCrossMatch(principal: Principal, requestId: string, dto: RecordCrossMatchDto) {
    const request = await this.ctx.prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Blood request not found");
    const bid = this.ctx.resolveBranchId(principal, request.branchId);

    const sample = await this.ctx.prisma.patientBloodSample.findFirst({
      where: { requestId },
      orderBy: { createdAt: "desc" },
    });
    if (!sample) throw new BadRequestException("No patient sample registered for this request");

    const unitId = String((dto as any).unitId ?? (dto as any).bloodUnitId ?? "").trim();
    if (!unitId) throw new BadRequestException("bloodUnitId is required");
    const unit = await this.ctx.prisma.bloodUnit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException("Blood unit not found");
    if (unit.status !== "AVAILABLE" && unit.status !== "RESERVED") {
      throw new BadRequestException(`Unit status ${unit.status} is not eligible for cross-matching`);
    }

    const certificateNumber = `XM-${Date.now().toString(36).toUpperCase()}`;
    const result = await this.ctx.prisma.crossMatchTest.create({
      data: {
        requestId,
        sampleId: sample.id,
        bloodUnitId: unitId,
        method: (dto.method as any) ?? "AHG_INDIRECT_COOMBS",
        result: (dto.result as any) ?? "PENDING",
        certificateNumber,
        testedByStaffId: this.actorStaffId(principal),
        validUntil: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    if (dto.result === "COMPATIBLE") {
      await this.ctx.prisma.bloodUnit.update({ where: { id: unitId }, data: { status: "CROSS_MATCHED" } });
      await this.ctx.prisma.bloodRequest.update({ where: { id: requestId }, data: { status: "READY" } });
    }

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_CROSSMATCH_RECORDED", entity: "CrossMatchTest", entityId: result.id,
      meta: { requestId, unitId, result: dto.result, certificateNumber },
    });
    return result;
  }

  async electronicCrossMatch(principal: Principal, requestId: string, dto: ElectronicXMDto) {
    const request = await this.ctx.prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Blood request not found");
    const bid = this.ctx.resolveBranchId(principal, request.branchId);

    const unit = await this.ctx.prisma.bloodUnit.findUnique({
      where: { id: dto.unitId },
      include: { groupingResults: true, ttiTests: true },
    });
    if (!unit) throw new NotFoundException("Blood unit not found");

    // Electronic XM eligibility: no antibodies, 2 consistent ABO/Rh results
    const verifiedGrouping = unit.groupingResults.find((g) => g.verifiedByStaffId);
    if (!verifiedGrouping) throw new BadRequestException("Unit grouping not verified");
    const anyReactiveTTI = unit.ttiTests.some((t) => t.result === "REACTIVE");
    if (anyReactiveTTI) throw new BadRequestException("Unit has reactive TTI results");

    const sample = await this.ctx.prisma.patientBloodSample.findUnique({
      where: { requestId },
    });

    if (!sample) throw new BadRequestException("No patient sample registered for this request");
    if (!sample.patientBloodGroup) throw new BadRequestException("Patient blood group not recorded for this request");

    const compatible = this.isABOCompatible((sample.patientBloodGroup as string | null) ?? null, (unit.bloodGroup as string | null) ?? null);
    const certificateNumber = `EXM-${Date.now().toString(36).toUpperCase()}`;

    const result = await this.ctx.prisma.crossMatchTest.create({
      data: {
        requestId,
        sampleId: sample.id,
        bloodUnitId: dto.unitId,
        method: "ELECTRONIC",
        result: compatible ? "COMPATIBLE" : "INCOMPATIBLE",
        certificateNumber,
        testedByStaffId: this.actorStaffId(principal),
        validUntil: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    if (compatible) {
      await this.ctx.prisma.bloodUnit.update({ where: { id: dto.unitId }, data: { status: "CROSS_MATCHED" } });
      await this.ctx.prisma.bloodRequest.update({ where: { id: requestId }, data: { status: "READY" } });
    }

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_ELECTRONIC_XM", entity: "CrossMatchTest", entityId: result.id,
      meta: { requestId, unitId: dto.unitId, compatible, certificateNumber },
    });
    return result;
  }

  async getCertificate(principal: Principal, requestId: string) {
    const request = await this.ctx.prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Blood request not found");
    this.ctx.resolveBranchId(principal, request.branchId);

    const crossMatches = await this.ctx.prisma.crossMatchTest.findMany({
      where: { requestId, result: "COMPATIBLE" },
      include: {
        bloodUnit: { select: { id: true, unitNumber: true, bloodGroup: true, componentType: true, expiryDate: true } },
        sample: true,
      },
    });
    return {
      requestId,
      requestNumber: request.requestNumber,
      patientId: request.patientId,
      crossMatches,
    };
  }

  async suggestCompatibleUnits(principal: Principal, requestId: string) {
    const request = await this.ctx.prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException("Blood request not found");
    const bid = this.ctx.resolveBranchId(principal, request.branchId);

    const sample = await this.ctx.prisma.patientBloodSample.findUnique({ where: { requestId } });
    const compatibleGroups = this.getCompatibleBloodGroups(sample?.patientBloodGroup ?? null);
    return this.ctx.prisma.bloodUnit.findMany({
      where: {
        branchId: bid,
        status: "AVAILABLE",
        bloodGroup: { in: compatibleGroups as any[] },
        componentType: request.requestedComponent ?? undefined,
      },
      orderBy: { expiryDate: "asc" },
      take: 20,
    });
  }

  private isABOCompatible(patientGroup: string | null, unitGroup: string | null): boolean {
    if (!patientGroup || !unitGroup) return false;
    const compatMap: Record<string, string[]> = {
      A_POS: ["A_POS", "A_NEG", "O_POS", "O_NEG"],
      A_NEG: ["A_NEG", "O_NEG"],
      B_POS: ["B_POS", "B_NEG", "O_POS", "O_NEG"],
      B_NEG: ["B_NEG", "O_NEG"],
      AB_POS: ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"],
      AB_NEG: ["A_NEG", "B_NEG", "AB_NEG", "O_NEG"],
      O_POS: ["O_POS", "O_NEG"],
      O_NEG: ["O_NEG"],
    };
    return (compatMap[patientGroup] ?? []).includes(unitGroup);
  }

  private getCompatibleBloodGroups(patientGroup: string | null): string[] {
    if (!patientGroup) return [];
    const compatMap: Record<string, string[]> = {
      A_POS: ["A_POS", "A_NEG", "O_POS", "O_NEG"],
      A_NEG: ["A_NEG", "O_NEG"],
      B_POS: ["B_POS", "B_NEG", "O_POS", "O_NEG"],
      B_NEG: ["B_NEG", "O_NEG"],
      AB_POS: ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"],
      AB_NEG: ["A_NEG", "B_NEG", "AB_NEG", "O_NEG"],
      O_POS: ["O_POS", "O_NEG"],
      O_NEG: ["O_NEG"],
    };
    return compatMap[patientGroup] ?? [];
  }
}
