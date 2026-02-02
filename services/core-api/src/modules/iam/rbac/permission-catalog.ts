/**
 * Permission Catalog (source of truth)
 *
 * Enterprise RBAC pattern:
 *  - Permission codes are code-defined (no UI drift, no typos)
 *  - Synced into DB idempotently (upsert)
 *  - Metadata (name/category/description) can be overridden in DB (unless forced)
 */

import { PERM } from "../iam.constants";

export type PermissionSeed = {
  code: string;
  name: string;
  category: string;
  description?: string;
  // optional: mark as system permission; DB may ignore if field doesn't exist
  isSystem?: boolean;
};

// Keep categories aligned with your Access UI categories (web) so the table stays clean.
export const PERMISSION_CATEGORIES = [
  "IAM (Identity & Access)",
  "Infrastructure",
  "Governance",
  "Operation Theatre",
  "Clinical",
  "Nursing",
  "Billing",
  "Pharmacy",
  "Inventory",
  "Diagnostics",
  "Front Office",
  "Operations",
  "System",
] as const;

export function normalizePermCode(code: string) {
  // IMPORTANT: do NOT change case. Some permission codes are dot-form (e.g., ot.suite.create).
  return String(code || "").trim();
}

function inferCategory(codeRaw: string): string {
  const code = normalizePermCode(codeRaw);
  if (!code) return "System";

  if (code.startsWith("IAM_")) return "IAM (Identity & Access)";
  if (code.startsWith("GOV_")) return "Governance";

  if (code.startsWith("INFRA_")) return "Infrastructure";
  if (
    code.startsWith("BRANCH_") ||
    code.startsWith("FACILITY_") ||
    code.startsWith("DEPARTMENT_") ||
    code.startsWith("SPECIALTY_") ||
    code.startsWith("STAFF_")
  ) {
    return "Infrastructure";
  }

  if (code.startsWith("ot.")) return "Operation Theatre";

  // If you later add module-specific prefixes, map them here.
  if (code.startsWith("BILLING_")) return "Billing";
  if (code.startsWith("PHARM_") || code.startsWith("PHARMACY_")) return "Pharmacy";
  if (code.startsWith("DIAG_") || code.startsWith("DIAGNOSTIC_")) return "Diagnostics";
  if (code.startsWith("FO_") || code.startsWith("FRONT_")) return "Front Office";

  return "System";
}

function titleCaseWords(input: string) {
  return input
    .split(/[_\.\s]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function inferName(codeRaw: string): string {
  const code = normalizePermCode(codeRaw);
  if (!code) return "Unknown permission";

  // Prefer readable names without duplicating the category prefix.
  const strip = (prefix: string) => (code.startsWith(prefix) ? code.slice(prefix.length) : code);

  if (code.startsWith("IAM_")) return titleCaseWords(strip("IAM_"));
  if (code.startsWith("GOV_")) return titleCaseWords(strip("GOV_"));
  if (code.startsWith("INFRA_")) return titleCaseWords(strip("INFRA_"));

  // Dot-form (e.g., ot.suite.create)
  if (code.startsWith("ot.")) return "OT " + titleCaseWords(strip("ot."));

  return titleCaseWords(code);
}

/**
 * Overrides for high-signal permissions where we want a nicer label/description.
 * Everything else is auto-derived from PERM constants and can still be edited via metadata endpoint.
 */
const OVERRIDES: Record<string, Partial<PermissionSeed>> = {
  [PERM.IAM_ME_READ]: {
    name: "Read own principal",
    category: "IAM (Identity & Access)",
    description: "Bootstrap endpoint for the UI (returns current user's principal + effective permissions).",
  },
  [PERM.IAM_PERMISSION_MANAGE]: {
    name: "Manage permission catalog",
    category: "IAM (Identity & Access)",
    description: "Allows syncing code-defined permissions into DB and updating metadata (name/category/description).",
  },
};

const CODES = Array.from(new Set(Object.values(PERM).map(normalizePermCode))).filter(Boolean);

export const PERMISSIONS: PermissionSeed[] = CODES
  .map((code) => {
    const base: PermissionSeed = {
      code,
      name: inferName(code),
      category: inferCategory(code),
      isSystem: true,
    };
    return { ...base, ...(OVERRIDES[code] ?? {}) };
  })
  .sort((a, b) => a.code.localeCompare(b.code));
