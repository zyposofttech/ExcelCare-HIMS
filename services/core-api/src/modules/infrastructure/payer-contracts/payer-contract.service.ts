import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreatePayerContractDto, UpdatePayerContractDto, UpsertContractRateDto } from "./dto";
import { canonicalizeCode } from "../../../common/naming.util";

@Injectable()
export class PayerContractService {
  constructor(private readonly ctx: InfraContextService) {}

  private async assertPayer(branchId: string, payerId: string) {
    const payer = await this.ctx.prisma.payer.findFirst({
      where: { id: payerId, branchId, isActive: true },
      select: { id: true },
    });
    if (!payer) throw new BadRequestException("Invalid payerId for this branch");
    return payerId;
  }

  private async assertTariffPlan(branchId: string, tariffPlanId?: string | null) {
    if (!tariffPlanId) return null;
    const plan = await this.ctx.prisma.tariffPlan.findFirst({
      where: { id: tariffPlanId, branchId },
      select: { id: true },
    });
    if (!plan) throw new BadRequestException("Invalid tariffPlanId for this branch");
    return tariffPlanId;
  }

  async createContract(principal: Principal, dto: CreatePayerContractDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const code = canonicalizeCode(dto.code);

    await this.assertPayer(branchId, dto.payerId);
    if (dto.tariffPlanId) await this.assertTariffPlan(branchId, dto.tariffPlanId);

    const created = await this.ctx.prisma.payerContract.create({
      data: {
        branchId,
        payerId: dto.payerId,
        code,
        name: dto.name.trim(),
        description: dto.description ?? null,
        status: (dto.status as any) ?? "DRAFT",
        startAt: new Date(dto.startDate),
        endAt: dto.endDate ? new Date(dto.endDate) : null,
        priority: dto.priority ?? 100,
        pricingStrategy: dto.pricingStrategy ? (dto.pricingStrategy as any) : null,
        globalDiscountPercent: dto.globalDiscountPercent ?? null,
        emergencyLoadingPercent: dto.emergencyLoadingPercent ?? null,
        afterHoursLoadingPercent: dto.afterHoursLoadingPercent ?? null,
        weekendLoadingPercent: dto.weekendLoadingPercent ?? null,
        statLoadingPercent: dto.statLoadingPercent ?? null,
        copaymentRules: dto.copaymentRules ?? undefined,
        excludedServiceIds: dto.excludedServiceIds ?? [],
        excludedCategories: dto.excludedCategories ?? [],
        gracePeriodDays: dto.gracePeriodDays ?? null,
        autoRenewal: dto.autoRenewal ?? false,
        ...(dto.tariffPlanId ? { tariffPlans: { connect: { id: dto.tariffPlanId } } } : {}),
      },
      include: {
        payer: { select: { id: true, name: true, code: true } },
        tariffPlans: { select: { id: true, name: true }, take: 10 },
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_PAYER_CONTRACT_CREATE",
      entity: "PayerContract",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async listContracts(
    principal: Principal,
    q: {
      branchId?: string | null;
      q?: string;
      payerId?: string;
      status?: string;
      includeInactive?: boolean;
      take?: number;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    const where: any = { branchId };

    if (q.payerId) where.payerId = q.payerId;
    if (q.status) where.status = q.status;
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: "insensitive" } },
        { code: { contains: q.q, mode: "insensitive" } },
      ];
    }

    return this.ctx.prisma.payerContract.findMany({
      where,
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      take: q.take && Number.isFinite(q.take) ? Math.min(Math.max(q.take, 1), 500) : 200,
      include: {
        payer: { select: { id: true, name: true, code: true, kind: true } },
        tariffPlans: { select: { id: true, name: true }, take: 10 },
        _count: { select: { contractRates: true } },
      },
    });
  }

  async getContract(principal: Principal, id: string) {
    const row = await this.ctx.prisma.payerContract.findUnique({
      where: { id },
      include: {
        payer: true,
        tariffPlans: { select: { id: true, name: true, code: true } },
        contractRates: { orderBy: { createdAt: "desc" }, take: 200 },
      },
    });
    if (!row) throw new NotFoundException("Payer contract not found");

    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  async updateContract(principal: Principal, id: string, dto: UpdatePayerContractDto) {
    const existing = await this.ctx.prisma.payerContract.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Payer contract not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.payerContract.update({
      where: { id },
      data: {
        code: dto.code ? canonicalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : (dto.description ?? null),
        status: dto.status ? (dto.status as any) : undefined,
        startAt: dto.startDate ? new Date(dto.startDate) : undefined,
        endAt: dto.endDate === undefined ? undefined : dto.endDate ? new Date(dto.endDate) : null,
        priority: dto.priority ?? undefined,
        pricingStrategy: dto.pricingStrategy === undefined ? undefined : dto.pricingStrategy ? (dto.pricingStrategy as any) : null,
        globalDiscountPercent: dto.globalDiscountPercent === undefined ? undefined : (dto.globalDiscountPercent ?? null),
        emergencyLoadingPercent: dto.emergencyLoadingPercent === undefined ? undefined : (dto.emergencyLoadingPercent ?? null),
        afterHoursLoadingPercent: dto.afterHoursLoadingPercent === undefined ? undefined : (dto.afterHoursLoadingPercent ?? null),
        weekendLoadingPercent: dto.weekendLoadingPercent === undefined ? undefined : (dto.weekendLoadingPercent ?? null),
        statLoadingPercent: dto.statLoadingPercent === undefined ? undefined : (dto.statLoadingPercent ?? null),
        copaymentRules: dto.copaymentRules === undefined ? undefined : (dto.copaymentRules ?? undefined),
        excludedServiceIds: dto.excludedServiceIds ?? undefined,
        excludedCategories: dto.excludedCategories ?? undefined,
        approvalStatus: dto.approvalStatus === undefined ? undefined : (dto.approvalStatus ?? null),
        gracePeriodDays: dto.gracePeriodDays === undefined ? undefined : (dto.gracePeriodDays ?? null),
        autoRenewal: dto.autoRenewal ?? undefined,
      },
      include: {
        payer: { select: { id: true, name: true, code: true } },
        tariffPlans: { select: { id: true, name: true }, take: 10 },
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_PAYER_CONTRACT_UPDATE",
      entity: "PayerContract",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  async deactivateContract(principal: Principal, id: string) {
    const existing = await this.ctx.prisma.payerContract.findUnique({
      where: { id },
      select: { id: true, branchId: true, status: true },
    });
    if (!existing) throw new NotFoundException("Payer contract not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.payerContract.update({
      where: { id },
      data: { status: "TERMINATED" },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_PAYER_CONTRACT_DEACTIVATE",
      entity: "PayerContract",
      entityId: id,
      meta: {},
    });

    return updated;
  }

  // ── Contract Rates (nested CRUD) ──

  async addContractRate(principal: Principal, contractId: string, dto: UpsertContractRateDto) {
    const contract = await this.ctx.prisma.payerContract.findUnique({
      where: { id: contractId },
      select: { id: true, branchId: true },
    });
    if (!contract) throw new NotFoundException("Payer contract not found");

    this.ctx.resolveBranchId(principal, contract.branchId);

    const rate = await this.ctx.prisma.contractServiceRate.create({
      data: {
        contractId,
        serviceItemId: dto.serviceItemId ?? null,
        packageId: dto.packageId ?? null,
        chargeMasterItemId: dto.chargeMasterItemId ?? null,
        category: dto.category ?? null,
        rateType: dto.rateType as any,
        fixedPrice: dto.fixedPrice ?? null,
        percentageOfBase: dto.percentageOfBase ?? null,
        discountPercent: dto.discountPercent ?? null,
        minPrice: dto.minPrice ?? null,
        maxPrice: dto.maxPrice ?? null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        isActive: dto.isActive ?? true,
      },
    });

    return rate;
  }

  async listContractRates(principal: Principal, contractId: string) {
    const contract = await this.ctx.prisma.payerContract.findUnique({
      where: { id: contractId },
      select: { id: true, branchId: true },
    });
    if (!contract) throw new NotFoundException("Payer contract not found");

    this.ctx.resolveBranchId(principal, contract.branchId);

    return this.ctx.prisma.contractServiceRate.findMany({
      where: { contractId },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        serviceItem: { select: { id: true, code: true, name: true } },
        pkg: { select: { id: true, code: true, name: true } },
        chargeMasterItem: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateContractRate(principal: Principal, contractId: string, rateId: string, dto: UpsertContractRateDto) {
    const rate = await this.ctx.prisma.contractServiceRate.findFirst({
      where: { id: rateId, contractId },
      include: { contract: { select: { branchId: true } } },
    });
    if (!rate) throw new NotFoundException("Contract rate not found");

    this.ctx.resolveBranchId(principal, rate.contract.branchId);

    return this.ctx.prisma.contractServiceRate.update({
      where: { id: rateId },
      data: {
        rateType: dto.rateType ? (dto.rateType as any) : undefined,
        fixedPrice: dto.fixedPrice === undefined ? undefined : (dto.fixedPrice ?? null),
        percentageOfBase: dto.percentageOfBase === undefined ? undefined : (dto.percentageOfBase ?? null),
        discountPercent: dto.discountPercent === undefined ? undefined : (dto.discountPercent ?? null),
        minPrice: dto.minPrice === undefined ? undefined : (dto.minPrice ?? null),
        maxPrice: dto.maxPrice === undefined ? undefined : (dto.maxPrice ?? null),
        effectiveTo: dto.effectiveTo === undefined ? undefined : dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        isActive: dto.isActive ?? undefined,
      },
    });
  }

  async deleteContractRate(principal: Principal, contractId: string, rateId: string) {
    const rate = await this.ctx.prisma.contractServiceRate.findFirst({
      where: { id: rateId, contractId },
      include: { contract: { select: { branchId: true } } },
    });
    if (!rate) throw new NotFoundException("Contract rate not found");

    this.ctx.resolveBranchId(principal, rate.contract.branchId);

    await this.ctx.prisma.contractServiceRate.delete({ where: { id: rateId } });
    return { deleted: true };
  }
}
