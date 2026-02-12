import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { IamPrincipalService } from "./iam-principal.service";

export type StaffSummary = {
  id: string;
  empCode: string;
  name: string;
  designation: string;

  category: string; // CLINICAL | NON_CLINICAL (code-level)
  staffType?: string | null;
  status?: string | null;
  onboardingStatus?: string | null;

  hasSystemAccess?: boolean | null;

  primaryBranchId?: string | null;
  homeBranchId?: string | null;
};

export type StaffAssignmentSummary = {
  id: string;
  staffId: string;

  branchId: string;
  facilityId?: string | null;
  departmentId?: string | null;
  specialtyId?: string | null;
  unitId?: string | null;

  designation?: string | null;
  role?: string | null;

  assignmentType?: string | null;
  status?: string | null;

  effectiveFrom?: string | null;
  effectiveTo?: string | null;

  isPrimary?: boolean | null;
  isActive?: boolean | null;

  requiresApproval?: boolean | null;
  approvalStatus?: string | null;

  // Branch-level flags for quick gating
  canAdmitPatients?: boolean | null;
  canPerformSurgery?: boolean | null;
  hasOTPrivileges?: boolean | null;
};

export type Principal = {
  userId: string;
  email: string;
  name: string;

  // Effective branch for the request context (selected/derived)
  branchId: string | null;

  // Optional multi-branch allowance (derived from UserRoleBinding)
  branchIds?: string[];

  roleCode: string | null;
  roleScope: "GLOBAL" | "BRANCH" | null;
  roleVersionId: string | null;
  authzVersion: number;
  permissions: string[];

  // ✅ Staff context (critical for onboarding, leave routing, privileging)
  staffId?: string | null;
  staff?: StaffSummary;
  staffBranchIds?: string[];
  staffAssignment?: StaffAssignmentSummary;

  // Convenience shortcuts (helps FE + workflow routing)
  departmentId?: string;
  unitId?: string;
  specialtyId?: string;
};

@Injectable()
export class AccessPolicyService {
  constructor(private principals: IamPrincipalService) {}

  /**
   * Loads the local DB user as a Principal (roleScope + permissions + staff context).
   *
   * Source of truth:
   *  - roleTemplateVersion (ACTIVE) permissions if roleVersionId exists
   *  - fallback: resolve latest ACTIVE version by roleTemplate.code
   *  - safety fallback: SUPER_ADMIN gets all permissions (DB-driven + code PERM)
   *
   * NOTE: returns null for disabled users (isActive=false).
   */
  async loadPrincipalByEmail(emailRaw: string): Promise<Principal | null> {
    return this.principals.loadPrincipalByEmail(emailRaw);
  }

  async loadPrincipalByUserId(userIdRaw: string, tokenAuthzVersion?: any): Promise<Principal | null> {
    return this.principals.loadPrincipalByUserId(userIdRaw, tokenAuthzVersion);
  }

  hasAll(principal: Principal, required: string[]) {
    if (!required?.length) return true;
    const set = new Set(principal.permissions || []);
    return required.every((p) => set.has(p));
  }

  isGlobal(principal: Principal | null | undefined) {
    return !!principal && principal.roleScope === "GLOBAL";
  }

  isBranch(principal: Principal | null | undefined) {
    return !!principal && principal.roleScope === "BRANCH";
  }

  /**
   * Convenience: checks if principal can operate on a branchId.
   * GLOBAL: allowed for any branchId
   * BRANCH: allowed only for allowed branches (branchIds if present, else branchId)
   */
  canAccessBranch(principal: Principal, branchId: string | null | undefined) {
    if (principal.roleScope === "GLOBAL") return true;
    if (principal.roleScope === "BRANCH") {
      const allowed = Array.isArray((principal as any).branchIds) && (principal as any).branchIds.length
        ? (principal as any).branchIds
        : (principal.branchId ? [principal.branchId] : []);
      if (!allowed.length) return false;
      if (!branchId) return false;
      return allowed.includes(branchId);
    }
    return false;
  }

  resolveBranchId(
    principal: Principal,
    requestedBranchId: string | null | undefined,
    opts: { require?: boolean } = {},
  ): string | null {
    const req = requestedBranchId ? String(requestedBranchId).trim() : "";
    const requested = req.length ? req : null;

    if (principal.roleScope === "BRANCH") {
      const allowed = Array.isArray((principal as any).branchIds) && (principal as any).branchIds.length
        ? (principal as any).branchIds
        : (principal.branchId ? [principal.branchId] : []);

      if (!allowed.length) {
        throw new ForbiddenException("Branch-scoped principal missing branchId");
      }

      // If caller requested a branchId, it must be one of the allowed branches.
      if (requested && !allowed.includes(requested)) {
        throw new ForbiddenException("Forbidden: cross-branch access");
      }

      // Default branch (when not explicitly requested): use principal.branchId if set, else the first allowed.
      return requested ?? principal.branchId ?? allowed[0];
    }

    if (principal.roleScope === "GLOBAL") {
      if (opts.require && !requested) {
        throw new BadRequestException("branchId is required");
      }
      return requested;
    }

    // Unknown/legacy scope: behave like GLOBAL, but keep strict require semantics
    if (opts.require && !requested) throw new BadRequestException("branchId is required");
    return requested;
  }

  /**
   * Throws if principal cannot access the supplied branchId.
   * (Use after resolveBranchId if you want explicit mismatch checks.)
   */
  assertBranchAccess(principal: Principal, branchId: string | null | undefined) {
    if (principal.roleScope === "GLOBAL") return;
    if (principal.roleScope === "BRANCH") {
      const allowed = Array.isArray((principal as any).branchIds) && (principal as any).branchIds.length
        ? (principal as any).branchIds
        : (principal.branchId ? [principal.branchId] : []);
      if (!allowed.length) throw new ForbiddenException("Branch-scoped principal missing branchId");
      if (!branchId || !allowed.includes(branchId)) {
        throw new ForbiddenException("Forbidden: cross-branch access");
      }
      return;
    }
  }
}
