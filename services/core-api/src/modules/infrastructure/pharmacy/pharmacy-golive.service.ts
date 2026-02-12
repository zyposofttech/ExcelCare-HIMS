import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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

    // -------- Pre-fetch data in parallel for efficiency --------
    const [
      allStores,
      activeStores,
      dispensingStores,
      activeDrugCount,
      publishedFormulary,
      interactionCount,
      narcoticsVaultStores,
      scheduleXDrugCount,
      supplierCount,
      indentMappingCount,
      top100DrugIds,
    ] = await Promise.all([
      // All pharmacy stores for this branch
      this.ctx.prisma.pharmacyStore.findMany({
        where: { branchId: bid },
        select: {
          id: true,
          storeCode: true,
          storeName: true,
          storeType: true,
          status: true,
          drugLicenseNumber: true,
          drugLicenseExpiry: true,
          pharmacistInChargeId: true,
          parentStoreId: true,
        },
      }),
      // ACTIVE stores
      this.ctx.prisma.pharmacyStore.count({
        where: { branchId: bid, status: "ACTIVE" as any },
      }),
      // Dispensing stores
      this.ctx.prisma.pharmacyStore.count({
        where: { branchId: bid, canDispense: true, status: "ACTIVE" as any },
      }),
      // Active drugs
      this.ctx.prisma.drugMaster.count({
        where: { branchId: bid, status: "ACTIVE" as any },
      }),
      // Published formulary
      this.ctx.prisma.formulary.findFirst({
        where: { branchId: bid, status: "PUBLISHED" as any },
        select: { id: true, version: true, publishedAt: true },
      }),
      // Drug interactions count
      this.ctx.prisma.drugInteraction.count({
        where: {
          drugA: { branchId: bid },
        },
      }),
      // Narcotics vault stores
      this.ctx.prisma.pharmacyStore.count({
        where: { branchId: bid, storeType: "NARCOTICS_VAULT" as any },
      }),
      // Schedule X drugs (narcotic/controlled)
      this.ctx.prisma.drugMaster.count({
        where: { branchId: bid, status: "ACTIVE" as any, isNarcotic: true },
      }),
      // Supplier count
      this.ctx.prisma.pharmSupplier.count({
        where: { branchId: bid, status: "ACTIVE" as any },
      }),
      // Indent mapping count
      this.ctx.prisma.storeIndentMapping.count({
        where: { requestingStore: { branchId: bid } },
      }),
      // Top 100 drugs by code for inventory level check
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
      details: totalStores >= 1
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
    // ================================================================
    const storesWithoutLicense = activeStoresList.filter(
      (s) => !s.drugLicenseNumber || !s.drugLicenseNumber.trim(),
    );
    results.push({
      checkId: "PH-GL-003",
      description: "Every ACTIVE store has valid drug license",
      severity: "BLOCKER",
      passed: storesWithoutLicense.length === 0 && activeStoresList.length > 0,
      details:
        storesWithoutLicense.length > 0
          ? `${storesWithoutLicense.length} ACTIVE store(s) missing drug license: ${storesWithoutLicense.map((s) => s.storeCode).join(", ")}`
          : activeStoresList.length === 0
            ? "No ACTIVE stores to validate"
            : "All ACTIVE stores have drug licenses",
    });

    // ================================================================
    // PH-GL-004: Every ACTIVE store has pharmacist-in-charge (BLOCKER)
    // ================================================================
    const storesWithoutPharmacist = activeStoresList.filter(
      (s) => !s.pharmacistInChargeId,
    );
    results.push({
      checkId: "PH-GL-004",
      description: "Every ACTIVE store has pharmacist-in-charge",
      severity: "BLOCKER",
      passed: storesWithoutPharmacist.length === 0 && activeStoresList.length > 0,
      details:
        storesWithoutPharmacist.length > 0
          ? `${storesWithoutPharmacist.length} ACTIVE store(s) missing pharmacist-in-charge: ${storesWithoutPharmacist.map((s) => s.storeCode).join(", ")}`
          : activeStoresList.length === 0
            ? "No ACTIVE stores to validate"
            : "All ACTIVE stores have a pharmacist-in-charge assigned",
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
          ? `${dispensingStores} dispensing-enabled store(s) configured`
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
    // PH-GL-009: Narcotics vault configured if Schedule X drugs in master (WARNING)
    // ================================================================
    const needsVault = scheduleXDrugCount > 0;
    const vaultConfigured = narcoticsVaultStores > 0;
    results.push({
      checkId: "PH-GL-009",
      description: "Narcotics vault configured if Schedule X drugs in master",
      severity: "WARNING",
      passed: !needsVault || vaultConfigured,
      details: !needsVault
        ? "No Schedule X (narcotic) drugs in master. Narcotics vault not required."
        : vaultConfigured
          ? `${narcoticsVaultStores} narcotics vault store(s) configured for ${scheduleXDrugCount} narcotic drug(s)`
          : `${scheduleXDrugCount} narcotic drug(s) found but no NARCOTICS_VAULT store configured`,
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
    // PH-GL-011: Inventory levels set for top 100 drugs (WARNING)
    // ================================================================
    let inventoryConfigCount = 0;
    if (top100DrugIds.length > 0) {
      inventoryConfigCount = await this.ctx.prisma.inventoryConfig.count({
        where: {
          drugMasterId: { in: top100DrugIds.map((d) => d.id) },
          pharmacyStore: { branchId: bid },
        },
      });
    }
    const top100Target = Math.min(100, top100DrugIds.length);
    results.push({
      checkId: "PH-GL-011",
      description: "Inventory levels set for top 100 drugs",
      severity: "WARNING",
      passed: inventoryConfigCount >= top100Target && top100Target > 0,
      details:
        top100Target === 0
          ? "No active drugs in master to set inventory levels for"
          : inventoryConfigCount >= top100Target
            ? `Inventory configs set for ${inventoryConfigCount} of top ${top100Target} drugs`
            : `Only ${inventoryConfigCount} of top ${top100Target} drugs have inventory configs. Configure stock levels for the remaining.`,
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
    // PH-GL-013: Drug-to-charge-master mapping (skip - external dependency) (WARNING)
    // ================================================================
    results.push({
      checkId: "PH-GL-013",
      description: "Drug-to-charge-master mapping (external dependency)",
      severity: "WARNING",
      passed: true, // Skip - external dependency
      details:
        "Skipped: This check depends on the billing/charge-master module integration. Verify manually.",
    });

    // ================================================================
    // PH-GL-014: Drug license expiry > 90 days from now (INFO)
    // ================================================================
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const storesExpiringSoon = activeStoresList.filter((s) => {
      if (!s.drugLicenseExpiry) return false;
      const expiry = new Date(s.drugLicenseExpiry);
      return expiry.getTime() <= ninetyDaysFromNow.getTime();
    });
    results.push({
      checkId: "PH-GL-014",
      description: "Drug license expiry > 90 days from now",
      severity: "INFO",
      passed: storesExpiringSoon.length === 0,
      details:
        storesExpiringSoon.length > 0
          ? `${storesExpiringSoon.length} store(s) with drug license expiring within 90 days: ${storesExpiringSoon.map((s) => `${s.storeCode} (expires ${new Date(s.drugLicenseExpiry!).toISOString().split("T")[0]})`).join(", ")}`
          : "All ACTIVE store drug licenses are valid for more than 90 days",
    });

    // ================================================================
    // PH-GL-015: ABC-VED classification done for >= 50% drugs (INFO)
    // ================================================================
    let classifiedCount = 0;
    if (activeDrugCount > 0) {
      classifiedCount = await this.ctx.prisma.inventoryConfig.count({
        where: {
          pharmacyStore: { branchId: bid },
          OR: [
            { abcClass: { not: null } },
            { vedClass: { not: null } },
          ],
        },
      });
    }
    const classificationTarget = Math.ceil(activeDrugCount * 0.5);
    results.push({
      checkId: "PH-GL-015",
      description: "ABC-VED classification done for >= 50% drugs",
      severity: "INFO",
      passed: activeDrugCount === 0 || classifiedCount >= classificationTarget,
      details:
        activeDrugCount === 0
          ? "No active drugs to classify"
          : classifiedCount >= classificationTarget
            ? `${classifiedCount} drug(s) classified (target: ${classificationTarget} = 50% of ${activeDrugCount})`
            : `Only ${classifiedCount} drug(s) classified out of required ${classificationTarget} (50% of ${activeDrugCount}). Set ABC/VED classes in inventory config.`,
    });

    return results;
  }
}
