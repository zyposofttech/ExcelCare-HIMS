import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import { ServiceChargeMappingService } from "./service-charge-mapping.service";
import type { CreateServiceItemDto, UpdateServiceItemDto } from "./dto";
import { canonicalizeCode } from "../../../common/naming.util";

@Injectable()
export class ServiceItemsService {
  constructor(
    private readonly ctx: InfraContextService,
    private readonly mappingSvc: ServiceChargeMappingService,
  ) { }

  private async reconcileChargeUnitMismatchFixIt(branchId: string, serviceItemId: string) {
    const now = new Date();

    const svc = await this.ctx.prisma.serviceItem.findUnique({
      where: { id: serviceItemId },
      select: { id: true, code: true, chargeUnit: true },
    });
    if (!svc) return;

    const mapping = await this.ctx.prisma.serviceChargeMapping.findFirst({
      where: {
        branchId,
        serviceItemId,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      select: {
        chargeMasterItemId: true,
        chargeMasterItem: { select: { id: true, code: true, chargeUnit: true } },
      } as any,
      orderBy: [{ effectiveFrom: "desc" }],
    });

    const cm = (mapping as any)?.chargeMasterItem;
    if (!svc.chargeUnit || !cm?.chargeUnit) return;

    const isMismatch = String(svc.chargeUnit) !== String(cm.chargeUnit);

    if (!isMismatch) {
      await this.ctx.prisma.fixItTask.updateMany({
        where: {
          branchId,
          type: "CHARGE_UNIT_MISMATCH" as any,
          status: { in: ["OPEN", "IN_PROGRESS"] as any },
          entityType: "SERVICE_ITEM" as any,
          entityId: serviceItemId,
        } as any,
        data: { status: "RESOLVED" as any, resolvedAt: now } as any,
      });
      return;
    }

    // Open if missing
    const existing = await this.ctx.prisma.fixItTask.findFirst({
      where: {
        branchId,
        type: "CHARGE_UNIT_MISMATCH" as any,
        status: { in: ["OPEN", "IN_PROGRESS"] as any },
        entityType: "SERVICE_ITEM" as any,
        entityId: serviceItemId,
      } as any,
      select: { id: true },
    });

    if (!existing) {
      await this.ctx.prisma.fixItTask.create({
        data: {
          branchId,
          type: "CHARGE_UNIT_MISMATCH" as any,
          status: "OPEN" as any,
          severity: "WARNING" as any,
          entityType: "SERVICE_ITEM" as any,
          entityId: serviceItemId,
          serviceItemId,
          title: `Charge unit mismatch for service ${svc.code} → CM ${cm.code}`,
          details: {
            serviceItemId,
            serviceCode: svc.code,
            chargeMasterItemId: cm.id,
            chargeMasterCode: cm.code,
            serviceChargeUnit: svc.chargeUnit,
            chargeMasterChargeUnit: cm.chargeUnit,
          },
        } as any,
      });
    }
  }

  private async ensureService(principal: Principal, id: string) {
    const svc = await this.ctx.prisma.serviceItem.findUnique({
      where: { id },
      select: { id: true, branchId: true, lifecycleStatus: true, isBillable: true, code: true },
    });
    if (!svc) throw new NotFoundException("Service not found");
    const branchId = this.ctx.resolveBranchId(principal, svc.branchId);
    return { ...svc, branchId };
  }

  async createServiceItem(principal: Principal, dto: CreateServiceItemDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const code = canonicalizeCode(dto.code);

    if (dto.departmentId) {
      const dep = await this.ctx.prisma.department.findFirst({
        where: { id: dto.departmentId, branchId, isActive: true },
        select: { id: true },
      });
      if (!dep) throw new BadRequestException("Invalid departmentId for branch");
    }

    const created = await this.ctx.prisma.serviceItem.create({
      data: {
        branchId,
        code,
        name: dto.name.trim(),
        category: dto.category.trim(),
        unit: dto.unit ?? null,

        type: (dto.type as any) ?? undefined,
        departmentId: dto.departmentId ?? null,
        externalId: dto.externalId ?? null,

        isOrderable: dto.isOrderable ?? true,
        isActive: dto.isActive ?? true,
        isBillable: dto.isBillable ?? true,

        // start in DRAFT to support workflow (override schema default if needed)
        lifecycleStatus: "DRAFT" as any,

        // maker-checker
        createdByUserId: principal.userId ?? null,
        updatedByUserId: principal.userId ?? null,

        consentRequired: dto.consentRequired ?? false,
        preparationText: dto.preparationText ?? null,
        instructionsText: dto.instructionsText ?? null,
        contraindicationsText: dto.contraindicationsText ?? null,
        minAgeYears: dto.minAgeYears ?? null,
        maxAgeYears: dto.maxAgeYears ?? null,
        genderRestriction: dto.genderRestriction ?? null,
        cooldownMins: dto.cooldownMins ?? null,

        requiresAppointment: dto.requiresAppointment ?? false,
        estimatedDurationMins: dto.estimatedDurationMins ?? null,
        prepMins: dto.prepMins ?? null,
        recoveryMins: dto.recoveryMins ?? null,
        tatMinsRoutine: dto.tatMinsRoutine ?? null,
        tatMinsStat: dto.tatMinsStat ?? null,

        chargeUnit: (dto.chargeUnit as any) ?? null,
        taxApplicability: (dto.taxApplicability as any) ?? null,
        billingPolicy: (dto.billingPolicy ?? null) as any,

        // optional child tables at create time
        aliases: dto.aliases?.length
          ? {
            createMany: {
              data: dto.aliases
                .map((a) => String(a || "").trim())
                .filter(Boolean)
                .map((alias) => ({ alias, isActive: true })),
              skipDuplicates: true,
            },
          }
          : undefined,

        contexts: dto.contexts?.length
          ? {
            createMany: {
              data: dto.contexts
                .filter((x) => x?.context)
                .map((x) => ({
                  context: x.context as any,
                  isEnabled: x.isEnabled ?? true,
                })),
              skipDuplicates: true,
            },
          }
          : undefined,

        resourceRequirements: dto.resourceRequirements?.length
          ? {
            createMany: {
              data: dto.resourceRequirements.map((r) => ({
                resourceType: r.resourceType as any,
                quantity: r.quantity ?? 1,
                constraints: (r.constraints ?? null) as any,
                isActive: r.isActive ?? true,
              })),
            },
          }
          : undefined,

        clinicalRules: dto.clinicalRules?.length
          ? {
            createMany: {
              data: dto.clinicalRules.map((r) => ({
                ruleType: r.ruleType,
                payload: (r.payload ?? null) as any,
                isActive: r.isActive ?? true,
              })),
            },
          }
          : undefined,

        seriesPolicies: dto.seriesPolicies?.length
          ? {
            createMany: {
              data: dto.seriesPolicies.map((p) => ({
                totalSessions: p.totalSessions ?? null,
                maxSessionsPerDay: p.maxSessionsPerDay ?? null,
                expiryDays: p.expiryDays ?? null,
                scheduleTemplate: (p.scheduleTemplate ?? null) as any,
                isActive: p.isActive ?? true,
              })),
            },
          }
          : undefined,
      },
    });

    // If billable and no mapping, open Fix-It (as per requirement)
    if ((dto.isBillable ?? true) && !dto.chargeMasterCode) {
      await this.ctx.prisma.fixItTask.create({
        data: {
          branchId,
          type: "SERVICE_CHARGE_MAPPING_MISSING" as any,
          status: "OPEN" as any,
          severity: "BLOCKER" as any,
          entityType: "SERVICE_ITEM" as any,
          entityId: created.id,
          title: `Charge mapping missing for service ${created.code}`,
          details: { serviceItemId: created.id, serviceCode: created.code },
          serviceItemId: created.id,
        } as any,
      });
    } else if ((dto.isBillable ?? true) && dto.chargeMasterCode) {
      const cm = await this.ctx.prisma.chargeMasterItem.findFirst({
        where: { branchId, code: canonicalizeCode(dto.chargeMasterCode), isActive: true },
        select: { id: true },
      });

      if (!cm) {
        await this.ctx.prisma.fixItTask.create({
          data: {
            branchId,
            type: "SERVICE_CHARGE_MAPPING_MISSING" as any,
            status: "OPEN" as any,
            severity: "BLOCKER" as any,
            entityType: "SERVICE_ITEM" as any,
            entityId: created.id,
            title: `Charge master code not found for service ${created.code}`,
            details: { serviceItemId: created.id, serviceCode: created.code, chargeMasterCode: dto.chargeMasterCode },
            serviceItemId: created.id,
          } as any,
        });
      } else {
        await this.mappingSvc.upsertServiceChargeMapping(principal, {
          serviceItemId: created.id,
          chargeMasterItemId: cm.id,
          effectiveFrom: new Date().toISOString(),
          effectiveTo: null,
        });
      }
    }

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_CREATE",
      entity: "ServiceItem",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async listServiceItems(principal: Principal, q: { branchId?: string | null; q?: string; includeInactive?: boolean }) {
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

    return this.ctx.prisma.serviceItem.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        mappings: { orderBy: [{ effectiveFrom: "desc" }], take: 3, include: { chargeMasterItem: true } },
      },
      take: 500,
    });
  }

  async getServiceItem(principal: Principal, id: string) {
    const svc = await this.ensureService(principal, id);
    return this.ctx.prisma.serviceItem.findUnique({
      where: { id: svc.id },
      include: {
        department: true,
        mappings: { orderBy: [{ effectiveFrom: "desc" }], include: { chargeMasterItem: true } },
        aliases: { orderBy: [{ alias: "asc" }] },
        contexts: { orderBy: [{ context: "asc" }] },
        resourceRequirements: { orderBy: [{ resourceType: "asc" }] },
        clinicalRules: { orderBy: [{ ruleType: "asc" }] },
        seriesPolicies: { orderBy: [{ createdAt: "desc" }] },
      },
    });
  }

  async updateServiceItem(principal: Principal, id: string, dto: UpdateServiceItemDto) {
    const svc = await this.ensureService(principal, id);
    
    if (dto.departmentId) {
      const dep = await this.ctx.prisma.department.findFirst({
        where: { id: dto.departmentId, branchId: svc.branchId, isActive: true },
        select: { id: true },
      });
      if (!dep) throw new BadRequestException("Invalid departmentId for branch");
    }

    const updated = await this.ctx.prisma.serviceItem.update({
      where: { id: svc.id },
      data: {
        code: dto.code ? canonicalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        category: dto.category?.trim(),
        unit: dto.unit ?? undefined,

        type: dto.type !== undefined ? (dto.type as any) : undefined,
        departmentId: dto.departmentId ?? undefined,
        externalId: dto.externalId ?? undefined,

        isOrderable: dto.isOrderable ?? undefined,
        isActive: dto.isActive ?? undefined,
        isBillable: dto.isBillable ?? undefined,

        consentRequired: dto.consentRequired ?? undefined,
        preparationText: dto.preparationText ?? undefined,
        instructionsText: dto.instructionsText ?? undefined,
        contraindicationsText: dto.contraindicationsText ?? undefined,
        minAgeYears: dto.minAgeYears ?? undefined,
        maxAgeYears: dto.maxAgeYears ?? undefined,
        genderRestriction: dto.genderRestriction ?? undefined,
        cooldownMins: dto.cooldownMins ?? undefined,

        requiresAppointment: dto.requiresAppointment ?? undefined,
        estimatedDurationMins: dto.estimatedDurationMins ?? undefined,
        prepMins: dto.prepMins ?? undefined,
        recoveryMins: dto.recoveryMins ?? undefined,
        tatMinsRoutine: dto.tatMinsRoutine ?? undefined,
        tatMinsStat: dto.tatMinsStat ?? undefined,

        chargeUnit: dto.chargeUnit !== undefined ? ((dto.chargeUnit as any) ?? null) : undefined,
        taxApplicability: dto.taxApplicability !== undefined ? ((dto.taxApplicability as any) ?? null) : undefined,
        billingPolicy: dto.billingPolicy !== undefined ? ((dto.billingPolicy ?? null) as any) : undefined,

        updatedByUserId: principal.userId ?? null,
      },
    });
    // ✅ Auto-open/resolve charge unit mismatch when service chargeUnit is changed
    if (dto.chargeUnit !== undefined) {
      await this.reconcileChargeUnitMismatchFixIt(svc.branchId, svc.id);
    }
    await this.ctx.audit.log({
      branchId: svc.branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_UPDATE",
      entity: "ServiceItem",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  // ---------------- Workflow (maker-checker + status)
  async submit(principal: Principal, id: string, note?: string) {
    const svc = await this.ensureService(principal, id);

    const updated = await this.ctx.prisma.serviceItem.update({
      where: { id: svc.id },
      data: {
        lifecycleStatus: "IN_REVIEW" as any,
        submittedByUserId: principal.userId ?? null,
        submittedAt: new Date(),
        updatedByUserId: principal.userId ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId: svc.branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_SUBMIT",
      entity: "ServiceItem",
      entityId: svc.id,
      meta: { note },
    });

    return updated;
  }

  async approve(principal: Principal, id: string, note?: string) {
    const svc = await this.ensureService(principal, id);

    const updated = await this.ctx.prisma.serviceItem.update({
      where: { id: svc.id },
      data: {
        lifecycleStatus: "APPROVED" as any,
        approvedByUserId: principal.userId ?? null,
        approvedAt: new Date(),
        updatedByUserId: principal.userId ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId: svc.branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_APPROVE",
      entity: "ServiceItem",
      entityId: svc.id,
      meta: { note },
    });

    return updated;
  }

  async publish(principal: Principal, id: string, note?: string) {
    const svc = await this.ensureService(principal, id);
    const now = new Date();

    // Pull full snapshot (with children) for versioning
    const full = await this.ctx.prisma.serviceItem.findUnique({
      where: { id: svc.id },
      include: {
        department: true,
        mappings: { orderBy: [{ effectiveFrom: "desc" }], include: { chargeMasterItem: true } },
        aliases: true,
        contexts: true,
        resourceRequirements: true,
        clinicalRules: true,
        seriesPolicies: true,
      },
    });
    if (!full) throw new NotFoundException("Service not found");

    // ✅ Publish validation: if billable, must have an active mapping at publish time
    if (full.isBillable) {
      const activeMapping = await this.ctx.prisma.serviceChargeMapping.findFirst({
        where: {
          branchId: full.branchId,
          serviceItemId: full.id,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        select: { id: true },
      });

      if (!activeMapping) {
        await this.ctx.prisma.fixItTask.create({
          data: {
            branchId: full.branchId,
            type: "SERVICE_CHARGE_MAPPING_MISSING" as any,
            status: "OPEN" as any,
            severity: "BLOCKER" as any,
            entityType: "SERVICE_ITEM" as any,
            entityId: full.id,
            title: `Charge mapping missing for service ${full.code}`,
            details: { serviceItemId: full.id, serviceCode: full.code },
            serviceItemId: full.id,
          } as any,
        });

        throw new BadRequestException("Cannot publish: billable service requires an active charge mapping");
      }
    }

    // Version bump
    const last = await this.ctx.prisma.serviceItemVersion.findFirst({
      where: { serviceItemId: full.id },
      orderBy: [{ version: "desc" }],
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    const result = await this.ctx.prisma.$transaction(async (tx) => {
      // Close previous open version effectiveTo (Gap-4 fix)
      await tx.serviceItemVersion.updateMany({
        where: { serviceItemId: full.id, effectiveTo: null },
        data: { effectiveTo: now },
      });

      await tx.serviceItemVersion.create({
        data: {
          serviceItemId: full.id,
          version: nextVersion,
          status: "PUBLISHED" as any,
          snapshot: full as any,
          createdByUserId: principal.userId ?? null,
          effectiveFrom: now,
          effectiveTo: null,
        } as any,
      });

      const updated = await tx.serviceItem.update({
        where: { id: full.id },
        data: {
          lifecycleStatus: "PUBLISHED" as any,
          publishedByUserId: principal.userId ?? null,
          publishedAt: now,
          updatedByUserId: principal.userId ?? null,
          isActive: true,
        },
      });

      // Resolve mapping-missing FixIts if any exist
      await tx.fixItTask.updateMany({
        where: {
          branchId: full.branchId,
          serviceItemId: full.id,
          type: "SERVICE_CHARGE_MAPPING_MISSING" as any,
          status: { in: ["OPEN", "IN_PROGRESS"] as any },
        },
        data: { status: "RESOLVED" as any, resolvedAt: now },
      });

      return updated;
    });

    await this.ctx.audit.log({
      branchId: svc.branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_PUBLISH",
      entity: "ServiceItem",
      entityId: full.id,
      meta: { version: nextVersion, note },
    });

    return result;
  }

  async deprecate(principal: Principal, id: string, note?: string) {
    const svc = await this.ensureService(principal, id);

    const updated = await this.ctx.prisma.serviceItem.update({
      where: { id: svc.id },
      data: {
        lifecycleStatus: "DEPRECATED" as any,
        isActive: false,
        updatedByUserId: principal.userId ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId: svc.branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_DEPRECATE",
      entity: "ServiceItem",
      entityId: svc.id,
      meta: { note },
    });

    return updated;
  }

  async versions(principal: Principal, id: string) {
    const svc = await this.ensureService(principal, id);
    return this.ctx.prisma.serviceItemVersion.findMany({
      where: { serviceItemId: svc.id },
      orderBy: [{ version: "desc" }],
    });
  }
}
