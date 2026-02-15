import { Injectable } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";

type GoLiveSeverity = "BLOCKER" | "WARNING" | "INFO";

interface GoLiveCheckResult {
  checkId: string;
  description: string;
  severity: GoLiveSeverity;
  passed: boolean;
  details?: string;
}

@Injectable()
export class PharmacyGoLiveService {
  constructor(private readonly ctx: InfraContextService) {}

  // ----------------------------------------------------------------
  // Run all 15 pharmacy go-live checks for a branch.
  // Returns an array of check results.
  // ----------------------------------------------------------------
  async runGoLiveChecks(
    principal: Principal,
    branchId?: string | null,
  ): Promise<GoLiveCheckResult[]> {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);
    const now = new Date();
    const results: GoLiveCheckResult[] = [];

    const [
      allStores,
      dispensingStores,
      activeDrugCount,
      publishedFormulary,
      interactionCount,
      narcoticsStoresActive,
      narcoticDrugCount,
      supplierCount,
      indentMappingCount,
      top100DrugIds,
    ] = await Promise.all([
      this.ctx.prisma.pharmacyStore.findMany({
        where: { branchId: bid },
        select: {
          id: true,
          storeCode: true,
          storeName: true,
          storeType: true,
          status: true,
          canDispense: true,
          drugLicenseNumber: true,
          drugLicenseExpiry: true,
          pharmacistInChargeId: true,
          parentStoreId: true,
        },
      }),
      this.ctx.prisma.pharmacyStore.count({
        where: { branchId: bid, canDispense: true, status: "ACTIVE" as any },
      }),
      this.ctx.prisma.drugMaster.count({
        where: { branchId: bid, status: "ACTIVE" as any },
      }),
      this.ctx.prisma.formulary.findFirst({
        where: { branchId: bid, status: "PUBLISHED" as any },
        select: { id: true, version: true, publishedAt: true },
      }),
      this.ctx.prisma.drugInteraction.count({
        where: { drugA: { branchId: bid } },
      }),
      this.ctx.prisma.pharmacyStore.count({
        where: { branchId: bid, storeType: "NARCOTICS" as any, status: "ACTIVE" as any },
      }),
      this.ctx.prisma.drugMaster.count({
        where: { branchId: bid, status: "ACTIVE" as any, isNarcotic: true },
      }),
      this.ctx.prisma.pharmSupplier.count({
        where: { branchId: bid, status: "ACTIVE" as any },
      }),
      this.ctx.prisma.storeIndentMapping.count({
        where: { requestingStore: { branchId: bid } },
      }),
      this.ctx.prisma.drugMaster.findMany({
        where: { branchId: bid, status: "ACTIVE" as any },
        orderBy: [{ drugCode: "asc" }],
        take: 100,
        select: { id: true },
      }),
    ]);

    const totalStores = allStores.length;
    const activeStoresList = allStores.filter((s) => String(s.status) === "ACTIVE");

    // ================================================================
    // PH-GL-001: At least 1 pharmacy store configured (BLOCKER)
    // ================================================================
    results.push({
      checkId: "PH-GL-001",
      description: "At least 1 pharmacy store configured",
      severity: "BLOCKER",
      passed: totalStores >= 1,
      details:
        totalStores >= 1
          ? `${totalStores} pharmacy store(s) configured`
          : "No pharmacy stores found. Create at least one pharmacy store.",
    });

    // ================================================================
    // PH-GL-002: Main store exists and is ACTIVE (BLOCKER)
    // ================================================================
    const mainStore = allStores.find(
      (s) => String(s.storeType) === "MAIN" && String(s.status) === "ACTIVE",
    );
    results.push({
      checkId: "PH-GL-002",
      description: "Main store exists and is ACTIVE",
      severity: "BLOCKER",
      passed: !!mainStore,
      details: mainStore
        ? `Main store ${mainStore.storeCode} (${mainStore.storeName}) is ACTIVE`
        : "No ACTIVE main store found. Ensure a store of type MAIN is set to ACTIVE status.",
    });

