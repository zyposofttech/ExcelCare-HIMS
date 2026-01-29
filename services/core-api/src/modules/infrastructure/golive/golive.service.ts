import { Injectable } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { RunGoLiveDto } from "./dto";

@Injectable()
export class GoLiveService {
  constructor(private readonly ctx: InfraContextService) {}

  private async openFixItOnce(branchId: string, input: {
    type: any;
    entityType?: any;
    entityId?: string | null;
    serviceItemId?: string | null;
    title: string;
    details?: any;
    severity?: any;
    persist?: boolean;
  }) {
    if (input.persist === false) return;

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

  private async resolveFixIts(branchId: string, where: any, persist?: boolean) {
    if (persist === false) return;
    await this.ctx.prisma.fixItTask.updateMany({
      where: { branchId, status: { in: ["OPEN", "IN_PROGRESS"] as any }, ...where },
      data: { status: "RESOLVED" as any, resolvedAt: new Date() },
    });
  }

  async runGoLive(principal: Principal, dto: RunGoLiveDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const persist = dto.persist !== false;

    const now = new Date();

    // -------- Infrastructure baseline checks (keep your existing spirit)
    const [
      enabledUnitTypes,
      units,
      rooms,
      resources,
      beds,
      fixItsOpen,
    ] = await Promise.all([
      this.ctx.prisma.branchUnitType.count({ where: { branchId, isEnabled: true } }),
      this.ctx.prisma.unit.count({ where: { branchId, isActive: true } }),
      this.ctx.prisma.unitRoom.count({ where: { branchId, isActive: true } }),
      this.ctx.prisma.unitResource.count({ where: { branchId, isActive: true } }),
      this.ctx.prisma.unitResource.count({ where: { branchId, isActive: true, resourceType: "BED" as any } }),
      this.ctx.prisma.fixItTask.count({ where: { branchId, status: { in: ["OPEN", "IN_PROGRESS"] as any } } }),
    ]);

    // -------- Billing: active price list plan
    const priceListPlan = await this.ctx.prisma.tariffPlan.findFirst({
      where: {
        branchId,
        kind: "PRICE_LIST" as any,
        status: "ACTIVE" as any,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      },
      orderBy: [{ updatedAt: "desc" }],
      select: { id: true, code: true, name: true },
    });

    if (!priceListPlan) {
      // We use TARIFF_RATE_MISSING as "billing not ready" (no dedicated enum exists for plan missing)
      await this.openFixItOnce(branchId, {
        type: "TARIFF_RATE_MISSING" as any,
        entityType: "TARIFF_PLAN" as any,
        entityId: null,
        title: "No ACTIVE PRICE_LIST TariffPlan found",
        details: { hint: "Create a PRICE_LIST tariff plan and activate it." },
        severity: "BLOCKER",
        persist,
      });
    } else {
      await this.resolveFixIts(branchId, {
        type: "TARIFF_RATE_MISSING" as any,
        entityType: "TARIFF_PLAN" as any,
        entityId: null,
      }, persist);
    }

    // -------- Services to validate (billable + published)
    const services = await this.ctx.prisma.serviceItem.findMany({
      where: {
        branchId,
        isActive: true,
        isBillable: true,
        lifecycleStatus: "PUBLISHED" as any,
      },
      select: {
        id: true,
        code: true,
        name: true,
        chargeUnit: true,
        requiresAppointment: true,
        taxCodeId: true,
      },
      orderBy: [{ code: "asc" }],
    });

    // -------- Latest active mapping per service
    const mappings = await this.ctx.prisma.serviceChargeMapping.findMany({
      where: { branchId, serviceItemId: { in: services.map((s) => s.id) }, effectiveTo: null },
      select: { serviceItemId: true, chargeMasterItemId: true, effectiveFrom: true },
      orderBy: [{ serviceItemId: "asc" }, { effectiveFrom: "desc" }],
    });

    const latestMappingByService = new Map<string, { chargeMasterItemId: string }>();
    for (const m of mappings) {
      if (!latestMappingByService.has(m.serviceItemId)) {
        latestMappingByService.set(m.serviceItemId, { chargeMasterItemId: m.chargeMasterItemId });
      }
    }

    const mappedChargeIds = Array.from(new Set(Array.from(latestMappingByService.values()).map((x) => x.chargeMasterItemId)));

    const chargeItems = mappedChargeIds.length
      ? await this.ctx.prisma.chargeMasterItem.findMany({
          where: { branchId, id: { in: mappedChargeIds } },
          select: { id: true, code: true, name: true, isActive: true, chargeUnit: true, taxCodeId: true },
        })
      : [];

    const cmById = new Map(chargeItems.map((c) => [c.id, c]));

    // -------- Rates coverage for active plan
    const rates = priceListPlan
      ? await this.ctx.prisma.tariffRate.findMany({
          where: {
            tariffPlanId: priceListPlan.id,
            chargeMasterItemId: { in: mappedChargeIds.length ? mappedChargeIds : ["__none__"] },
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          select: { id: true, chargeMasterItemId: true, taxCodeId: true, effectiveTo: true },
        })
      : [];

    const rateByChargeId = new Map(rates.map((r) => [r.chargeMasterItemId, r]));

    // -------- Appointment availability coverage (requiresAppointment)
    const apptServiceIds = services.filter((s) => s.requiresAppointment).map((s) => s.id);
    const calendarsWithRules = apptServiceIds.length
      ? await this.ctx.prisma.serviceAvailabilityCalendar.findMany({
          where: {
            branchId,
            isActive: true,
            serviceItemId: { in: apptServiceIds },
            rules: { some: { isActive: true } },
          },
          select: { serviceItemId: true },
        })
      : [];

    const hasAvailability = new Set(calendarsWithRules.map((x) => x.serviceItemId));

    // -------- Iterate services and open/resolve FixIts
    const blockers: string[] = [];
    const warnings: string[] = [];

    for (const s of services) {
      const map = latestMappingByService.get(s.id);

      // mapping missing
      if (!map) {
        blockers.push(`Missing billing mapping: ${s.code} (${s.name})`);
        await this.openFixItOnce(branchId, {
          type: "SERVICE_CHARGE_MAPPING_MISSING" as any,
          entityType: "SERVICE_ITEM" as any,
          entityId: s.id,
          serviceItemId: s.id,
          title: `Billing mapping missing for ${s.code}`,
          details: { serviceItemId: s.id, serviceCode: s.code },
          severity: "BLOCKER",
          persist,
        });
        continue;
      } else {
        await this.resolveFixIts(branchId, {
          type: "SERVICE_CHARGE_MAPPING_MISSING" as any,
          OR: [
            { serviceItemId: s.id },
            { entityType: "SERVICE_ITEM" as any, entityId: s.id },
          ],
        }, persist);
      }

      const cm = cmById.get(map.chargeMasterItemId);

      if (!cm || cm.isActive === false) {
        blockers.push(`Mapped charge item inactive/missing: ${s.code} → ${map.chargeMasterItemId}`);
        await this.openFixItOnce(branchId, {
          type: "SERVICE_CHARGE_MAPPING_MISSING" as any,
          entityType: "SERVICE_ITEM" as any,
          entityId: s.id,
          serviceItemId: s.id,
          title: `Mapped charge item inactive/missing for ${s.code}`,
          details: { serviceItemId: s.id, chargeMasterItemId: map.chargeMasterItemId },
          severity: "BLOCKER",
          persist,
        });
        continue;
      }

      // charge unit mismatch
      if ((s.chargeUnit as any) !== (cm.chargeUnit as any)) {
        blockers.push(`Charge unit mismatch: ${s.code} (${s.chargeUnit}) vs ${cm.code} (${cm.chargeUnit})`);
        await this.openFixItOnce(branchId, {
          type: "CHARGE_UNIT_MISMATCH" as any,
          entityType: "SERVICE_ITEM" as any,
          entityId: s.id,
          serviceItemId: s.id,
          title: `Charge unit mismatch for ${s.code}`,
          details: {
            serviceItemId: s.id,
            serviceChargeUnit: s.chargeUnit,
            chargeMasterItemId: cm.id,
            chargeMasterChargeUnit: cm.chargeUnit,
          },
          severity: "BLOCKER",
          persist,
        });
      } else {
        await this.resolveFixIts(branchId, {
          type: "CHARGE_UNIT_MISMATCH" as any,
          entityType: "SERVICE_ITEM" as any,
          entityId: s.id,
        }, persist);
      }

      // appointment availability
      if (s.requiresAppointment && !hasAvailability.has(s.id)) {
        blockers.push(`Missing appointment availability: ${s.code}`);
        await this.openFixItOnce(branchId, {
          type: "SERVICE_AVAILABILITY_MISSING" as any,
          entityType: "SERVICE_ITEM" as any,
          entityId: s.id,
          serviceItemId: s.id,
          title: `Appointment availability missing for ${s.code}`,
          details: { serviceItemId: s.id, serviceCode: s.code },
          severity: "BLOCKER",
          persist,
        });
      } else if (s.requiresAppointment) {
        await this.resolveFixIts(branchId, {
          type: "SERVICE_AVAILABILITY_MISSING" as any,
          entityType: "SERVICE_ITEM" as any,
          entityId: s.id,
        }, persist);
      }

      // tariff rate coverage (only if plan exists)
      if (priceListPlan) {
        const r = rateByChargeId.get(cm.id);
        if (!r) {
          blockers.push(`Tariff rate missing: ${cm.code} in ${priceListPlan.code}`);
          await this.openFixItOnce(branchId, {
            type: "TARIFF_RATE_MISSING" as any,
            entityType: "CHARGE_MASTER_ITEM" as any,
            entityId: cm.id,
            title: `Tariff rate missing for ${cm.code}`,
            details: { chargeMasterItemId: cm.id, tariffPlanId: priceListPlan.id },
            severity: "BLOCKER",
            persist,
          });
        } else {
          await this.resolveFixIts(branchId, {
            type: "TARIFF_RATE_MISSING" as any,
            entityType: "CHARGE_MASTER_ITEM" as any,
            entityId: cm.id,
          }, persist);
        }

        // tax coverage (effective: tariff override OR charge master OR service tax)
        const effectiveTaxId = (r?.taxCodeId ?? cm.taxCodeId ?? s.taxCodeId) ?? null;

        if (!effectiveTaxId) {
          blockers.push(`Tax missing: ${cm.code} (or service ${s.code})`);
          await this.openFixItOnce(branchId, {
            type: "TAX_CODE_MISSING" as any,
            entityType: "CHARGE_MASTER_ITEM" as any,
            entityId: cm.id,
            title: `Tax code missing for ${cm.code}`,
            details: { chargeMasterItemId: cm.id, tariffPlanId: priceListPlan.id, serviceItemId: s.id },
            severity: "BLOCKER",
            persist,
          });
        } else {
          const tax = await this.ctx.prisma.taxCode.findFirst({
            where: { id: effectiveTaxId, branchId },
            select: { id: true, isActive: true, code: true },
          });

          if (!tax || tax.isActive === false) {
            blockers.push(`Tax inactive: ${tax?.code ?? effectiveTaxId}`);
            await this.openFixItOnce(branchId, {
              type: "TAX_CODE_INACTIVE" as any,
              entityType: "TAX_CODE" as any,
              entityId: effectiveTaxId,
              title: `Tax code inactive (${tax?.code ?? effectiveTaxId})`,
              details: { chargeMasterItemId: cm.id, tariffPlanId: priceListPlan.id },
              severity: "BLOCKER",
              persist,
            });
          } else {
            await this.resolveFixIts(branchId, {
              type: "TAX_CODE_MISSING" as any,
              entityType: "CHARGE_MASTER_ITEM" as any,
              entityId: cm.id,
            }, persist);
            await this.resolveFixIts(branchId, {
              type: "TAX_CODE_INACTIVE" as any,
              entityType: "TAX_CODE" as any,
              entityId: effectiveTaxId,
            }, persist);
          }
        }
      }
    }

    // -------- Package pricing checks (published packages)
    const packages = await this.ctx.prisma.servicePackage.findMany({
      where: { branchId, status: "PUBLISHED" as any, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
      select: {
        id: true,
        code: true,
        name: true,
        pricingMode: true,
        pricingValue: true,
        billingChargeMasterItemId: true,
        taxCodeId: true,
      },
      orderBy: [{ code: "asc" }],
    });

    for (const p of packages) {
      const requiresValue = ["FIXED", "DISCOUNT_PERCENT", "DISCOUNT_AMOUNT", "CAP"].includes(String(p.pricingMode));
      if (requiresValue && (p.pricingValue === null || p.pricingValue === undefined)) {
        blockers.push(`Package pricing missing: ${p.code} (${p.pricingMode})`);
        await this.openFixItOnce(branchId, {
          type: "PACKAGE_PRICING_MISSING" as any,
          entityType: "SERVICE_PACKAGE" as any,
          entityId: p.id,
          title: `Package pricing missing for ${p.code}`,
          details: { packageId: p.id, pricingMode: p.pricingMode },
          severity: "BLOCKER",
          persist,
        });
      } else {
        await this.resolveFixIts(branchId, {
          type: "PACKAGE_PRICING_MISSING" as any,
          entityType: "SERVICE_PACKAGE" as any,
          entityId: p.id,
        }, persist);
      }

      // If package billed as a single line item, it must have a tariff rate too
      if (priceListPlan && p.billingChargeMasterItemId) {
        const r = await this.ctx.prisma.tariffRate.findFirst({
          where: {
            tariffPlanId: priceListPlan.id,
            chargeMasterItemId: p.billingChargeMasterItemId,
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          select: { id: true },
        });

        if (!r) {
          blockers.push(`Package billing tariff missing: ${p.code}`);
          await this.openFixItOnce(branchId, {
            type: "TARIFF_RATE_MISSING" as any,
            entityType: "CHARGE_MASTER_ITEM" as any,
            entityId: p.billingChargeMasterItemId,
            title: `Tariff rate missing for package billing (${p.code})`,
            details: { packageId: p.id, tariffPlanId: priceListPlan.id },
            severity: "BLOCKER",
            persist,
          });
        }
      }
    }

    // final fixits open count after changes (optional)
    const fixItsOpenAfter = persist
      ? await this.ctx.prisma.fixItTask.count({ where: { branchId, status: { in: ["OPEN", "IN_PROGRESS"] as any } } })
      : fixItsOpen;

    return {
      branchId,
      persist,
      infra: { enabledUnitTypes, units, rooms, resources, beds },
      billing: {
        activePriceListPlan: priceListPlan ?? null,
        billableServicesChecked: services.length,
        packagesChecked: packages.length,
      },
      fixItsOpenBefore: fixItsOpen,
      fixItsOpenAfter,
      blockers,
      warnings,
      ok: blockers.length === 0,
    };
  }
}
