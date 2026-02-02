import { Injectable } from "@nestjs/common";
import { IamPrincipalService } from "./iam-principal.service";

export type Principal = {
  userId: string;
  email: string;
  name: string;
  branchId: string | null;
  roleCode: string | null;
  roleScope: "GLOBAL" | "BRANCH" | null;
  roleVersionId: string | null;
  permissions: string[];
};

@Injectable()
export class AccessPolicyService {
  constructor(private principals: IamPrincipalService) {}

  /**
   * Loads the local DB user as a Principal (roleScope + permissions).
   *
   * Source of truth:
   *  - roleTemplateVersion (ACTIVE) permissions if roleVersionId exists
   *  - fallback: resolve latest ACTIVE version by roleTemplate.code
   *  - safety fallback: SUPER_ADMIN gets all permissions (DB-driven)
   *
   * NOTE: returns null for disabled users (isActive=false).
   */
  async loadPrincipalByEmail(emailRaw: string): Promise<Principal | null> {
    return this.principals.loadPrincipalByEmail(emailRaw);
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
   * BRANCH: allowed only for own branchId
   */
  canAccessBranch(principal: Principal, branchId: string | null | undefined) {
    if (principal.roleScope === "GLOBAL") return true;
    if (principal.roleScope === "BRANCH") {
      return !!principal.branchId && !!branchId && principal.branchId === branchId;
    }
    return false;
  }
}
