import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { UpsertInfraTariffRateDto, UpdateInfraTariffRateDto } from "./dto";

@Injectable()
export class TariffPlansService {
  constructor(private readonly ctx: InfraContextService) {}

  // -------- Plans

  async listTariffPlans(
    principal: Principal,
    q: {
      branchId?: string | null;
      kind?: string;
      status?: string;
      q?: string;
      includeInactive?: boolean;
      includeRefs?: boolean;
      take?: number;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);

    const where: any = { branchId };

    if (q.kind) where.kind = q.kind as any;
    if (q.status) where.status = q.status as any;

    const search = (q.q ?? "").trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    if (!q.includeInactive) {
      where.status = where.status ?? { not: "RETIRED" };
    }

    return this.ctx.prisma.tariffPlan.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      take: q.take ? Math.min(Math.max(q.take, 1), 500) : 200,
      include: q.includeRefs ? { payer: true, contract: true } : undefined,
    });
  }

  async createTariffPlan(principal: Principal, dto: any, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);

    const code = String(dto.code ?? "").trim().toUpperCase();
    const name = String(dto.name ?? "").trim();

    if (!code || !name) throw new BadRequestException("code and name are required");

    const dup = await this.ctx.prisma.tariffPlan.findFirst({ where: { branchId, code }, select: { id: true } });
    if (dup) throw new ConflictException("Tariff plan code already exists for this branch");

    return this.ctx.prisma.tariffPlan.create({
      data: {
        branchId,
        code,
        name,
        description: dto.description ?? null,
        currency: (dto.currency ?? "INR").toUpperCase(),
        kind: (dto.kind as any) ?? "CASH",
        status: (dto.status as any) ?? "DRAFT",
        payerId: dto.payerId ?? null,
        contractId: dto.contractId ?? null,
        isTaxInclusive: dto.isTaxInclusive ?? false,
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async updateTariffPlan(principal: Principal, id: string, dto: any) {
    const existing = await this.ctx.prisma.tariffPlan.findUnique({ where: { id }, select: { id: true, branchId: true } });
    if (!existing) throw new NotFoundException("Tariff plan not found");

    this.ctx.resolveBranchId(principal, existing.branchId);

    const code = dto.code ? String(dto.code).trim().toUpperCase() : undefined;
    if (code) {
      const dup = await this.ctx.prisma.tariffPlan.findFirst({
        where: { branchId: existing.branchId, code, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw new ConflictException("Tariff plan code already exists for this branch");
    }

    return this.ctx.prisma.tariffPlan.update({
      where: { id },
      data: {
        code,
        name: dto.name ? String(dto.name).trim() : undefined,
        description: dto.description === undefined ? undefined : (dto.description ?? null),
        currency: dto.currency ? String(dto.currency).toUpperCase() : undefined,
        kind: dto.kind === undefined ? undefined : (dto.kind as any),
        status: dto.status === undefined ? undefined : (dto.status as any),
        payerId: dto.payerId === undefined ? undefined : (dto.payerId ?? null),
        contractId: dto.contractId === undefined ? undefined : (dto.contractId ?? null),
        isTaxInclusive: dto.isTaxInclusive === undefined ? undefined : dto.isTaxInclusive,
        isActive: dto.isActive === undefined ? undefined : dto.isActive,
        isDefault: dto.isDefault === undefined ? undefined : dto.isDefault,
      },
    });
  }

  async retireTariffPlan(principal: Principal, id: string) {
    const existing = await this.ctx.prisma.tariffPlan.findUnique({ where: { id }, select: { id: true, branchId: true } });
    if (!existing) throw new NotFoundException("Tariff plan not found");
    this.ctx.resolveBranchId(principal, existing.branchId);

    return this.ctx.prisma.tariffPlan.update({
      where: { id },
      data: { status: "RETIRED" as any, isActive: false, effectiveTo: new Date() },
    });
  }

  // -------- Rates

  async listTariffRates(
    principal: Principal,
    tariffPlanId: string,
    q: { chargeMasterItemId?: string; includeHistory?: boolean; includeRefs?: boolean },
  ) {
    const plan = await this.ctx.prisma.tariffPlan.findUnique({
      where: { id: tariffPlanId },
      select: { id: true, branchId: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.ctx.resolveBranchId(principal, plan.branchId);

    const where: any = { tariffPlanId };
    if (q.chargeMasterItemId) where.chargeMasterItemId = q.chargeMasterItemId;

    if (!q.includeHistory) {
      where.effectiveTo = null;
      where.isActive = true;
    }

    return this.ctx.prisma.tariffRate.findMany({
      where,
      orderBy: [{ chargeMasterItemId: "asc" }, { version: "desc" }],
      include: q.includeRefs ? { chargeMasterItem: true, taxCode: true } : undefined,
    });
  }

  async upsertTariffRate(principal: Principal, dto: UpsertInfraTariffRateDto) {
    const tariffPlanId = String(dto.tariffPlanId ?? "").trim();
    if (!tariffPlanId) throw new BadRequestException("tariffPlanId is required");

    const plan = await this.ctx.prisma.tariffPlan.findUnique({
      where: { id: tariffPlanId },
      select: { id: true, branchId: true, status: true, currency: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.ctx.resolveBranchId(principal, plan.branchId);

    const cm = await this.ctx.prisma.chargeMasterItem.findFirst({
      where: { id: dto.chargeMasterItemId, branchId: plan.branchId },
      select: { id: true },
    });
    if (!cm) throw new BadRequestException("chargeMasterItemId must belong to this branch");

    // Validate taxCodeId if provided
    if (dto.taxCodeId) {
      const tx = await this.ctx.prisma.taxCode.findFirst({
        where: { id: dto.taxCodeId, branchId: plan.branchId, isActive: true },
        select: { id: true },
      });
      if (!tx) throw new BadRequestException("taxCodeId must be ACTIVE and belong to this branch");
    }

    const rateAmount = (dto as any).rateAmount ?? (dto as any).amount;
    if (rateAmount === undefined || rateAmount === null) throw new BadRequestException("rateAmount is required");

    const currency = (dto.currency ?? plan.currency ?? "INR").toUpperCase();

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    if (Number.isNaN(effectiveFrom.getTime())) throw new BadRequestException("Invalid effectiveFrom");

    const effectiveTo =
      dto.effectiveTo === undefined ? undefined : dto.effectiveTo === null || dto.effectiveTo === "" ? null : new Date(dto.effectiveTo);
    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) throw new BadRequestException("Invalid effectiveTo");

    // If plan is not DRAFT, enforce versioned change: close current open rate and create new version
    const mustVersion = plan.status !== ("DRAFT" as any);

    // Find current open active rate (if any)
    const current = await this.ctx.prisma.tariffRate.findFirst({
      where: {
        tariffPlanId,
        chargeMasterItemId: cm.id,
        effectiveTo: null,
        isActive: true,
      },
      orderBy: [{ version: "desc" }],
      select: { id: true, version: true, effectiveFrom: true },
    });

    let version = dto.version ?? (current ? current.version : 0) + 1;
    if (!mustVersion && dto.version) version = dto.version;

    // If there is a current open rate, auto-close it when creating new version
    if (current && (mustVersion || version > current.version)) {
      await this.ctx.prisma.tariffRate.update({
        where: { id: current.id },
        data: { effectiveTo: effectiveFrom, isActive: false },
      });
    }

    // Upsert by (plan,item,version) — migration created this unique
    return this.ctx.prisma.tariffRate.upsert({
      where: {
        tariffPlanId_chargeMasterItemId_version: {
          tariffPlanId,
          chargeMasterItemId: cm.id,
          version,
        } as any,
      },
      update: {
        rateAmount: rateAmount as any,
        currency,
        taxCodeId: dto.taxCodeId ?? null,
        isTaxInclusive: dto.isTaxInclusive ?? undefined,
        effectiveFrom,
        effectiveTo,
        rules: dto.rules === undefined ? undefined : (dto.rules as any),
        notes: dto.notes === undefined ? undefined : dto.notes,
        isActive: effectiveTo ? false : true,
      },
      create: {
        tariffPlanId,
        chargeMasterItemId: cm.id,
        serviceCode: dto.serviceCode ?? null,
        rateAmount: rateAmount as any,
        currency,
        version,
        taxCodeId: dto.taxCodeId ?? null,
        isTaxInclusive: dto.isTaxInclusive ?? false,
        effectiveFrom,
        effectiveTo,
        rules: dto.rules === undefined ? undefined : (dto.rules as any),
        notes: dto.notes ?? null,
        isActive: effectiveTo ? false : true,
        createdByUserId: principal.userId,
      },
      include: { chargeMasterItem: true, taxCode: true },
    });
  }

  async updateTariffRateById(principal: Principal, id: string, dto: UpdateInfraTariffRateDto) {
    const rate = await this.ctx.prisma.tariffRate.findUnique({
      where: { id },
      select: { id: true, tariffPlanId: true },
    });
    if (!rate) throw new NotFoundException("TariffRate not found");

    const plan = await this.ctx.prisma.tariffPlan.findUnique({
      where: { id: rate.tariffPlanId },
      select: { id: true, branchId: true, status: true, currency: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.ctx.resolveBranchId(principal, plan.branchId);

    if (plan.status !== ("DRAFT" as any)) {
      throw new BadRequestException("Only DRAFT plans can edit an existing rate. Create a new version instead.");
    }

    if (dto.taxCodeId) {
      const tx = await this.ctx.prisma.taxCode.findFirst({
        where: { id: dto.taxCodeId, branchId: plan.branchId, isActive: true },
        select: { id: true },
      });
      if (!tx) throw new BadRequestException("taxCodeId must be ACTIVE and belong to this branch");
    }

    const rateAmount = (dto as any).rateAmount ?? (dto as any).amount;
    const currency = (dto.currency ?? plan.currency ?? "INR").toUpperCase();

    const effFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined;
    if (effFrom && Number.isNaN(effFrom.getTime())) throw new BadRequestException("Invalid effectiveFrom");

    const effTo = dto.effectiveTo ? new Date(dto.effectiveTo) : dto.effectiveTo === null ? null : undefined;
    if (effTo && Number.isNaN(effTo.getTime())) throw new BadRequestException("Invalid effectiveTo");

    return this.ctx.prisma.tariffRate.update({
      where: { id },
      data: {
        rateAmount: rateAmount === undefined ? undefined : (rateAmount as any),
        currency: dto.currency === undefined ? undefined : currency,
        taxCodeId: dto.taxCodeId === undefined ? undefined : (dto.taxCodeId ?? null),
        isTaxInclusive: dto.isTaxInclusive === undefined ? undefined : dto.isTaxInclusive,
        effectiveFrom: effFrom,
        effectiveTo: effTo,
        rules: dto.rules === undefined ? undefined : (dto.rules as any),
        notes: dto.notes === undefined ? undefined : dto.notes,
        isActive: effTo === null ? true : effTo ? false : undefined,
      },
      include: { chargeMasterItem: true, taxCode: true },
    });
  }

  async closeTariffRateById(principal: Principal, id: string, effectiveToIso: string) {
    const rate = await this.ctx.prisma.tariffRate.findUnique({
      where: { id },
      select: { id: true, tariffPlanId: true, effectiveFrom: true, effectiveTo: true },
    });
    if (!rate) throw new NotFoundException("TariffRate not found");

    const plan = await this.ctx.prisma.tariffPlan.findUnique({
      where: { id: rate.tariffPlanId },
      select: { id: true, branchId: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.ctx.resolveBranchId(principal, plan.branchId);

    if (rate.effectiveTo) return rate;

    const effectiveTo = new Date(effectiveToIso);
    if (Number.isNaN(effectiveTo.getTime())) throw new BadRequestException("Invalid effectiveTo");
    if (effectiveTo < rate.effectiveFrom) throw new BadRequestException("effectiveTo cannot be before effectiveFrom");

    return this.ctx.prisma.tariffRate.update({
      where: { id },
      data: { effectiveTo, isActive: false },
    });
  }

  async deactivateTariffRateById(principal: Principal, id: string) {
    const rate = await this.ctx.prisma.tariffRate.findUnique({
      where: { id },
      select: { id: true, tariffPlanId: true },
    });
    if (!rate) throw new NotFoundException("TariffRate not found");

    const plan = await this.ctx.prisma.tariffPlan.findUnique({
      where: { id: rate.tariffPlanId },
      select: { id: true, branchId: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.ctx.resolveBranchId(principal, plan.branchId);

    return this.ctx.prisma.tariffRate.update({
      where: { id },
      data: { isActive: false, effectiveTo: new Date() },
    });
  }
}
