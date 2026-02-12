import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";
import { PERM, ROLE } from "../iam/iam.constants";
import type { Principal } from "./access-policy.service";
import { RedisService } from "./redis.service";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type StaffSummary = {
  id: string;
  empCode: string;
  name: string;
  designation: string;

  category: string;
  staffType?: string | null;
  status?: string | null;
  onboardingStatus?: string | null;

  hasSystemAccess?: boolean | null;

  primaryBranchId?: string | null;
  homeBranchId?: string | null;
};

type StaffAssignmentSummary = {
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

  // Branch-level flags (fast checks)
  canAdmitPatients?: boolean | null;
  canPerformSurgery?: boolean | null;
  hasOTPrivileges?: boolean | null;
};

@Injectable()
export class IamPrincipalService {
  private readonly principalCache = new Map<string, CacheEntry<Principal>>();
  private allPermsCache: CacheEntry<string[]> | null = null;

  private readonly ttlMs = Number(process.env.PRINCIPAL_CACHE_TTL_MS ?? 5 * 60 * 1000);
  private readonly maxEntries = Number(process.env.PRINCIPAL_CACHE_MAX ?? 4000);
  private readonly allPermsTtlMs = Number(process.env.ALL_PERMS_CACHE_TTL_MS ?? 5 * 60 * 1000);

  constructor(
    @Inject("PRISMA") private prisma: PrismaClient,
    private readonly redis: RedisService,
  ) {}

  private now() {
    return Date.now();
  }

  private cacheKey(userId: string, authzVersion: number) {
    return `principal:${userId}:${authzVersion}`;
  }

  private async getRedisPrincipal(key: string): Promise<Principal | null> {
    if (!this.redis.isEnabled()) return null;
    return this.redis.getJson<Principal>(key);
  }

  private async setRedisPrincipal(key: string, principal: Principal) {
    if (!this.redis.isEnabled()) return;
    await this.redis.setJson(key, principal, this.ttlMs);
  }

