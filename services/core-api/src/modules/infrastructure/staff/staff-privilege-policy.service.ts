import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";

/**
 * Clinical Privilege Policy
 *
 * - Enforces: "If staff does not have privilege => cannot perform action"
 * - Supports target-scoped privileges via (targetType, targetId)
 * - Uses effectiveFrom/effectiveTo time window
 *
 * IMPORTANT:
 * - Super Admin should NOT automatically become "clinician".
 *   We do not blanket-override privileges for SUPER_ADMIN.
 *   (If you want admin override for non-clinical admin actions, use allowAdminOverride=true.)
 */
@Injectable()
export class StaffPrivilegePolicyService {
  constructor(private readonly ctx: InfraContextService) {}

  private now() {
    return new Date();
  }

  private requireStaffId(principal: Principal) {
    if (!principal.staffId) {
      throw new ForbiddenException("No linked staff profile for this user.");
    }
    return principal.staffId;
  }

  private normalizeBranchId(principal: Principal, branchId?: string | null) {
    return this.ctx.resolveBranchId(principal, branchId ?? null);
  }

  private normalizeEnum(value: any, field: string) {
    const v = String(value ?? "").trim();
    if (!v) throw new BadRequestException(`${field} is required`);
    return v;
  }

  /**
   * Returns the logged-in user's privilege grants for a branch,
   * with `isEffectiveNow` computed.
   */
  async listMyPrivilegeGrants(
    principal: Principal,
    q: { branchId?: string | null; includeInactive?: boolean | null } = {},
  ) {
    const staffId = this.requireStaffId(principal);
    const branchId = this.normalizeBranchId(principal, q.branchId ?? null);
    const now = this.now();

    const where: any = {
      staffId,
      branchId,
      ...(q.includeInactive ? {} : { status: "ACTIVE" }),
    };

    const items = await this.ctx.prisma.staffPrivilegeGrant.findMany({
      where,
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      include: {
        branch: { select: { id: true, code: true, name: true } },
        staffAssignment: { select: { id: true, branchId: true, isPrimary: true, status: true } },
        grantedByUser: { select: { id: true, email: true } },
      },
      take: 500,
    });

    const computed = items.map((g) => {
      const fromOk = !g.effectiveFrom || g.effectiveFrom.getTime() <= now.getTime();
      const toOk = !g.effectiveTo || g.effectiveTo.getTime() >= now.getTime();
      const statusOk = g.status === ("ACTIVE" as any);
      return {
        ...g,
        isEffectiveNow: statusOk && fromOk && toOk,
      };
    });

    return { items: computed };
  }

  /**
   * Checks if the logged-in staff has an effective privilege.
   *
   * Matching rules:
   * - area + action must match
   * - targetType:
   *   - if caller asks for NONE -> only NONE grants considered
   *   - if caller asks for SERVICE_ITEM/DIAGNOSTIC_ITEM/ORDER_SET/OTHER:
   *        grant with targetType=NONE is treated as "wildcard"
   *        OR grant with same targetType and:
   *             - targetId is null (wildcard for all items)
   *             - OR targetId equals requested targetId (exact match)
   */
  async hasPrivilege(
    principal: Principal,
    input: {
      branchId?: string | null;
      area: string;
      action: string;
      targetType?: string | null;
      targetId?: string | null;
    },
    opts?: { allowAdminOverride?: boolean },
  ): Promise<boolean> {
    const branchId = this.normalizeBranchId(principal, input.branchId ?? null);

    // Optional admin override (use sparingly)
    const allowAdminOverride = opts?.allowAdminOverride === true;
    if (allowAdminOverride) {
      if (principal.roleCode === "SUPER_ADMIN" || principal.roleCode === "CORPORATE_ADMIN") {
        return true;
      }
    }

    const staffId = this.requireStaffId(principal);
    const now = this.now();

    const area = this.normalizeEnum(input.area, "area");
    const action = this.normalizeEnum(input.action, "action");

    const targetType = input.targetType ? String(input.targetType) : "NONE";
    const targetId = input.targetId ? String(input.targetId) : null;

    // base window condition
    const window = {
      status: "ACTIVE",
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    };

    // target logic
    let targetClause: any = { targetType: "NONE" };

    if (targetType && targetType !== "NONE") {
      // Accept:
      // - generic grants (NONE)
      // - scoped grants with exact targetType and (targetId NULL OR exact match)
      targetClause = {
        OR: [
          { targetType: "NONE" },
          {
            targetType,
            ...(targetId
              ? {
                  OR: [{ targetId: null }, { targetId }],
                }
              : {}),
          },
        ],
      };
    } else {
      // Caller asked NONE explicitly -> enforce NONE only
      targetClause = { targetType: "NONE" };
    }

    const found = await this.ctx.prisma.staffPrivilegeGrant.findFirst({
      where: {
        staffId,
        branchId,
        area,
        action,
        ...window,
        ...targetClause,
      } as any,
      select: { id: true },
    });

    return !!found?.id;
  }

  /**
   * Strong enforcement: throws if privilege is missing.
   */
  async assertHasPrivilege(
    principal: Principal,
    input: {
      branchId?: string | null;
      area: string;
      action: string;
      targetType?: string | null;
      targetId?: string | null;
      message?: string | null;
    },
    opts?: { allowAdminOverride?: boolean },
  ) {
    const ok = await this.hasPrivilege(principal, input, opts);
    if (!ok) {
      throw new ForbiddenException({
        message: input.message || "Clinical privilege required",
        code: "MISSING_CLINICAL_PRIVILEGE",
        area: input.area,
        action: input.action,
        targetType: input.targetType ?? "NONE",
        targetId: input.targetId ?? null,
      });
    }
    return true;
  }
}
