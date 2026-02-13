import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreatePricingTierDto, UpdatePricingTierDto, UpsertTierRateDto } from "./dto";
import { canonicalizeCode } from "../../../common/naming.util";

@Injectable()
export class PricingTierService {
  constructor(private readonly ctx: InfraContextService) {}

  async createTier(principal: Principal, dto: CreatePricingTierDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const code = canonicalizeCode(dto.code);

    const duplicate = await this.ctx.prisma.patientPricingTier.findFirst({
      where: { branchId, code },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException(`Pricing tier code "${code}" already exists in this branch`);

    const created = await this.ctx.prisma.patientPricingTier.create({
      data: {
        branchId,
        kind: dto.kind as any,
        name: dto.name.trim(),
        code,
        description: dto.description ?? null,
        assignmentRules: dto.assignmentRules ?? undefined,
        defaultDiscountPercent: dto.defaultDiscountPercent ?? null,
        defaultMarkupPercent: dto.defaultMarkupPercent ?? null,
        maxDiscountCap: dto.maxDiscountCap ?? null,
        sortOrder: dto.sortOrder ?? 100,
        isActive: dto.isActive ?? true,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_PRICING_TIER_CREATE",
      entity: "PatientPricingTier",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async listTiers(
    principal: Principal,
    q: { branchId?: string | null; q?: string; kind?: string; includeInactive?: boolean; take?: number },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    const where: any = { branchId };

    if (!q.includeInactive) where.isActive = true;
    if (q.kind) where.kind = q.kind;
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: "insensitive" } },
        { code: { contains: q.q, mode: "insensitive" } },
      ];
    }

    return this.ctx.prisma.patientPricingTier.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: q.take && Number.isFinite(q.take) ? Math.min(Math.max(q.take, 1), 500) : 200,
      include: { _count: { select: { tierRates: true } } },
    });
  }

  async getTier(principal: Principal, id: string) {
    const row = await this.ctx.prisma.patientPricingTier.findUnique({
      where: { id },
      include: {
        tierRates: {
          orderBy: { createdAt: "desc" },
          take: 200,
          include: {
            serviceItem: { select: { id: true, code: true, name: true } },
            chargeMasterItem: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Pricing tier not found");

    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  async updateTier(principal: Principal, id: string, dto: UpdatePricingTierDto) {
    const existing = await this.ctx.prisma.patientPricingTier.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Pricing tier not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.patientPricingTier.update({
      where: { id },
      data: {
        kind: dto.kind ? (dto.kind as any) : undefined,
        name: dto.name?.trim(),
        code: dto.code ? canonicalizeCode(dto.code) : undefined,
        description: dto.description === undefined ? undefined : (dto.description ?? null),
        assignmentRules: dto.assignmentRules === undefined ? undefined : (dto.assignmentRules ?? undefined),
        defaultDiscountPercent:
          dto.defaultDiscountPercent === undefined ? undefined : (dto.defaultDiscountPercent ?? null),
        defaultMarkupPercent:
          dto.defaultMarkupPercent === undefined ? undefined : (dto.defaultMarkupPercent ?? null),
        maxDiscountCap: dto.maxDiscountCap === undefined ? undefined : (dto.maxDiscountCap ?? null),
        sortOrder: dto.sortOrder ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_PRICING_TIER_UPDATE",
      entity: "PatientPricingTier",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  async deactivateTier(principal: Principal, id: string) {
    const existing = await this.ctx.prisma.patientPricingTier.findUnique({
      where: { id },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!existing) throw new NotFoundException("Pricing tier not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    if (!existing.isActive) {
      return this.ctx.prisma.patientPricingTier.findUnique({ where: { id } });
    }

    const updated = await this.ctx.prisma.patientPricingTier.update({
      where: { id },
      data: { isActive: false },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_PRICING_TIER_DEACTIVATE",
      entity: "PatientPricingTier",
      entityId: id,
      meta: {},
    });

    return updated;
  }

  // ── Tier Rates (nested CRUD) ──

  async addTierRate(principal: Principal, tierId: string, dto: UpsertTierRateDto) {
    const tier = await this.ctx.prisma.patientPricingTier.findUnique({
      where: { id: tierId },
      select: { id: true, branchId: true },
    });
    if (!tier) throw new NotFoundException("Pricing tier not found");

    this.ctx.resolveBranchId(principal, tier.branchId);

    return this.ctx.prisma.patientPricingTierRate.create({
      data: {
        tierId,
        serviceItemId: dto.serviceItemId ?? null,
        chargeMasterItemId: dto.chargeMasterItemId ?? null,
        rateAmount: dto.rateAmount ?? null,
        discountPercent: dto.discountPercent ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listTierRates(principal: Principal, tierId: string) {
    const tier = await this.ctx.prisma.patientPricingTier.findUnique({
      where: { id: tierId },
      select: { id: true, branchId: true },
    });
    if (!tier) throw new NotFoundException("Pricing tier not found");

    this.ctx.resolveBranchId(principal, tier.branchId);

    return this.ctx.prisma.patientPricingTierRate.findMany({
      where: { tierId },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        serviceItem: { select: { id: true, code: true, name: true } },
        chargeMasterItem: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async deleteTierRate(principal: Principal, tierId: string, rateId: string) {
    const rate = await this.ctx.prisma.patientPricingTierRate.findFirst({
      where: { id: rateId, tierId },
      include: { tier: { select: { branchId: true } } },
    });
    if (!rate) throw new NotFoundException("Tier rate not found");

    this.ctx.resolveBranchId(principal, rate.tier.branchId);

    await this.ctx.prisma.patientPricingTierRate.delete({ where: { id: rateId } });
    return { deleted: true };
  }
}