  private getCached(key: string): Principal | null {
    const entry = this.principalCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.principalCache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setCached(key: string, principal: Principal) {
    this.principalCache.set(key, { value: principal, expiresAt: this.now() + this.ttlMs });

    // Basic size cap: drop oldest keys if we exceed the max.
    if (this.principalCache.size > this.maxEntries) {
      const overflow = this.principalCache.size - this.maxEntries;
      let n = Math.max(overflow, Math.ceil(this.maxEntries * 0.1));
      for (const k of this.principalCache.keys()) {
        this.principalCache.delete(k);
        n--;
        if (n <= 0) break;
      }
    }
  }

  private async getAllPermissionCodes(): Promise<string[]> {
    const now = this.now();
    if (this.allPermsCache && this.allPermsCache.expiresAt > now) return this.allPermsCache.value;

    // L2 cache (Redis) for horizontal scaling
    if (this.redis.isEnabled()) {
      const cached = await this.redis.getJson<string[]>("auth:all-perms");
      if (cached && Array.isArray(cached)) {
        this.allPermsCache = { value: cached, expiresAt: now + this.allPermsTtlMs };
        return cached;
      }
    }

    const all = await this.prisma.permission.findMany({ select: { code: true } });
    const codes = all.map((p) => p.code);
    this.allPermsCache = { value: codes, expiresAt: now + this.allPermsTtlMs };

    if (this.redis.isEnabled()) {
      await this.redis.setJson("auth:all-perms", codes, this.allPermsTtlMs);
    }

    return codes;
  }

  private isAssignmentEffectiveNow(a: any, now: Date) {
    if (!a) return false;
    if (a.isActive === false) return false;

    // status gate
    if (a.status && String(a.status).toUpperCase() !== "ACTIVE") return false;

    // approval gate
    // If approval is required, ensure it is approved; otherwise still prefer APPROVED.
    const approvalStatus = a.approvalStatus ? String(a.approvalStatus).toUpperCase() : "APPROVED";
    const requiresApproval = a.requiresApproval === true;
    if (requiresApproval && approvalStatus !== "APPROVED") return false;
    if (!requiresApproval && approvalStatus && approvalStatus === "REJECTED") return false;

    const fromOk = !a.effectiveFrom || new Date(a.effectiveFrom).getTime() <= now.getTime();
    const toOk = !a.effectiveTo || new Date(a.effectiveTo).getTime() >= now.getTime();
    return fromOk && toOk;
  }

  private pickEffectiveAssignment(assignments: any[], effectiveBranchId: string | null) {
    const now = new Date();
    const active = (assignments || []).filter((a) => this.isAssignmentEffectiveNow(a, now));
    if (!active.length) return null;

    if (effectiveBranchId) {
      const inBranch = active.filter((a) => a.branchId === effectiveBranchId);
      if (inBranch.length) {
        return inBranch.find((a) => a.isPrimary) ?? inBranch[0];
      }
    }

    return active.find((a) => a.isPrimary) ?? active[0];
  }

  private toStaffSummary(staff: any): StaffSummary | null {
    if (!staff?.id) return null;
    return {
      id: staff.id,
      empCode: staff.empCode,
      name: staff.name,
      designation: staff.designation,

      category: String(staff.category ?? "NON_CLINICAL"),
      staffType: staff.staffType ?? null,
      status: staff.status ?? null,
      onboardingStatus: staff.onboardingStatus ?? null,

      hasSystemAccess: staff.hasSystemAccess ?? null,

      primaryBranchId: staff.primaryBranchId ?? null,
      homeBranchId: staff.homeBranchId ?? null,
    };
  }

  private toAssignmentSummary(a: any): StaffAssignmentSummary | null {
    if (!a?.id) return null;
    return {
      id: a.id,
      staffId: a.staffId,

      branchId: a.branchId,
      facilityId: a.facilityId ?? null,
      departmentId: a.departmentId ?? null,
      specialtyId: a.specialtyId ?? null,
      unitId: a.unitId ?? null,

      designation: a.designation ?? null,
      role: a.role ?? null,

      assignmentType: a.assignmentType ?? null,
      status: a.status ?? null,

      effectiveFrom: a.effectiveFrom ? new Date(a.effectiveFrom).toISOString() : null,
      effectiveTo: a.effectiveTo ? new Date(a.effectiveTo).toISOString() : null,

      isPrimary: a.isPrimary ?? null,
      isActive: a.isActive ?? null,

      requiresApproval: a.requiresApproval ?? null,
      approvalStatus: a.approvalStatus ?? null,

      canAdmitPatients: a.canAdmitPatients ?? null,
      canPerformSurgery: a.canPerformSurgery ?? null,
      hasOTPrivileges: a.hasOTPrivileges ?? null,
    };
  }

  private async buildPrincipalFromUser(fullUser: any, authzVersion: number): Promise<Principal> {
    // Normalize roleCode to stable uppercase string
    let roleCode = (fullUser.roleVersion?.roleTemplate?.code ?? (fullUser.role as any) ?? null) as string | null;
    roleCode = roleCode ? roleCode.trim().toUpperCase() : null;

    let roleScope = (fullUser.roleVersion?.roleTemplate?.scope as any) ?? null;
    let roleVersionId = fullUser.roleVersionId ?? null;

    // IMPORTANT: do NOT change permission code case.
    let perms: string[] =
      (fullUser.roleVersion?.permissions || [])
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
      else if (fullUser.branchId) roleScope = "BRANCH";
    }

    /**
     * ✅ SUPER_ADMIN bootstrap safety:
     * - Always include ALL code-defined permission codes (PERM)
     * - Also union all DB permission rows (for extensions)
     */
    if (roleCode === ROLE.SUPER_ADMIN) {
      const allDb = await this.getAllPermissionCodes();
      const allCodeDefined = Object.values(PERM);
      perms = Array.from(new Set([...(perms || []), ...allDb, ...allCodeDefined]));
      roleScope = roleScope ?? "GLOBAL";
    }

    const uniquePerms = Array.from(new Set(perms || []));

    // Multi-branch branchIds derived from active UserRoleBinding rows (if present)
    const now = new Date();
    const rawBindings = (fullUser as any).roleBindings ?? [];

    const activeBindings = Array.isArray(rawBindings)
      ? rawBindings.filter((b: any) => {
          if (!b?.branchId) return false;
          if (b.isActive === false) return false;

          const fromOk = !b.effectiveFrom || new Date(b.effectiveFrom).getTime() <= now.getTime();
          const toOk = !b.effectiveTo || new Date(b.effectiveTo).getTime() >= now.getTime();
          return fromOk && toOk;
        })
      : [];

    const branchIds = Array.from(new Set(activeBindings.map((b: any) => b.branchId)));
    const primaryBinding = activeBindings.find((b: any) => b.isPrimary) ?? activeBindings[0] ?? null;

    // Default effective branch:
    // 1) primary role binding branch
    // 2) user.branchId
    // 3) staff.primaryBranchId (if user has a linked staff)
    const staffPrimaryBranchId = fullUser?.staff?.primaryBranchId ?? null;
    const effectiveBranchId = primaryBinding?.branchId ?? (fullUser.branchId ?? staffPrimaryBranchId ?? null);

    // ---- Staff context (CRITICAL FOR: privileging + leave routing + audit) ----
    const staff = this.toStaffSummary(fullUser?.staff);
    const staffId = fullUser?.staffId ?? staff?.id ?? null;

    const allAssignments = Array.isArray(fullUser?.staff?.assignments) ? fullUser.staff.assignments : [];
    const effectiveAssignmentRaw = this.pickEffectiveAssignment(allAssignments, effectiveBranchId);
    const effectiveAssignment = this.toAssignmentSummary(effectiveAssignmentRaw);

    const staffBranchIds = Array.from(
      new Set(
        allAssignments
          .filter((a: any) => this.isAssignmentEffectiveNow(a, now))
          .map((a: any) => a.branchId)
          .filter(Boolean),
      ),
    );

    return {
      userId: fullUser.id,
      email: fullUser.email,
      name: fullUser.name,

      // Existing behavior
      branchId: effectiveBranchId,
      branchIds: branchIds.length ? branchIds : undefined,

      roleCode,
      roleScope,
      roleVersionId,
      authzVersion,
      permissions: uniquePerms,

      // ✅ NEW: staff identity + effective assignment for the selected/effective branch
      staffId,
      staff: staff ?? undefined,
      staffBranchIds: staffBranchIds.length ? staffBranchIds : undefined,
      staffAssignment: effectiveAssignment ?? undefined,

      // Convenience shortcuts (helps FE + leave module)
      departmentId: effectiveAssignment?.departmentId ?? undefined,
      unitId: effectiveAssignment?.unitId ?? undefined,
      specialtyId: effectiveAssignment?.specialtyId ?? undefined,
    } as unknown as Principal;
  }

