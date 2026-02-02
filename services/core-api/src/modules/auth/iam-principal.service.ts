import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";
import { ROLE } from "../iam/iam.constants";
import type { Principal } from "./access-policy.service";

@Injectable()
export class IamPrincipalService {
  constructor(@Inject("PRISMA") private prisma: PrismaClient) {}

  /**
   * Builds the effective Principal (roleCode + roleScope + permissions) for an authenticated user.
   *
   * Source of truth:
   *  - roleVersionId -> roleTemplateVersion permissions
   *  - fallback: resolve latest ACTIVE roleTemplateVersion by roleTemplate.code
   *  - safety: SUPER_ADMIN loads all permissions if missing (still DB-driven)
   *
   * Returns null for non-existent or disabled users.
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
    if (u.isActive === false) return null;

    // Normalize roleCode to stable uppercase string
    let roleCode = (u.roleVersion?.roleTemplate?.code ?? (u.role as any) ?? null) as string | null;
    roleCode = roleCode ? roleCode.trim().toUpperCase() : null;

    let roleScope = (u.roleVersion?.roleTemplate?.scope as any) ?? null;
    let roleVersionId = u.roleVersionId ?? null;

    // IMPORTANT: do NOT change permission code case.
    let perms: string[] =
      (u.roleVersion?.permissions || [])
        .filter((rp: any) => rp.allowed !== false)
        .map((rp: any) => rp.permission.code) ?? [];

    // Fallback: if user has role but no roleVersionId, resolve latest ACTIVE role version
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
          perms = (rv.permissions || [])
            .filter((rp: any) => rp.allowed !== false)
            .map((rp: any) => rp.permission.code);
        }
      }
    }

    // Infer scope if still missing
    if (!roleScope) {
      const corporateRole = (ROLE as any).CORPORATE_ADMIN ?? "CORPORATE_ADMIN";
      if (roleCode === ROLE.SUPER_ADMIN || roleCode === corporateRole) roleScope = "GLOBAL";
      else if (u.branchId) roleScope = "BRANCH";
    }

    // SUPER_ADMIN: always union all permissions from DB (enterprise default)
    // This prevents "new permission" rollout issues where SUPER_ADMIN would need role edits.
    if (roleCode === ROLE.SUPER_ADMIN) {
      const all = await this.prisma.permission.findMany({ select: { code: true } });
      perms = Array.from(new Set([...(perms || []), ...all.map((p) => p.code)]));
      roleScope = roleScope ?? "GLOBAL";
    }

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
}