    // ================================================================
    // PH-GL-003: Every ACTIVE store has valid drug license (BLOCKER)
    // - must have license number
    // - must have expiry date
    // - expiry must be >= today
    // ================================================================
    const storesWithoutLicenseNumber = activeStoresList.filter(
      (s) => !s.drugLicenseNumber || !s.drugLicenseNumber.trim(),
    );
    const storesWithoutExpiry = activeStoresList.filter((s) => !s.drugLicenseExpiry);
    const storesExpired = activeStoresList.filter((s) => {
      if (!s.drugLicenseExpiry) return false;
      return new Date(s.drugLicenseExpiry).getTime() < now.getTime();
    });

    const licenseBlockers = [
      ...new Set([
        ...storesWithoutLicenseNumber.map((s) => s.storeCode),
        ...storesWithoutExpiry.map((s) => s.storeCode),
        ...storesExpired.map((s) => s.storeCode),
      ]),
    ];

    results.push({
      checkId: "PH-GL-003",
      description: "Every ACTIVE store has valid drug license",
      severity: "BLOCKER",
      passed: licenseBlockers.length === 0 && activeStoresList.length > 0,
      details:
        licenseBlockers.length > 0
          ? `Invalid license setup for ${licenseBlockers.length} ACTIVE store(s): ${licenseBlockers.join(", ")}`
          : activeStoresList.length === 0
            ? "No ACTIVE stores to validate"
            : "All ACTIVE stores have license number + expiry and are not expired",
    });

    // ================================================================
    // PH-GL-004: Every ACTIVE store has eligible pharmacist-in-charge (BLOCKER)
    // Eligibility:
    // - staff exists
    // - staff.status ACTIVE
    // - staff.staffType PHARMACIST
    // - staff is assigned to branch (primaryBranchId == branch OR has active assignment)
    // ================================================================
    const pharmacistIds = this.ctx.uniq(
      activeStoresList.map((s) => s.pharmacistInChargeId).filter(Boolean) as string[],
    );

    const [pharmacistStaff, pharmacistAssignments] = await Promise.all([
      pharmacistIds.length
        ? this.ctx.prisma.staff.findMany({
            where: { id: { in: pharmacistIds } },
            select: { id: true, status: true, staffType: true, primaryBranchId: true },
          })
        : Promise.resolve([]),
      pharmacistIds.length
        ? this.ctx.prisma.staffAssignment.findMany({
            where: {
              staffId: { in: pharmacistIds },
              branchId: bid,
              isActive: true,
              status: "ACTIVE" as any,
              approvalStatus: "APPROVED" as any,
            },
            select: { staffId: true },
          })
        : Promise.resolve([]),
    ]);

    const staffById = new Map(pharmacistStaff.map((s) => [s.id, s]));
    const assignedSet = new Set(pharmacistAssignments.map((a) => a.staffId));

    const invalidPharmacistStores = activeStoresList
      .filter((s) => !s.pharmacistInChargeId)
      .map((s) => s.storeCode);

    const ineligibleStores = activeStoresList
      .filter((s) => s.pharmacistInChargeId)
      .filter((store) => {
        const staff = staffById.get(store.pharmacistInChargeId!);
        if (!staff) return true;
        if (String(staff.status) !== "ACTIVE") return true;
        if (String(staff.staffType) !== "PHARMACIST") return true;
        const inBranch = staff.primaryBranchId === bid || assignedSet.has(staff.id);
        return !inBranch;
      })
      .map((s) => s.storeCode);

    const pharmacistFailures = [...invalidPharmacistStores, ...ineligibleStores];

    results.push({
      checkId: "PH-GL-004",
      description: "Every ACTIVE store has pharmacist-in-charge",
      severity: "BLOCKER",
      passed: pharmacistFailures.length === 0 && activeStoresList.length > 0,
      details:
        pharmacistFailures.length > 0
          ? `Pharmacist-in-charge missing/ineligible for ${pharmacistFailures.length} ACTIVE store(s): ${pharmacistFailures.join(", ")}`
          : activeStoresList.length === 0
            ? "No ACTIVE stores to validate"
            : "All ACTIVE stores have eligible pharmacist-in-charge assigned",
    });

