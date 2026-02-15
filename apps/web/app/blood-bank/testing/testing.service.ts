import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BBContextService } from "../shared/bb-context.service";
import type { Principal } from "../../auth/access-policy.service";
import type { RecordGroupingDto, RecordTTIDto, VerifyResultsDto, ConfirmLabelDto } from "./dto";

@Injectable()
export class TestingService {
  constructor(private readonly ctx: BBContextService) {}

  private actorStaffId(principal: Principal): string {
    const p: any = principal as any;
    return String(p?.staffId ?? p?.userId ?? "SYSTEM");
  }

  private resolveUnitId(dto: any): string {
    const id = String(dto?.unitId ?? dto?.bloodUnitId ?? "").trim();
    if (!id) throw new BadRequestException("bloodUnitId is required");
    return id;
  }

  private computeConfirmedGroup(dto: any): string | undefined {
    const direct = String(dto?.confirmedBloodGroup ?? "").trim();
    if (direct) return direct;
    const abo = String(dto?.aboGroup ?? "").trim().toUpperCase();
    const rhRaw = String(dto?.rhFactor ?? "").trim().toUpperCase();
    if (!abo || !rhRaw) return undefined;
    const rh = rhRaw.startsWith("POS") ? "POS" : rhRaw.startsWith("NEG") ? "NEG" : undefined;
    if (!rh) return undefined;
    if (!["A", "B", "AB", "O"].includes(abo)) return undefined;
    return `${abo}_${rh}`;
  }

