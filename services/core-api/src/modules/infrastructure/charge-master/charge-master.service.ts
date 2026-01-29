import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreateChargeMasterItemDto, UpdateChargeMasterItemDto } from "./dto";
import { canonicalizeCode } from "../../../common/naming.util";

@Injectable()
export class ChargeMasterService {
  constructor(private readonly ctx: InfraContextService) {}

  private async openFixItOnce(branchId: string, input: {
    type: any;
    entityType?: any;
    entityId?: string | null;
    serviceItemId?: string | null;
    title: string;
    details?: any;
    severity?: any;
  }) {
    const exists = await this.ctx.prisma.fixItTask.findFirst({
      where: {
        branchId,
        type: input.type,
        status: { in: ["OPEN", "IN_PROGRESS"] as any },
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
      select: { id: true },
    });
    if (exists) return;

    await this.ctx.prisma.fixItTask.create({
      data: {
        branchId,
        type: input.type,
        status: "OPEN" as any,
        severity: (input.severity ?? "BLOCKER") as any,
        entityType: (input.entityType ?? null) as any,
        entityId: input.entityId ?? null,
        serviceItemId: input.serviceItemId ?? null,
        title: input.title,
        details: input.details ?? undefined,
      },
    });
  }

  private async resolveFixIts(branchId: string, where: any) {
    await this.ctx.prisma.fixItTask.updateMany({
      where: { branchId, status: { in: ["OPEN", "IN_PROGRESS"] as any }, ...where },
      data: { status: "RESOLVED" as any, resolvedAt: new Date() },
    });
  }

  async createChargeMasterItem(principal: Principal, dto: CreateChargeMasterItemDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const code = canonicalizeCode(dto.code);

    // enforce: taxCode must be ACTIVE if provided
    if (dto.taxCodeId) {
      const tc = await this.ctx.prisma.taxCode.findFirst({
        where: { id: dto.taxCodeId, branchId, isActive: true },
        select: { id: true },
      });
      if (!tc) throw new BadRequestException("Invalid taxCodeId (must belong to branch and be ACTIVE)");
    }

    const created = await this.ctx.prisma.chargeMasterItem.create({
      data: {
        branchId,
        code,
        name: dto.name.trim(),
        category: dto.category ?? null,
        unit: dto.unit ?? null,
        chargeUnit: (dto.chargeUnit ?? "PER_UNIT") as any,
        taxCodeId: dto.taxCodeId ?? null,
        isTaxInclusive: dto.isTaxInclusive ?? false,
        hsnSac: dto.hsnSac ?? null,
        billingPolicy: dto.billingPolicy ?? undefined,
        isActive: dto.isActive ?? true,
      },
    });

    // if tax code present => resolve missing/inactive fixits
    if (created.taxCodeId) {
      await this.resolveFixIts(branchId, {
        type: "TAX_CODE_MISSING" as any,
        entityType: "CHARGE_MASTER_ITEM" as any,
        entityId: created.id,
      });
      await this.resolveFixIts(branchId, {
        type: "TAX_CODE_INACTIVE" as any,
        entityType: "TAX_CODE" as any,
        entityId: created.taxCodeId,
      });
    }

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_CHARGE_MASTER_CREATE",
      entity: "ChargeMasterItem",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async listChargeMasterItems(principal: Principal, q: { branchId?: string | null; q?: string }) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);

    const where: any = { branchId };
    if (q.q) {
      where.OR = [
        { code: { contains: q.q, mode: "insensitive" } },
        { name: { contains: q.q, mode: "insensitive" } },
      ];
    }

    return this.ctx.prisma.chargeMasterItem.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      include: { taxCode: true },
    });
  }

  async getChargeMasterItem(principal: Principal, id: string) {
    const item = await this.ctx.prisma.chargeMasterItem.findUnique({
      where: { id },
      include: { taxCode: true },
    });
    if (!item) throw new NotFoundException("ChargeMasterItem not found");
    this.ctx.resolveBranchId(principal, item.branchId);
    return item;
  }

  async updateChargeMasterItem(principal: Principal, id: string, dto: UpdateChargeMasterItemDto) {
    const existing = await this.ctx.prisma.chargeMasterItem.findUnique({
      where: { id },
      select: { id: true, branchId: true, chargeUnit: true, taxCodeId: true },
    });
    if (!existing) throw new NotFoundException("ChargeMasterItem not found");
    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    // enforce: taxCode must be ACTIVE if provided (non-null)
    if (dto.taxCodeId !== undefined && dto.taxCodeId !== null) {
      const tc = await this.ctx.prisma.taxCode.findFirst({
        where: { id: dto.taxCodeId, branchId, isActive: true },
        select: { id: true },
      });
      if (!tc) throw new BadRequestException("Invalid taxCodeId (must belong to branch and be ACTIVE)");
    }

    const updated = await this.ctx.prisma.chargeMasterItem.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        category: dto.category !== undefined ? (dto.category ?? null) : undefined,
        unit: dto.unit !== undefined ? (dto.unit ?? null) : undefined,
        chargeUnit: dto.chargeUnit ? (dto.chargeUnit as any) : undefined,
        taxCodeId: dto.taxCodeId !== undefined ? (dto.taxCodeId ?? null) : undefined,
        isTaxInclusive: dto.isTaxInclusive !== undefined ? dto.isTaxInclusive : undefined,
        hsnSac: dto.hsnSac !== undefined ? (dto.hsnSac ?? null) : undefined,
        billingPolicy: dto.billingPolicy !== undefined ? dto.billingPolicy : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_CHARGE_MASTER_UPDATE",
      entity: "ChargeMasterItem",
      entityId: id,
      meta: dto,
    });

    // ---------- Auto-resolve tax fixits if now has tax
    if (updated.taxCodeId) {
      await this.resolveFixIts(branchId, {
        type: "TAX_CODE_MISSING" as any,
        entityType: "CHARGE_MASTER_ITEM" as any,
        entityId: id,
      });
      await this.resolveFixIts(branchId, {
        type: "TAX_CODE_INACTIVE" as any,
        entityType: "TAX_CODE" as any,
        entityId: updated.taxCodeId,
      });
    } else {
      // If tax removed -> open TAX_CODE_MISSING for this CM (GoLive will also open, but we open immediately)
      await this.openFixItOnce(branchId, {
        type: "TAX_CODE_MISSING" as any,
        entityType: "CHARGE_MASTER_ITEM" as any,
        entityId: id,
        title: `Tax code missing for charge item`,
        details: { chargeMasterItemId: id },
        severity: "BLOCKER",
      });
    }

    // ---------- Charge Unit mismatch: if chargeUnit changed, re-check all active service mappings
    if (dto.chargeUnit && dto.chargeUnit !== (existing.chargeUnit as any)) {
      const mappings = await this.ctx.prisma.serviceChargeMapping.findMany({
        where: { branchId, chargeMasterItemId: id, effectiveTo: null },
        select: { serviceItemId: true, serviceItem: { select: { id: true, code: true, name: true, chargeUnit: true } } },
      });

      for (const m of mappings) {
        const svc = m.serviceItem;
        if (!svc) continue;

        const mismatch = (svc.chargeUnit as any) !== (updated.chargeUnit as any);

        if (mismatch) {
          await this.openFixItOnce(branchId, {
            type: "CHARGE_UNIT_MISMATCH" as any,
            entityType: "SERVICE_ITEM" as any,
            entityId: svc.id,
            serviceItemId: svc.id,
            title: `Charge unit mismatch for ${svc.code}`,
            details: {
              serviceItemId: svc.id,
              serviceChargeUnit: svc.chargeUnit,
              chargeMasterItemId: updated.id,
              chargeMasterChargeUnit: updated.chargeUnit,
            },
            severity: "BLOCKER",
          });
        } else {
          await this.resolveFixIts(branchId, {
            type: "CHARGE_UNIT_MISMATCH" as any,
            entityType: "SERVICE_ITEM" as any,
            entityId: svc.id,
          });
        }
      }
    }

    return updated;
  }
}
