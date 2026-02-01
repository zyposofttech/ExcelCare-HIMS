import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";
import { ROLE } from "../iam/iam.constants";

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
  constructor(@Inject("PRISMA") private prisma: PrismaClient) {}

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
    const email = (emailRaw || "").trim().toLowerCase();
    if (!email) return null;

    const u = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roleVersion: {
          include: {
            roleTemplate: true,
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (!u) return null;

    // ✅ Block disabled accounts early (prevents old JWTs continuing to work)
    if (u.isActive === false) return null;

    // Normalize roleCode to a stable uppercase string
    let roleCode = (u.roleVersion?.roleTemplate?.code ?? (u.role as any) ?? null) as string | null;
    roleCode = roleCode ? roleCode.trim().toUpperCase() : null;

    let roleScope = (u.roleVersion?.roleTemplate?.scope as any) ?? null;
    let roleVersionId = u.roleVersionId ?? null;

    let perms: string[] =
      (u.roleVersion?.permissions || []).map((rp: any) => rp.permission.code) ?? [];

    // ✅ Fallback: if user has role but no roleVersionId, resolve latest ACTIVE role version
    if (!roleVersionId && roleCode) {
      const tpl = await this.prisma.roleTemplate.findUnique({ where: { code: roleCode } });
      if (tpl) {
        const rv = await this.prisma.roleTemplateVersion.findFirst({
          where: { roleTemplateId: tpl.id, status: "ACTIVE" },
          orderBy: { version: "desc" },
          include: {
            roleTemplate: true,
            permissions: { include: { permission: true } },
          },
        });

        if (rv) {
          roleVersionId = rv.id;
          roleScope = (rv.roleTemplate?.scope as any) ?? roleScope;
          perms = (rv.permissions || []).map((rp: any) => rp.permission.code);
        }
      }
    }

    // ✅ Normalize / infer scope if still missing (prevents confusing UI + guard behavior)
    if (!roleScope) {
      const corporateRole = (ROLE as any).CORPORATE_ADMIN ?? "CORPORATE_ADMIN";
      if (roleCode === ROLE.SUPER_ADMIN || roleCode === corporateRole) roleScope = "GLOBAL";
      else if (u.branchId) roleScope = "BRANCH";
    }

    // ✅ SUPER_ADMIN safety fallback: if somehow missing perms, load all perms from DB (still DB-driven)
    if (roleCode === ROLE.SUPER_ADMIN && (!perms || perms.length === 0)) {
      const all = await this.prisma.permission.findMany({ select: { code: true } });
      perms = all.map((p) => p.code);
      roleScope = roleScope ?? "GLOBAL";
    }

    // ✅ De-dupe permissions (seed/merge flows can create duplicates)
    const uniquePerms = Array.from(new Set(perms || []));

    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      branchId: u.branchId ?? null,
      roleCode,
      roleScope,
      roleVersionId,
      permissions: uniquePerms,
    };
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
