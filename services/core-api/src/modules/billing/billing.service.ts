import { BadRequestException, Inject, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@zypocare/db";
import type { Principal } from "../auth/access-policy.service";
import { resolveBranchId as resolveBranchIdCommon } from "../../common/branch-scope.util";
import { AuditService } from "../audit/audit.service";
import { canonicalizeCode } from "../../common/naming.util";
import type { ActivateTariffPlanDto, CreateTariffPlanDto, UpdateTariffPlanDto, UpsertTariffRateDto, CreateTaxCodeDto, UpdateTaxCodeDto,SetDefaultTariffPlanDto  } from "./dto";

@Injectable()
export class BillingService {
  constructor(
    @Inject("PRISMA") private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) { }

  private resolveBranchId(principal: Principal, requestedBranchId?: string | null) {
    // Standardized branch resolution for billing: GLOBAL must provide branchId
    return resolveBranchIdCommon(principal, requestedBranchId ?? null, { requiredForGlobal: true });
  }

  private static readonly mappedServiceChargeSelect = {
    serviceItemId: true,
    serviceItem: { select: { id: true, code: true, name: true, chargeUnit: true } },
  } satisfies Prisma.ServiceChargeMappingSelect;
  async listTaxCodes(
    principal: Principal,
    opts: { branchId?: string | null; q?: string; includeInactive?: boolean; take?: number },
  ) {
    const branchId = this.resolveBranchId(principal, opts.branchId ?? null);

    const where: any = { branchId };
    if (!opts.includeInactive) where.isActive = true;

    const query = (opts.q ?? "").trim();
    if (query) {
      where.OR = [
        { code: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
        { hsnSac: { contains: query, mode: "insensitive" } },
      ];
    }

    return this.prisma.taxCode.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      take: opts.take ? Math.min(Math.max(opts.take, 1), 500) : 200,
    });
  }
  async createTaxCode(principal: Principal, dto: CreateTaxCodeDto, branchIdParam?: string | null) {
    const requested = (branchIdParam ?? dto.branchId ?? null);
    const branchId = this.resolveBranchId(principal, requested);

    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    if (!code || !name) throw new BadRequestException("code and name are required");

    try {
      return await this.prisma.taxCode.create({
        data: {
          branchId,
          code,
          name,
          taxType: (dto.taxType as any) ?? "GST",
          ratePercent: dto.ratePercent as any,
          components: dto.components ?? undefined,
          hsnSac:
            dto.hsnSac === undefined
              ? undefined
              : dto.hsnSac === null || String(dto.hsnSac).trim() === ""
                ? null
                : String(dto.hsnSac).trim(),
          isActive: dto.isActive ?? true,
        },
      });
    } catch (e: any) {
      if (String(e?.code) === "P2002") throw new ConflictException("Tax code already exists for this branch");
      throw e;
    }
  }

  async updateTaxCode(principal: Principal, id: string, dto: UpdateTaxCodeDto) {
    const existing = await this.prisma.taxCode.findUnique({
      where: { id },
      select: { id: true, branchId: true, code: true },
    });
    if (!existing) throw new NotFoundException("Tax code not found");

    // enforce scoping
    this.resolveBranchId(principal, existing.branchId);

    const nextCode = dto.code ? dto.code.trim().toUpperCase() : undefined;
    if (nextCode && nextCode !== existing.code) {
      const dup = await this.prisma.taxCode.findFirst({
        where: { branchId: existing.branchId, code: nextCode },
        select: { id: true },
      });
      if (dup) throw new ConflictException("Tax code already exists for this branch");
    }

    const hsn =
      dto.hsnSac === undefined
        ? undefined
        : dto.hsnSac === null || String(dto.hsnSac).trim() === ""
          ? null
          : String(dto.hsnSac).trim();

    return this.prisma.taxCode.update({
      where: { id },
      data: {
        code: nextCode,
        name: dto.name?.trim(),
        taxType: dto.taxType as any,
        ratePercent: dto.ratePercent === undefined ? undefined : (dto.ratePercent as any),
        components: dto.components === undefined ? undefined : (dto.components as any),
        hsnSac: hsn,
        isActive: dto.isActive === undefined ? undefined : dto.isActive,
      },
    });
  }

  async deactivateTaxCode(principal: Principal, id: string) {
    const existing = await this.prisma.taxCode.findUnique({
      where: { id },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!existing) throw new NotFoundException("Tax code not found");

    // enforce scoping
    this.resolveBranchId(principal, existing.branchId);

    if (!existing.isActive) return existing;
    return this.prisma.taxCode.update({ where: { id }, data: { isActive: false } });
  }
  // ---------------- Tariff Plans ----------------

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
    const branchId = this.resolveBranchId(principal, q.branchId ?? null);

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
      // Hide retired by default
      where.status = where.status ?? { not: "RETIRED" };
    }

    return this.prisma.tariffPlan.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      take: q.take ? Math.min(Math.max(q.take, 1), 500) : 200,
      include: q.includeRefs ? { payer: true, contract: true } : undefined,
    });
  }


  async getTariffPlan(principal: Principal, id: string) {
    const plan = await this.prisma.tariffPlan.findUnique({
      where: { id },
      include: { payer: true, contract: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.resolveBranchId(principal, plan.branchId);
    return plan;
  }

  async createTariffPlan(principal: Principal, dto: CreateTariffPlanDto) {
    const branchId = this.resolveBranchId(principal, dto.branchId ?? null);

    const kind = (dto.kind ?? "PRICE_LIST") as any;
    const code = dto.code ? canonicalizeCode(dto.code) : `TPL-${Date.now()}`;
    const name = dto.name.trim();

    if (kind === "PAYER_CONTRACT") {
      if (!dto.contractId) throw new BadRequestException("contractId is required for PAYER_CONTRACT plan");
      // payerId is optional but recommended; validate if present
      if (dto.payerId) {
        const payer = await this.prisma.payer.findFirst({ where: { id: dto.payerId, branchId }, select: { id: true } });
        if (!payer) throw new BadRequestException("Invalid payerId for this branch");
      }
      const contract = await this.prisma.payerContract.findFirst({
        where: { id: dto.contractId, branchId },
        select: { id: true },
      });
      if (!contract) throw new BadRequestException("Invalid contractId for this branch");
    }

    const created = await this.prisma.tariffPlan.create({
      data: {
        branchId,
        code,
        name,
        kind,
        payerId: dto.payerId ?? null,
        contractId: dto.contractId ?? null,
        currency: (dto.currency ?? "INR").toUpperCase(),
        isTaxInclusive: dto.isTaxInclusive ?? false,
        status: "DRAFT" as any,
      },
    });

    await this.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_TARIFF_PLAN_CREATE",
      entity: "TariffPlan",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async updateTariffPlan(principal: Principal, id: string, dto: UpdateTariffPlanDto) {
    const plan = await this.prisma.tariffPlan.findUnique({ where: { id }, select: { id: true, branchId: true, status: true } });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.resolveBranchId(principal, plan.branchId);

    if (plan.status !== ("DRAFT" as any)) {
      throw new BadRequestException("Only DRAFT plans can be updated");
    }

    const updated = await this.prisma.tariffPlan.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        currency: dto.currency ? dto.currency.toUpperCase() : undefined,
        isTaxInclusive: dto.isTaxInclusive ?? undefined,
      },
    });

    await this.audit.log({
      branchId: plan.branchId,
      actorUserId: principal.userId,
      action: "BILLING_TARIFF_PLAN_UPDATE",
      entity: "TariffPlan",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  /**
   * Activates a plan and closes any existing ACTIVE plan in the same scope:
   * - PRICE_LIST: closes other ACTIVE PRICE_LIST in the branch
   * - PAYER_CONTRACT: closes other ACTIVE plans for same contractId
   */
  async activateTariffPlan(principal: Principal, id: string, dto: ActivateTariffPlanDto) {
    const plan = await this.prisma.tariffPlan.findUnique({
      where: { id },
      select: { id: true, branchId: true, status: true, kind: true, contractId: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.resolveBranchId(principal, plan.branchId);

    if (plan.status === ("RETIRED" as any)) throw new BadRequestException("Cannot activate a RETIRED plan");

    const effFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    if (Number.isNaN(effFrom.getTime())) throw new BadRequestException("Invalid effectiveFrom");

    // Close existing active plan(s) in the scope
    const scopeWhere: any =
      plan.kind === ("PRICE_LIST" as any)
        ? { branchId: plan.branchId, kind: "PRICE_LIST", status: "ACTIVE" }
        : { branchId: plan.branchId, kind: "PAYER_CONTRACT", contractId: plan.contractId, status: "ACTIVE" };

    await this.prisma.tariffPlan.updateMany({
      where: { ...scopeWhere, id: { not: plan.id } },
      data: { status: "RETIRED" as any, effectiveTo: effFrom, isDefault: false },
    });

    const activated = await this.prisma.tariffPlan.update({
      where: { id: plan.id },
      data: { status: "ACTIVE" as any, effectiveFrom: effFrom, effectiveTo: null },
    });

    await this.audit.log({
      branchId: plan.branchId,
      actorUserId: principal.userId,
      action: "BILLING_TARIFF_PLAN_ACTIVATE",
      entity: "TariffPlan",
      entityId: plan.id,
      meta: { ...dto, effectiveFrom: effFrom.toISOString() },
    });

    return activated;
  }

  async retireTariffPlan(principal: Principal, id: string) {
    const plan = await this.prisma.tariffPlan.findUnique({ where: { id }, select: { id: true, branchId: true } });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.resolveBranchId(principal, plan.branchId);

    const now = new Date();
    const retired = await this.prisma.tariffPlan.update({
      where: { id },
      data: { status: "RETIRED" as any, effectiveTo: now, isDefault: false },
    });

    await this.audit.log({
      branchId: plan.branchId,
      actorUserId: principal.userId,
      action: "BILLING_TARIFF_PLAN_RETIRE",
      entity: "TariffPlan",
      entityId: id,
      meta: { effectiveTo: now.toISOString() },
    });

    return retired;
  }
  async setTariffPlanDefault(principal: Principal, id: string, dto: SetDefaultTariffPlanDto) {
  const plan = await this.prisma.tariffPlan.findUnique({
    where: { id },
    select: { id: true, branchId: true, kind: true, contractId: true, status: true, isDefault: true },
  });
  if (!plan) throw new NotFoundException("TariffPlan not found");

  this.resolveBranchId(principal, plan.branchId);

  if (plan.status === ("RETIRED" as any)) {
    throw new BadRequestException("Cannot set default on a RETIRED plan");
  }

  const next = Boolean(dto?.isDefault);

  // No-op fast path
  if (next === Boolean(plan.isDefault)) return plan as any;

  if (!next) {
    const updated = await this.prisma.tariffPlan.update({ where: { id }, data: { isDefault: false } });
    await this.audit.log({
      branchId: plan.branchId,
      actorUserId: principal.userId,
      action: "BILLING_TARIFF_PLAN_CLEAR_DEFAULT",
      entity: "TariffPlan",
      entityId: id,
      meta: { isDefault: false },
    });
    return updated;
  }

  // Compute default scope
  const scopeWhere: any =
    plan.kind === ("PRICE_LIST" as any)
      ? { branchId: plan.branchId, kind: "PRICE_LIST" }
      : { branchId: plan.branchId, kind: "PAYER_CONTRACT", contractId: plan.contractId };

  const [, updated] = await this.prisma.$transaction([
    this.prisma.tariffPlan.updateMany({
      where: { ...scopeWhere, id: { not: plan.id }, status: { not: "RETIRED" as any } },
      data: { isDefault: false },
    }),
    this.prisma.tariffPlan.update({ where: { id: plan.id }, data: { isDefault: true } }),
  ]);

  await this.audit.log({
    branchId: plan.branchId,
    actorUserId: principal.userId,
    action: "BILLING_TARIFF_PLAN_SET_DEFAULT",
    entity: "TariffPlan",
    entityId: id,
    meta: { isDefault: true },
  });

  return updated;
}
  // ---------------- Tariff Rates ----------------

  async listTariffRates(
    principal: Principal,
    tariffPlanId: string,
    q: { chargeMasterItemId?: string; includeHistory?: boolean; includeRefs?: boolean },
  ) {
    const plan = await this.prisma.tariffPlan.findUnique({
      where: { id: tariffPlanId },
      select: { id: true, branchId: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.resolveBranchId(principal, plan.branchId);

    const where: any = { tariffPlanId };

    if (q.chargeMasterItemId) where.chargeMasterItemId = q.chargeMasterItemId;

    if (!q.includeHistory) {
      // only current / open rates
      where.effectiveTo = null;
      where.isActive = true;
    }

    return this.prisma.tariffRate.findMany({
      where,
      orderBy: [{ chargeMasterItemId: "asc" }, { version: "desc" }],
      include: q.includeRefs ? { chargeMasterItem: true, taxCode: true } : undefined,
    });
  }


  private async openFixIt(branchId: string, input: { type: any; entityType?: any; entityId?: string | null; title: string; details?: any; severity?: any }) {
    const exists = await this.prisma.fixItTask.findFirst({
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

    await this.prisma.fixItTask.create({
      data: {
        branchId,
        type: input.type,
        status: "OPEN" as any,
        severity: (input.severity ?? "BLOCKER") as any,
        entityType: (input.entityType ?? null) as any,
        entityId: input.entityId ?? null,
        title: input.title,
        details: input.details ?? undefined,
      },
    });
  }

  private async resolveFixIts(branchId: string, where: any) {
    await this.prisma.fixItTask.updateMany({
      where: {
        branchId,
        status: { in: ["OPEN", "IN_PROGRESS"] as any },
        ...where,
      },
      data: { status: "RESOLVED" as any, resolvedAt: new Date() },
    });
  }

  async upsertTariffRate(principal: Principal, dto: UpsertTariffRateDto, tariffPlanIdParam?: string) {
    const tariffPlanId = tariffPlanIdParam ?? dto.tariffPlanId;
    if (!tariffPlanId) throw new BadRequestException("tariffPlanId is required");

    const plan = await this.prisma.tariffPlan.findUnique({
      where: { id: tariffPlanId },
      select: { id: true, branchId: true, status: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.resolveBranchId(principal, plan.branchId);

    if (plan.status === ("RETIRED" as any)) throw new BadRequestException("Cannot modify rates on a RETIRED plan");

    const cm = await this.prisma.chargeMasterItem.findFirst({
      where: { id: dto.chargeMasterItemId, branchId: plan.branchId },
      select: { id: true, code: true, name: true, taxCodeId: true, chargeUnit: true },
    });
    if (!cm) throw new BadRequestException("Invalid chargeMasterItemId for this branch");

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    if (Number.isNaN(effectiveFrom.getTime())) throw new BadRequestException("Invalid effectiveFrom");

    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) throw new BadRequestException("Invalid effectiveTo");
    if (effectiveTo && effectiveTo <= effectiveFrom) throw new BadRequestException("effectiveTo must be after effectiveFrom");

    // If tax override provided, it MUST be ACTIVE (enforced)
    if (dto.taxCodeId) {
      const tx = await this.prisma.taxCode.findFirst({
        where: { id: dto.taxCodeId, branchId: plan.branchId, isActive: true },
        select: { id: true },
      });
      if (!tx) throw new BadRequestException("taxCodeId must refer to an ACTIVE TaxCode for this branch");
    }

    // Determine version
    let version = dto.version ?? null;
    if (!version) {
      const last = await this.prisma.tariffRate.findFirst({
        where: { tariffPlanId, chargeMasterItemId: cm.id },
        orderBy: [{ version: "desc" }],
        select: { version: true },
      });
      version = (last?.version ?? 0) + 1;
    }

    const existing = await this.prisma.tariffRate.findUnique({
      where: {
        tariffPlanId_chargeMasterItemId_version: {
          tariffPlanId,
          chargeMasterItemId: cm.id,
          version,
        } as any,
      },
      select: { id: true, effectiveFrom: true, effectiveTo: true },
    });

    // Overlap protection for new version inserts (Gap-4: effectiveTo closing)
    if (!existing) {
      const overlapEnd = effectiveTo ?? new Date("9999-12-31T00:00:00.000Z");

      const overlaps = await this.prisma.tariffRate.findMany({
        where: {
          tariffPlanId,
          chargeMasterItemId: cm.id,
          effectiveFrom: { lt: overlapEnd },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
        },
        select: { id: true, effectiveFrom: true, effectiveTo: true, version: true },
        orderBy: [{ effectiveFrom: "asc" }],
      });

      // If there is a future rate that starts after/at the new effectiveFrom -> block (would create overlap/out-of-order)
      const invalidFuture = overlaps.some((r) => r.effectiveFrom >= effectiveFrom);
      if (invalidFuture) {
        throw new BadRequestException("A future tariff rate already exists. Close/retire it before inserting an earlier effectiveFrom.");
      }

      // Close any open/overlapping previous rates (set effectiveTo = new effectiveFrom)
      const toClose = overlaps.filter((r) => !r.effectiveTo || r.effectiveTo > effectiveFrom);
      if (toClose.length > 0) {
        await this.prisma.tariffRate.updateMany({
          where: { id: { in: toClose.map((x) => x.id) } },
          data: { effectiveTo: effectiveFrom },
        });
      }
    } else {
      // Updates of an existing version only allowed in DRAFT plans (keeps audit sane)
      if (plan.status !== ("DRAFT" as any)) {
        throw new BadRequestException("Cannot edit an existing tariff version unless the plan is DRAFT (create a new version instead).");
      }
    }

    const rateAmount = (dto as any).rateAmount ?? (dto as any).amount;
    if (rateAmount === undefined || rateAmount === null) {
      throw new BadRequestException("rateAmount is required");
    }

    const currency = ((dto as any).currency ?? (await this.prisma.tariffPlan.findUnique({
      where: { id: tariffPlanId },
      select: { currency: true },
    }))?.currency ?? "INR").toUpperCase();

    const saved = await this.prisma.tariffRate.upsert({
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
        isTaxInclusive: dto.isTaxInclusive ?? undefined,
        effectiveFrom,
        effectiveTo,
        taxCodeId: dto.taxCodeId ?? null,
        rules: (dto as any).rules ?? undefined,
        notes: (dto as any).notes ?? undefined,
        isActive: dto.effectiveTo ? false : true,
      },
      create: {
        tariffPlanId,
        chargeMasterItemId: cm.id,
        serviceCode: (dto as any).serviceCode ?? null,
        rateAmount: rateAmount as any,
        currency,
        version,
        isTaxInclusive: dto.isTaxInclusive ?? false,
        effectiveFrom,
        effectiveTo,
        taxCodeId: dto.taxCodeId ?? null,
        rules: (dto as any).rules ?? undefined,
        notes: (dto as any).notes ?? undefined,
        isActive: dto.effectiveTo ? false : true,
        createdByUserId: principal.userId,
      },
    });

    // -------- FixIt: charge unit mismatch for services mapped to this charge master item
    // If any serviceItem.chargeUnit != cm.chargeUnit -> open CHARGE_UNIT_MISMATCH on the SERVICE_ITEM
    const mappedServices = (await this.prisma.serviceChargeMapping.findMany({
      where: {
        branchId: plan.branchId,
        chargeMasterItemId: cm.id,
        effectiveTo: null,
      },
      select: BillingService.mappedServiceChargeSelect,
      take: 50000,
    })) as unknown as Array<
      Prisma.ServiceChargeMappingGetPayload<{
        select: typeof BillingService.mappedServiceChargeSelect;
      }>
    >;

    for (const m of mappedServices) {
      const svc = m.serviceItem;
      if (!svc) continue;

      const isMismatch = svc.chargeUnit !== cm.chargeUnit;

      if (isMismatch) {
        // open if missing
        const exists = await this.prisma.fixItTask.findFirst({
          where: {
            branchId: plan.branchId,
            type: "CHARGE_UNIT_MISMATCH" as any,
            status: { in: ["OPEN", "IN_PROGRESS"] as any },
            entityType: "SERVICE_ITEM" as any,
            entityId: svc.id,
          } as any,
          select: { id: true },
        });

        if (!exists) {
          await this.prisma.fixItTask.create({
            data: {
              branchId: plan.branchId,
              type: "CHARGE_UNIT_MISMATCH" as any,
              status: "OPEN" as any,
              severity: "BLOCKER" as any,
              entityType: "SERVICE_ITEM" as any,
              entityId: svc.id,
              serviceItemId: svc.id,
              title: `Charge unit mismatch for ${svc.code}`,
              details: {
                serviceItemId: svc.id,
                serviceChargeUnit: svc.chargeUnit,
                chargeMasterItemId: cm.id,
                chargeMasterChargeUnit: cm.chargeUnit,
                tariffPlanId,
              },
            } as any,
          });
        }
      } else {
        // resolve
        await this.prisma.fixItTask.updateMany({
          where: {
            branchId: plan.branchId,
            type: "CHARGE_UNIT_MISMATCH" as any,
            status: { in: ["OPEN", "IN_PROGRESS"] as any },
            entityType: "SERVICE_ITEM" as any,
            entityId: svc.id,
          } as any,
          data: { status: "RESOLVED" as any, resolvedAt: new Date() } as any,
        });
      }
    }

    // -------- FixIt: auto-resolve tariff missing for this charge master item
    await this.resolveFixIts(plan.branchId, {
      type: "TARIFF_RATE_MISSING" as any,
      entityType: "CHARGE_MASTER_ITEM" as any,
      entityId: cm.id,
    });

    // -------- FixIt: tax code missing/inactive signals
    const effectiveTaxCodeId = (dto.taxCodeId ?? cm.taxCodeId) ?? null;

    if (!effectiveTaxCodeId) {
      await this.openFixIt(plan.branchId, {
        type: "TAX_CODE_MISSING" as any,
        entityType: "CHARGE_MASTER_ITEM" as any,
        entityId: cm.id,
        title: `Tax code missing for charge item ${cm.code}`,
        details: { chargeMasterItemId: cm.id, chargeMasterCode: cm.code, tariffPlanId },
        severity: "BLOCKER",
      });
    } else {
      const tx = await this.prisma.taxCode.findFirst({
        where: { id: effectiveTaxCodeId, branchId: plan.branchId },
        select: { id: true, code: true, isActive: true },
      });

      if (!tx || tx.isActive === false) {
        await this.openFixIt(plan.branchId, {
          type: "TAX_CODE_INACTIVE" as any,
          entityType: "TAX_CODE" as any,
          entityId: effectiveTaxCodeId,
          title: `Tax code inactive (${tx?.code ?? effectiveTaxCodeId})`,
          details: { chargeMasterItemId: cm.id, tariffPlanId, reason: "Used by tariff/charge master but inactive" },
          severity: "BLOCKER",
        });
      } else {
        // tax exists + active => resolve missing/inactive
        await this.resolveFixIts(plan.branchId, {
          type: "TAX_CODE_MISSING" as any,
          entityType: "CHARGE_MASTER_ITEM" as any,
          entityId: cm.id,
        });
        await this.resolveFixIts(plan.branchId, {
          type: "TAX_CODE_INACTIVE" as any,
          entityType: "TAX_CODE" as any,
          entityId: effectiveTaxCodeId,
        });
      }
    }

    await this.audit.log({
      branchId: plan.branchId,
      actorUserId: principal.userId,
      action: "BILLING_TARIFF_RATE_UPSERT",
      entity: "TariffRate",
      entityId: saved.id,
      meta: { ...dto, tariffPlanId, version },
    });

    return saved;
  }

  async closeCurrentTariffRate(principal: Principal, tariffPlanId: string, chargeMasterItemId: string, effectiveToIso: string) {
    const plan = await this.prisma.tariffPlan.findUnique({ where: { id: tariffPlanId }, select: { id: true, branchId: true } });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.resolveBranchId(principal, plan.branchId);

    const active = await this.prisma.tariffRate.findFirst({
      where: { tariffPlanId, chargeMasterItemId, effectiveTo: null },
      orderBy: [{ effectiveFrom: "desc" }],
      select: { id: true, effectiveFrom: true },
    });

    if (!active) throw new BadRequestException("No active tariff rate to close");

    const effectiveTo = new Date(effectiveToIso);
    if (Number.isNaN(effectiveTo.getTime())) throw new BadRequestException("Invalid effectiveTo");
    if (effectiveTo < active.effectiveFrom) throw new BadRequestException("effectiveTo cannot be before effectiveFrom");

    const updated = await this.prisma.tariffRate.update({
      where: { id: active.id },
      data: { effectiveTo },
    });

    await this.audit.log({
      branchId: plan.branchId,
      actorUserId: principal.userId,
      action: "BILLING_TARIFF_RATE_CLOSE",
      entity: "TariffRate",
      entityId: updated.id,
      meta: { tariffPlanId, chargeMasterItemId, effectiveTo: effectiveTo.toISOString() },
    });

    return updated;
  }
  async updateTariffRateById(principal: Principal, id: string, dto: any) {
    const rate = await this.prisma.tariffRate.findUnique({
      where: { id },
      select: { id: true, tariffPlanId: true, chargeMasterItemId: true },
    });
    if (!rate) throw new NotFoundException("TariffRate not found");

    const plan = await this.prisma.tariffPlan.findUnique({
      where: { id: rate.tariffPlanId },
      select: { id: true, branchId: true, status: true, currency: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.resolveBranchId(principal, plan.branchId);

    // safest rule (advanced governance): editable only in DRAFT
    if (plan.status !== ("DRAFT" as any)) {
      throw new BadRequestException("Only DRAFT plans can edit an existing rate. Create a new version instead.");
    }

    const rateAmount = dto.rateAmount ?? dto.amount;
    const currency = (dto.currency ?? plan.currency ?? "INR").toUpperCase();

    // Validate taxCodeId if provided
    if (dto.taxCodeId) {
      const tx = await this.prisma.taxCode.findFirst({
        where: { id: dto.taxCodeId, branchId: plan.branchId, isActive: true },
        select: { id: true },
      });
      if (!tx) throw new BadRequestException("taxCodeId must be ACTIVE and belong to this branch");
    }

    const effFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined;
    if (effFrom && Number.isNaN(effFrom.getTime())) throw new BadRequestException("Invalid effectiveFrom");

    const effTo = dto.effectiveTo ? new Date(dto.effectiveTo) : dto.effectiveTo === null ? null : undefined;
    if (effTo && Number.isNaN(effTo.getTime())) throw new BadRequestException("Invalid effectiveTo");

    return this.prisma.tariffRate.update({
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
    const rate = await this.prisma.tariffRate.findUnique({
      where: { id },
      select: { id: true, tariffPlanId: true, effectiveFrom: true, effectiveTo: true },
    });
    if (!rate) throw new NotFoundException("TariffRate not found");

    const plan = await this.prisma.tariffPlan.findUnique({
      where: { id: rate.tariffPlanId },
      select: { id: true, branchId: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.resolveBranchId(principal, plan.branchId);

    if (rate.effectiveTo) return rate; // already closed

    const effectiveTo = new Date(effectiveToIso);
    if (Number.isNaN(effectiveTo.getTime())) throw new BadRequestException("Invalid effectiveTo");
    if (effectiveTo < rate.effectiveFrom) throw new BadRequestException("effectiveTo cannot be before effectiveFrom");

    return this.prisma.tariffRate.update({
      where: { id },
      data: { effectiveTo, isActive: false },
    });
  }
  async deactivateTariffRateById(principal: Principal, id: string) {
    const rate = await this.prisma.tariffRate.findUnique({
      where: { id },
      select: { id: true, tariffPlanId: true },
    });
    if (!rate) throw new NotFoundException("TariffRate not found");

    const plan = await this.prisma.tariffPlan.findUnique({
      where: { id: rate.tariffPlanId },
      select: { id: true, branchId: true },
    });
    if (!plan) throw new NotFoundException("TariffPlan not found");
    this.resolveBranchId(principal, plan.branchId);

    return this.prisma.tariffRate.update({
      where: { id },
      data: { isActive: false, effectiveTo: new Date() },
    });
  }

}