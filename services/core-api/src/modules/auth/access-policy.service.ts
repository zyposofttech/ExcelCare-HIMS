import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";

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

    let roleCode = u.roleVersion?.roleTemplate?.code ?? (u.role as any) ?? null;
    let roleScope = (u.roleVersion?.roleTemplate?.scope as any) ?? null;
    let roleVersionId = u.roleVersionId ?? null;

    let perms =
      (u.roleVersion?.permissions || []).map((rp: any) => rp.permission.code) ?? [];

    // ✅ Fallback: if user has role but no roleVersionId, resolve latest ACTIVE role version
    if (!roleVersionId && roleCode) {
      const tpl = await this.prisma.roleTemplate.findUnique({ where: { code: roleCode } });
      if (tpl) {
        const rv = await this.prisma.roleTemplateVersion.findFirst({
          where: { roleTemplateId: tpl.id, status: "ACTIVE" },
          orderBy: { version: "desc" },
          include: { roleTemplate: true, permissions: { include: { permission: true } } },
        });

        if (rv) {
          roleVersionId = rv.id;
          roleScope = (rv.roleTemplate?.scope as any) ?? roleScope;
          perms = (rv.permissions || []).map((rp: any) => rp.permission.code);
        }
      }
    }

    // ✅ Final fallback: if SUPER_ADMIN is somehow missing perms, load all from DB (still DB-driven)
    if (roleCode === "SUPER_ADMIN" && (!perms || perms.length === 0)) {
      const all = await this.prisma.permission.findMany({ select: { code: true } });
      perms = all.map((p) => p.code);
      roleScope = roleScope ?? "GLOBAL";
    }

    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      branchId: u.branchId ?? null,
      roleCode,
      roleScope,
      roleVersionId,
      permissions: perms,
    };
  }

  hasAll(principal: Principal, required: string[]) {
    if (!required?.length) return true;
    const set = new Set(principal.permissions || []);
    return required.every((p) => set.has(p));
  }
}
