import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreateChargeMasterItemDto, UpdateChargeMasterItemDto } from "./dto";
import { canonicalizeCode } from "../../../common/naming.util";

@Injectable()
export class ChargeMasterService {
  constructor(private readonly ctx: InfraContextService) {}

  private async assertTaxCode(branchId: string, taxCodeId?: string | null) {
    if (!taxCodeId) return null;
    const exists = await this.ctx.prisma.taxCode.findFirst({
      where: { id: taxCodeId, branchId, isActive: true },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException("Invalid taxCodeId for this branch");
    return taxCodeId;
  }

  async createChargeMasterItem(principal: Principal, dto: CreateChargeMasterItemDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const code = canonicalizeCode(dto.code);

    const taxCodeId = await this.assertTaxCode(branchId, dto.taxCodeId ?? null);

    const created = await this.ctx.prisma.chargeMasterItem.create({
      data: {
        branchId,
        code,
        name: dto.name.trim(),
        category: dto.category ?? null,
        unit: dto.unit ?? null,

        // Advanced billing
        chargeUnit: (dto.chargeUnit as any) ?? undefined,
        taxCodeId,
        isTaxInclusive: dto.isTaxInclusive ?? false,
        hsnSac: dto.hsnSac ?? null,
        billingPolicy: dto.billingPolicy !== undefined ? (dto.billingPolicy as any) : undefined,

        isActive: dto.isActive ?? true,
      },
      include: { taxCode: true },
    });

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

  async listChargeMasterItems(
    principal: Principal,
    q: { branchId?: string | null; q?: string; includeInactive?: boolean; take?: number },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    const where: any = { branchId };

    if (!q.includeInactive) where.isActive = true;
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: "insensitive" } },
        { code: { contains: q.q, mode: "insensitive" } },
        { category: { contains: q.q, mode: "insensitive" } },
      ];
    }

    return this.ctx.prisma.chargeMasterItem.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: q.take && Number.isFinite(q.take) ? Math.min(Math.max(q.take, 1), 500) : 200,
      include: { taxCode: true },
    });
  }

  async getChargeMasterItem(principal: Principal, id: string) {
    const row = await this.ctx.prisma.chargeMasterItem.findUnique({
      where: { id },
      include: { taxCode: true },
    });
    if (!row) throw new NotFoundException("Charge master item not found");

    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  async updateChargeMasterItem(principal: Principal, id: string, dto: UpdateChargeMasterItemDto) {
    const existing = await this.ctx.prisma.chargeMasterItem.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Charge master item not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const taxCodeIdNormalized =
      dto.taxCodeId === undefined
        ? undefined
        : dto.taxCodeId === null || String(dto.taxCodeId).trim() === ""
          ? null
          : String(dto.taxCodeId).trim();

    const hsnNormalized =
      dto.hsnSac === undefined
        ? undefined
        : dto.hsnSac === null || String(dto.hsnSac).trim() === ""
          ? null
          : String(dto.hsnSac).trim();

    const taxCodeId =
      taxCodeIdNormalized === undefined ? undefined : await this.assertTaxCode(branchId, taxCodeIdNormalized);

    const updated = await this.ctx.prisma.chargeMasterItem.update({
      where: { id },
      data: {
        code: dto.code ? canonicalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        category: dto.category === undefined ? undefined : (dto.category ?? null),
        unit: dto.unit === undefined ? undefined : (dto.unit ?? null),

        // Advanced billing
        chargeUnit: dto.chargeUnit === undefined ? undefined : (dto.chargeUnit as any),
        taxCodeId,
        isTaxInclusive: dto.isTaxInclusive ?? undefined,
        hsnSac: hsnNormalized,
        billingPolicy: dto.billingPolicy !== undefined ? (dto.billingPolicy as any) : undefined,

        isActive: dto.isActive ?? undefined,
      },
      include: { taxCode: true },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_CHARGE_MASTER_UPDATE",
      entity: "ChargeMasterItem",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  /**
   * Safe "Delete" used by UI:
   * Soft deactivate to preserve historical tariffs / mappings.
   */
  async deactivateChargeMasterItem(principal: Principal, id: string) {
    const existing = await this.ctx.prisma.chargeMasterItem.findUnique({
      where: { id },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!existing) throw new NotFoundException("Charge master item not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    // Already inactive
    if (!existing.isActive) {
      return this.ctx.prisma.chargeMasterItem.findUnique({
        where: { id },
        include: { taxCode: true },
      });
    }

    const updated = await this.ctx.prisma.chargeMasterItem.update({
      where: { id },
      data: { isActive: false },
      include: { taxCode: true },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_CHARGE_MASTER_DEACTIVATE",
      entity: "ChargeMasterItem",
      entityId: id,
      meta: {},
    });

    return updated;
  }
}