    // ================================================================
    // PH-GL-005: Drug master has >= 100 active drugs (BLOCKER)
    // ================================================================
    results.push({
      checkId: "PH-GL-005",
      description: "Drug master has >= 100 active drugs",
      severity: "BLOCKER",
      passed: activeDrugCount >= 100,
      details:
        activeDrugCount >= 100
          ? `${activeDrugCount} active drugs in drug master`
          : `Only ${activeDrugCount} active drug(s) found. At least 100 are required for go-live.`,
    });

    // ================================================================
    // PH-GL-006: At least 1 dispensing store configured (BLOCKER)
    // ================================================================
    results.push({
      checkId: "PH-GL-006",
      description: "At least 1 dispensing store configured",
      severity: "BLOCKER",
      passed: dispensingStores >= 1,
      details:
        dispensingStores >= 1
          ? `${dispensingStores} dispensing-enabled ACTIVE store(s) configured`
          : "No ACTIVE stores with canDispense=true found. At least one dispensing store is required.",
    });

    // ================================================================
    // PH-GL-007: Formulary published (WARNING)
    // ================================================================
    results.push({
      checkId: "PH-GL-007",
      description: "Formulary published",
      severity: "WARNING",
      passed: !!publishedFormulary,
      details: publishedFormulary
        ? `Formulary v${publishedFormulary.version} published at ${publishedFormulary.publishedAt?.toISOString() ?? "N/A"}`
        : "No published formulary found. Publish at least one formulary version.",
    });

    // ================================================================
    // PH-GL-008: Drug interaction database linked (>0 interactions) (WARNING)
    // ================================================================
    results.push({
      checkId: "PH-GL-008",
      description: "Drug interaction database linked (>0 interactions)",
      severity: "WARNING",
      passed: interactionCount > 0,
      details:
        interactionCount > 0
          ? `${interactionCount} drug interaction(s) configured`
          : "No drug interactions found. Link or import a drug interaction database.",
    });

    // ================================================================
    // PH-GL-009: Narcotics store configured if narcotic drugs exist (WARNING)
    // ================================================================
    const needsNarcoticsStore = narcoticDrugCount > 0;
    const narcoticsStoreOk = narcoticsStoresActive > 0;
    results.push({
      checkId: "PH-GL-009",
      description: "Narcotics store configured if narcotic drugs exist",
      severity: "WARNING",
      passed: !needsNarcoticsStore || narcoticsStoreOk,
      details: !needsNarcoticsStore
        ? "No narcotic drugs in master. Narcotics store not required."
        : narcoticsStoreOk
          ? `${narcoticsStoresActive} ACTIVE NARCOTICS store(s) configured for ${narcoticDrugCount} narcotic drug(s)`
          : `${narcoticDrugCount} narcotic drug(s) found but no ACTIVE NARCOTICS store configured`,
    });

    // ================================================================
    // PH-GL-010: At least 1 supplier configured (WARNING)
    // ================================================================
    results.push({
      checkId: "PH-GL-010",
      description: "At least 1 supplier configured",
      severity: "WARNING",
      passed: supplierCount >= 1,
      details:
        supplierCount >= 1
          ? `${supplierCount} active supplier(s) configured`
          : "No active suppliers found. Add at least one supplier.",
    });

    // ================================================================
    // PH-GL-011: Inventory levels set for top 100 drugs in MAIN store (WARNING)
    // ================================================================
    const top100Target = Math.min(100, top100DrugIds.length);
    let inventoryConfigCount = 0;

    if (mainStore && top100Target > 0) {
      inventoryConfigCount = await this.ctx.prisma.inventoryConfig.count({
        where: {
          pharmacyStoreId: mainStore.id,
          drugMasterId: { in: top100DrugIds.map((d) => d.id) },
        },
      });
    }