  /**
   * Primary entrypoint for requests (fast path): loads by userId, enforces authzVersion token invalidation,
   * then returns cached principal keyed by (userId, authzVersion).
   */
  async loadPrincipalByUserId(userIdRaw: string, tokenAuthzVersion?: any): Promise<Principal | null> {
    const userId = (userIdRaw || "").trim();
    if (!userId) return null;

    // Cheap auth state query (no heavy joins)
    const u0 = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        branchId: true,
        role: true,
        roleVersionId: true,
        staffId: true,
        isActive: true,
        authzVersion: true as any,
      },
    });

    if (!u0) return null;
    if (u0.isActive === false) return null;

    const authzVersion = Number((u0 as any).authzVersion ?? 1);

    // Token invalidation on auth changes.
    // Default: enforced. Can be disabled temporarily by setting AUTHZ_TOKEN_ENFORCE=false.
    const enforce = process.env.AUTHZ_TOKEN_ENFORCE !== "false";
    if (enforce) {
      const t = tokenAuthzVersion === undefined ? 0 : Number(tokenAuthzVersion);
      const tokenVer = Number.isFinite(t) ? t : 0;
      if (tokenVer < authzVersion) {
        throw new UnauthorizedException("Session expired (authorization changed)");
      }
    }

    const key = this.cacheKey(u0.id, authzVersion);
    const cached = this.getCached(key);
    if (cached) return cached;

    // L2 redis cache
    const fromRedis = await this.getRedisPrincipal(key);
    if (fromRedis) {
      this.setCached(key, fromRedis);
      return fromRedis;
    }

    const full = await this.prisma.user.findUnique({
      where: { id: u0.id },
      include: {
        roleVersion: {
          include: {
            roleTemplate: true,
            permissions: { include: { permission: true } },
          },
        },
        roleBindings: {
          where: { isActive: true },
          select: {
            branchId: true,
            isPrimary: true,
            isActive: true,
            effectiveFrom: true,
            effectiveTo: true,
          },
        },
        // ✅ CRITICAL: link user -> staff and pull active assignments for branch context
        staff: {
          select: {
            id: true,
            empCode: true,
            name: true,
            designation: true,

            category: true,
            staffType: true,
            status: true,
            onboardingStatus: true,
            hasSystemAccess: true,

            primaryBranchId: true,
            homeBranchId: true,

            assignments: {
              where: { isActive: true },
              select: {
                id: true,
                staffId: true,
                branchId: true,
                facilityId: true,
                departmentId: true,
                specialtyId: true,
                unitId: true,
                designation: true,
                role: true,
                assignmentType: true,
                status: true,
                effectiveFrom: true,
                effectiveTo: true,
                isPrimary: true,
                isActive: true,
                requiresApproval: true,
                approvalStatus: true,
                canAdmitPatients: true,
                canPerformSurgery: true,
                hasOTPrivileges: true,
              },
            },
          },
        },
      },
    });

    if (!full) return null;
    if ((full as any).isActive === false) return null;

    const principal = await this.buildPrincipalFromUser(full, authzVersion);
    this.setCached(key, principal);
    await this.setRedisPrincipal(key, principal);
    return principal;
  }

  /**
   * Builds the effective Principal (roleCode + roleScope + permissions) for an authenticated user.
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
        roleBindings: {
          where: { isActive: true },
          select: {
            branchId: true,
            isPrimary: true,
            isActive: true,
            effectiveFrom: true,
            effectiveTo: true,
          },
        },
        staff: {
          select: {
            id: true,
            empCode: true,
            name: true,
            designation: true,
            category: true,
            staffType: true,
            status: true,
            onboardingStatus: true,
            hasSystemAccess: true,
            primaryBranchId: true,
            homeBranchId: true,
            assignments: {
              where: { isActive: true },
              select: {
                id: true,
                staffId: true,
                branchId: true,
                facilityId: true,
                departmentId: true,
                specialtyId: true,
                unitId: true,
                designation: true,
                role: true,
                assignmentType: true,
                status: true,
                effectiveFrom: true,
                effectiveTo: true,
                isPrimary: true,
                isActive: true,
                requiresApproval: true,
                approvalStatus: true,
                canAdmitPatients: true,
                canPerformSurgery: true,
                hasOTPrivileges: true,
              },
            },
          },
        },
      },
    });

    if (!u) return null;
    if (u.isActive === false) return null;

    const authzVersion = Number((u as any).authzVersion ?? 1);
    return this.buildPrincipalFromUser(u, authzVersion);
  }
}