  async worklist(principal: Principal, branchId?: string | null) {
    const bid = this.ctx.resolveBranchId(principal, branchId);
    return this.ctx.prisma.bloodUnit.findMany({
      where: { branchId: bid, status: "TESTING" },
      include: {
        donor: { select: { id: true, donorNumber: true, name: true, bloodGroup: true } },
        groupingResults: true,
        ttiTests: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async recordGrouping(principal: Principal, dto: RecordGroupingDto) {
    const unitId = this.resolveUnitId(dto);
    const unit = await this.ctx.prisma.bloodUnit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException("Blood unit not found");
    const bid = this.ctx.resolveBranchId(principal, unit.branchId);

    const confirmedGroup = this.computeConfirmedGroup(dto);

    const result = await this.ctx.prisma.bloodGroupingResult.create({
      data: {
        bloodUnitId: unitId,
        forwardGrouping: (dto as any).aboForward ?? { aboGroup: (dto as any).aboGroup, rhFactor: (dto as any).rhFactor },
        reverseGrouping: (dto as any).aboReverse ?? {},
        rhType: (dto as any).rhTyping ? String((dto as any).rhTyping) : (dto as any).rhFactor ? String((dto as any).rhFactor) : undefined,
        antibodyScreenResult: (dto as any).antibodyScreen,
        confirmedGroup: confirmedGroup as any,
        hasDiscrepancy: dto.hasDiscrepancy ?? false,
        discrepancyNotes: dto.discrepancyNotes,
        testedByStaffId: this.actorStaffId(principal),
      },
    });

    if (confirmedGroup) {
      await this.ctx.prisma.bloodUnit.update({
        where: { id: unitId },
        data: { bloodGroup: confirmedGroup as any },
      });
    }

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_GROUPING_RECORDED", entity: "BloodGroupingResult", entityId: result.id,
      meta: { unitId, confirmedGroup, hasDiscrepancy: dto.hasDiscrepancy },
    });
    return result;
  }

  async recordTTI(principal: Principal, dto: RecordTTIDto) {
    const unitId = this.resolveUnitId(dto);
    const unit = await this.ctx.prisma.bloodUnit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException("Blood unit not found");
    const bid = this.ctx.resolveBranchId(principal, unit.branchId);

    // Update most recent unverified record for the same testName if present, otherwise create.
    const existing = await this.ctx.prisma.tTITestRecord.findFirst({
      where: { bloodUnitId: unitId, testName: dto.testName!, verifiedByStaffId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const result = existing
      ? await this.ctx.prisma.tTITestRecord.update({
          where: { id: existing.id },
          data: {
            method: dto.method,
            kitLotNo: dto.kitLotNumber,
            result: (dto.result as any) ?? "PENDING",
            testedByStaffId: this.actorStaffId(principal),
          },
        })
      : await this.ctx.prisma.tTITestRecord.create({
          data: {
            bloodUnitId: unitId,
            testName: dto.testName!,
            method: dto.method,
            kitLotNo: dto.kitLotNumber,
            result: (dto.result as any) ?? "PENDING",
            testedByStaffId: this.actorStaffId(principal),
          },
        });

    // If reactive, quarantine the unit and trigger look-back
    if (dto.result === "REACTIVE") {
      await this.ctx.prisma.bloodUnit.update({
        where: { id: unitId },
        data: { status: "QUARANTINED" },
      });

      // Look-back: find prior donations from same donor
      const priorUnits = await this.ctx.prisma.bloodUnit.findMany({
        where: { donorId: unit.donorId, id: { not: unit.id }, status: { in: ["AVAILABLE", "ISSUED"] } },
      });

      if (priorUnits.length > 0) {
        await this.ctx.audit.log({
          branchId: bid, actorUserId: principal.userId,
          action: "BB_TTI_LOOKBACK_TRIGGERED", entity: "BloodUnit", entityId: unitId,
          meta: { testName: dto.testName, affectedUnits: priorUnits.map((u) => u.id) },
        });
      }
    }

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_TTI_RECORDED", entity: "TTITestRecord", entityId: result.id,
      meta: { unitId, testName: dto.testName, result: dto.result },
    });
    return result;
  }

  async verifyResults(principal: Principal, dto: VerifyResultsDto) {
    const unitId = this.resolveUnitId(dto);
    const unit = await this.ctx.prisma.bloodUnit.findUnique({
      where: { id: unitId },
      include: {
        groupingResults: { orderBy: { createdAt: "desc" } },
        ttiTests: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!unit) throw new NotFoundException("Blood unit not found");
    const bid = this.ctx.resolveBranchId(principal, unit.branchId);

    const latestGrouping = unit.groupingResults[0];
    if (!latestGrouping) throw new BadRequestException("No grouping results recorded");

    // Must have all 5 mandatory tests completed
    const REQUIRED = ["HIV", "HBsAg", "HCV", "Syphilis", "Malaria"];
    const byName = new Map(unit.ttiTests.map((t) => [t.testName, t]));
    const missing = REQUIRED.filter((n) => !byName.has(n));
    if (missing.length) throw new BadRequestException(`Missing TTI test(s): ${missing.join(", ")}`);
    const pending = REQUIRED.filter((n) => {
      const t = byName.get(n);
      return !t || t.result === "PENDING";
    });
    if (pending.length) throw new BadRequestException(`TTI test(s) still pending: ${pending.join(", ")}`);

    // Verify grouping
    await this.ctx.prisma.bloodGroupingResult.update({
      where: { id: latestGrouping.id },
      data: { verifiedByStaffId: this.actorStaffId(principal), verifiedAt: new Date() },
    });

    // Verify TTI tests
    await this.ctx.prisma.tTITestRecord.updateMany({
      where: { bloodUnitId: unitId, verifiedByStaffId: null },
      data: { verifiedByStaffId: this.actorStaffId(principal), verifiedAt: new Date() },
    });

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_RESULTS_VERIFIED", entity: "BloodUnit", entityId: unitId,
      meta: { verifierNotes: dto.notes },
    });
    return { unitId, verified: true, verifiedBy: this.actorStaffId(principal) };
  }

  async confirmLabel(principal: Principal, dto: ConfirmLabelDto) {
    const unitId = this.resolveUnitId(dto);
    const unit = await this.ctx.prisma.bloodUnit.findUnique({
      where: { id: unitId },
      include: {
        ttiTests: { orderBy: { createdAt: "desc" } },
        groupingResults: { orderBy: { createdAt: "desc" } },
        inventorySlot: true,
      },
    });
    if (!unit) throw new NotFoundException("Blood unit not found");
    const bid = this.ctx.resolveBranchId(principal, unit.branchId);

    // Safety: block release if any TTI is reactive
    const reactiveTest = unit.ttiTests.find((t) => t.result === "REACTIVE");
    if (reactiveTest) throw new BadRequestException("Cannot confirm label: TTI reactive result found");

    // Safety: block release if grouping not verified
    const latestGrouping = unit.groupingResults[0];
    if (!latestGrouping?.verifiedByStaffId) throw new BadRequestException("Cannot confirm label: grouping not verified");

    // Safety: block release if any TTI pending
    const pendingTest = unit.ttiTests.find((t) => t.result === "PENDING");
    if (pendingTest) throw new BadRequestException("Cannot confirm label: TTI tests still pending");

    const result = await this.ctx.prisma.bloodUnit.update({
      where: { id: unitId },
      data: { status: "AVAILABLE" },
    });

    // Storage placement: auto-place into default storage equipment (best UX)
    // - If facility has defaultStorageEquipmentId: use it
    // - Else fallback to first active refrigerator/freezer/agitator
    // - If none found: create a WARN notification so operations can assign manually
    if (!unit.inventorySlot) {
      const facility = await this.ctx.prisma.bloodBankFacility.findUnique({
        where: { branchId: bid },
        select: { defaultStorageEquipmentId: true },
      });
      const fallbackEq = await this.ctx.prisma.bloodBankEquipment.findFirst({
        where: {
          branchId: bid,
          isActive: true,
          equipmentType: { in: ["REFRIGERATOR", "DEEP_FREEZER", "PLATELET_AGITATOR"] },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      const equipmentId = facility?.defaultStorageEquipmentId ?? fallbackEq?.id ?? null;
      if (equipmentId) {
        await this.ctx.prisma.bloodInventorySlot.upsert({
          where: { bloodUnitId: unitId },
          create: { bloodUnitId: unitId, equipmentId },
          update: { equipmentId, assignedAt: new Date(), removedAt: null },
        });
        await this.ctx.audit.log({
          branchId: bid,
          actorUserId: principal.userId,
          action: "BB_STORAGE_AUTO_PLACED",
          entity: "BloodUnit",
          entityId: unitId,
          meta: { equipmentId },
        });
      } else {
        await this.ctx.prisma.notification.create({
          data: {
            branchId: bid,
            title: "Storage placement pending",
            message: `Unit ${unit.unitNumber} released as AVAILABLE but no storage equipment is configured. Please assign a storage location.`,
            severity: "WARNING",
            status: "OPEN",
            source: "BLOOD_BANK",
            entity: "BloodUnit",
            entityId: unitId,
            meta: { unitId, unitNumber: unit.unitNumber },
          },
        });
      }
    }

    await this.ctx.audit.log({
      branchId: bid, actorUserId: principal.userId,
      action: "BB_LABEL_CONFIRMED", entity: "BloodUnit", entityId: unitId,
      meta: { status: "AVAILABLE" },
    });
    return result;
  }

  async dailyQCStatus(principal: Principal, branchId?: string | null) {
    const bid = this.ctx.resolveBranchId(principal, branchId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const qcRecords = await this.ctx.prisma.qualityControlRecord.findMany({
      where: { branchId: bid, performedAt: { gte: today, lt: tomorrow } },
    });

    return {
      date: today.toISOString().slice(0, 10),
      totalRecords: qcRecords.length,
      passed: qcRecords.filter((r) => r.westgardResult === "PASS").length,
      failed: qcRecords.filter((r) => r.westgardResult === "FAIL").length,
      records: qcRecords,
    };
  }
}