    results.push({
      checkId: "PH-GL-011",
      description: "Inventory levels set for top 100 drugs",
      severity: "WARNING",
      passed: top100Target === 0 || (mainStore ? inventoryConfigCount >= top100Target : false),
      details:
        top100Target === 0
          ? "No active drugs in master to set inventory levels for"
          : !mainStore
            ? "Cannot validate inventory levels: no ACTIVE MAIN store (PH-GL-002 failed)"
            : inventoryConfigCount >= top100Target
              ? `MAIN store inventory configs set for ${inventoryConfigCount} of top ${top100Target} drugs`
              : `Only ${inventoryConfigCount} of top ${top100Target} drugs have inventory configs in MAIN store. Configure stock levels for the remaining.`,
    });

    // ================================================================
    // PH-GL-012: Store-to-store indent mapping configured (WARNING)
    // ================================================================
    results.push({
      checkId: "PH-GL-012",
      description: "Store-to-store indent mapping configured",
      severity: "WARNING",
      passed: indentMappingCount > 0 || totalStores <= 1,
      details:
        totalStores <= 1
          ? "Single-store setup: indent mapping not required"
          : indentMappingCount > 0
            ? `${indentMappingCount} indent mapping(s) configured`
            : "No store-to-store indent mappings found. Configure indent routes between stores.",
    });

    // ================================================================
    // PH-GL-013: Drug-to-charge-master mapping (external dependency) (WARNING)
    // ================================================================
    results.push({
      checkId: "PH-GL-013",
      description: "Drug-to-charge-master mapping (external dependency)",
      severity: "WARNING",
      passed: true,
      details:
        "Skipped: This check depends on the billing/charge-master module integration. Verify manually.",
    });

    // ================================================================
    // PH-GL-014: Drug license expiry > 90 days from now (INFO)
    // ================================================================
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const storesExpiringSoon = activeStoresList.filter((s) => {
      if (!s.drugLicenseExpiry) return false;
      return new Date(s.drugLicenseExpiry).getTime() <= ninetyDaysFromNow.getTime();
    });

    results.push({
      checkId: "PH-GL-014",
      description: "Drug license expiry > 90 days from now",
      severity: "INFO",
      passed: storesExpiringSoon.length === 0,
      details:
        storesExpiringSoon.length > 0
          ? `${storesExpiringSoon.length} store(s) with drug license expiring within 90 days: ${storesExpiringSoon
              .map(
                (s) =>
                  `${s.storeCode} (expires ${new Date(s.drugLicenseExpiry!).toISOString().split("T")[0]})`,
              )
              .join(", ")}`
          : "All ACTIVE store drug licenses are valid for more than 90 days",
    });

    // ================================================================
    // PH-GL-015: ABC-VED classification done for >= 50% active drugs (INFO)
    // Count UNIQUE drugs having abc/ved set in any inventory config
    // ================================================================
    let classifiedDrugCount = 0;
    if (activeDrugCount > 0) {
      const groups = await this.ctx.prisma.inventoryConfig.groupBy({
        by: ["drugMasterId"],
        where: {
          pharmacyStore: { branchId: bid },
          drugMaster: { branchId: bid, status: "ACTIVE" as any },
          OR: [{ abcClass: { not: null } }, { vedClass: { not: null } }],
        },
      });
      classifiedDrugCount = groups.length;
    }

    const classificationTarget = Math.ceil(activeDrugCount * 0.5);
    results.push({
      checkId: "PH-GL-015",
      description: "ABC-VED classification done for >= 50% drugs",
      severity: "INFO",
      passed: activeDrugCount === 0 || classifiedDrugCount >= classificationTarget,
      details:
        activeDrugCount === 0
          ? "No active drugs to classify"
          : classifiedDrugCount >= classificationTarget
            ? `${classifiedDrugCount} drug(s) classified (target: ${classificationTarget} = 50% of ${activeDrugCount})`
            : `Only ${classifiedDrugCount} drug(s) classified out of required ${classificationTarget} (50% of ${activeDrugCount}). Set ABC/VED classes in inventory config.`,
    });

    return results;
  }
}
