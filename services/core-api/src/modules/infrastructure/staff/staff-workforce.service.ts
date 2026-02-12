import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@zypocare/db";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";

type ApplyLeaveInput = {
  branchId?: string | null;
  leaveType: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string | null;
  meta?: any;
};

type ListLeavesInput = {
  branchId?: string | null;
  status?: string | null;
  from?: string | null; // YYYY-MM-DD
  to?: string | null; // YYYY-MM-DD
  take?: number;
};

type InboxInput = {
  branchId?: string | null;
  stage?: "RM" | "HR" | null;
  take?: number;
};

type LeaveActionInput = {
  stage: "RM" | "HR";
  decision: "APPROVE" | "REJECT";
  note?: string | null;
};

function parseDateOnly(yyyyMmDd: string): Date {
  const s = String(yyyyMmDd || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new BadRequestException(`Invalid date format: ${yyyyMmDd}. Use YYYY-MM-DD`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Store as UTC date-only.
  return new Date(Date.UTC(y, mo - 1, d));
}

function overlapInclusive(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() <= bEnd.getTime() && aEnd.getTime() >= bStart.getTime();
}

@Injectable()
export class StaffWorkforceService {
  constructor(private readonly ctx: InfraContextService) {}

  private requireStaff(principal: Principal) {
    const staffId = (principal.staffId ?? "").trim();
    if (!staffId) throw new ForbiddenException("No linked staff profile for this user.");
    return staffId;
  }

  private async getEffectiveAssignment(staffId: string, branchId: string) {
    const rows = await this.ctx.prisma.staffAssignment.findMany({
      where: {
        staffId,
        branchId,
        isActive: true,
        status: "ACTIVE",
      } as any,
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
      take: 20,
      select: {
        id: true,
        staffId: true,
        branchId: true,
        departmentId: true,
        requiresApproval: true,
        approvalStatus: true,
        isPrimary: true,
      },
    });

    // Only consider approved assignments if approval is required
    const effective =
      rows.find((a) => a.requiresApproval ? a.approvalStatus === "APPROVED" : true) ?? null;

    return effective;
  }

  private async resolveSuperAdminApproverUserId(): Promise<string> {
    const u = await this.ctx.prisma.user.findFirst({
      where: { isActive: true, role: "SUPER_ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!u?.id) throw new BadRequestException("No active SUPER_ADMIN user found for HR approval.");
    return u.id;
  }

  private async resolveBranchAdminApproverUserId(branchId: string): Promise<string | null> {
    const now = new Date();

    // Prefer explicit multi-branch role bindings
    const binding = await this.ctx.prisma.userRoleBinding.findFirst({
      where: {
        branchId,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        roleVersion: {
          roleTemplate: { code: "BRANCH_ADMIN" },
        },
      } as any,
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: { userId: true },
    });

    if (binding?.userId) {
      const u = await this.ctx.prisma.user.findFirst({
        where: { id: binding.userId, isActive: true },
        select: { id: true },
      });
      if (u?.id) return u.id;
    }

    // Fallback: legacy single-branch role on User
    const u2 = await this.ctx.prisma.user.findFirst({
      where: { isActive: true, role: "BRANCH_ADMIN", branchId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    return u2?.id ?? null;
  }

  private async resolveHodApproverUserId(branchId: string, departmentId: string) {
    const dept = await this.ctx.prisma.department.findFirst({
      where: { id: departmentId, branchId, isActive: true },
      select: { id: true, headStaffId: true },
    });

    if (!dept?.id) return { hodStaffId: null as string | null, hodUserId: null as string | null };

    if (!dept.headStaffId) {
      return { hodStaffId: null as string | null, hodUserId: null as string | null };
    }

    const hodUser = await this.ctx.prisma.user.findFirst({
      where: { isActive: true, staffId: dept.headStaffId },
      select: { id: true },
    });

    return {
      hodStaffId: dept.headStaffId,
      hodUserId: hodUser?.id ?? null,
    };
  }

  private pushHistory(meta: any, entry: any) {
    const m = meta && typeof meta === "object" ? meta : {};
    const history = Array.isArray(m.history) ? m.history : [];
    history.push(entry);
    return { ...m, history };
  }

  // ------------------------------------------------------------
  // Leave workflow
  // ------------------------------------------------------------

  /**
   * Apply leave (self)
   * Routing:
   *  - Staff -> HOD (dept head)
   *  - If no HOD or HOD has no user -> Branch Admin
   *  - If no Branch Admin -> Super Admin
   *  - If requester is HOD -> directly to Super Admin (RM stage bypass)
   */
  async applyLeave(principal: Principal, input: ApplyLeaveInput) {
    const staffId = this.requireStaff(principal);
    const branchId = this.ctx.resolveBranchId(principal, input.branchId ?? null);

    const leaveType = String(input.leaveType ?? "").trim();
    if (!leaveType) throw new BadRequestException("leaveType is required");

    const start = parseDateOnly(input.startDate);
    const end = parseDateOnly(input.endDate);
    if (start.getTime() > end.getTime()) throw new BadRequestException("startDate must be <= endDate");

    // Prevent overlaps with other SUBMITTED/APPROVED leaves
    const existing = await this.ctx.prisma.staffLeaveRequest.findMany({
      where: {
        staffId,
        branchId,
        status: { in: ["SUBMITTED", "APPROVED"] },
      } as any,
      select: { id: true, startDate: true, endDate: true, status: true },
      take: 200,
    });

    const overlapping = existing.find((r) => overlapInclusive(r.startDate, r.endDate, start, end));
    if (overlapping) {
      throw new BadRequestException(
        `Leave overlaps with an existing ${overlapping.status} request (${overlapping.id}).`,
      );
    }

    // Determine department from assignment (preferred)
    const assignment = await this.getEffectiveAssignment(staffId, branchId);
    const departmentId = assignment?.departmentId ?? null;

    const { hodStaffId, hodUserId } = departmentId
      ? await this.resolveHodApproverUserId(branchId, departmentId)
      : { hodStaffId: null as string | null, hodUserId: null as string | null };

    const superAdminUserId = await this.resolveSuperAdminApproverUserId();
    const branchAdminUserId = await this.resolveBranchAdminApproverUserId(branchId);

    // If requester is HOD (by staffId match), bypass RM stage
    const requesterIsHod = !!hodStaffId && hodStaffId === staffId;

    // Resolve RM approver user
    let rmApproverUserId: string | null = null;
    let rmApproverType: "HOD" | "BRANCH_ADMIN" | "SUPER_ADMIN" | "NONE" = "NONE";
    let rmBypassed = false;

    if (requesterIsHod) {
      rmBypassed = true;
      rmApproverUserId = null;
      rmApproverType = "NONE";
    } else if (hodUserId) {
      rmApproverUserId = hodUserId;
      rmApproverType = "HOD";
    } else if (branchAdminUserId) {
      rmApproverUserId = branchAdminUserId;
      rmApproverType = "BRANCH_ADMIN";
    } else {
      rmApproverUserId = superAdminUserId;
      rmApproverType = "SUPER_ADMIN";
    }

    // HR approver is always Super Admin (as per your requirement)
    const hrApproverUserId = superAdminUserId;

    // Build meta routing
    const routing = {
      departmentId,
      hodStaffId,
      rmApproverUserId,
      rmApproverType,
      rmStageBypassed: rmBypassed,
      hrApproverUserId,
      hrApproverType: "SUPER_ADMIN",
      resolvedAt: new Date().toISOString(),
    };

    let meta: any = input.meta && typeof input.meta === "object" ? input.meta : {};
    meta = { ...meta, routing };

    meta = this.pushHistory(meta, {
      at: new Date().toISOString(),
      byUserId: principal.userId,
      action: "LEAVE_APPLIED",
      range: { startDate: input.startDate, endDate: input.endDate },
      leaveType,
    });

    const created = await this.ctx.prisma.staffLeaveRequest.create({
      data: {
        staffId,
        branchId,
        leaveType,
        startDate: start,
        endDate: end,
        reason: input.reason ? String(input.reason).slice(0, 240) : null,
        status: "SUBMITTED",

        // If HOD applies, RM approval is considered bypassed/auto-approved
        reportingManagerApproval: rmBypassed ? "APPROVED" : "PENDING",
        reportingManagerApprovedAt: rmBypassed ? new Date() : null,
        reportingManagerApprovedByUserId: null,

        hrApproval: "PENDING",
        hrApprovedAt: null,
        hrApprovedByUserId: null,

        meta: meta as Prisma.InputJsonValue,
      } as any,
      include: {
        staff: { select: { id: true, empCode: true, name: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "STAFF_LEAVE_APPLIED",
      entity: "StaffLeaveRequest",
      entityId: created.id,
      meta: { routing, staffId, leaveType, startDate: input.startDate, endDate: input.endDate },
    });

    return { item: created };
  }

  async listMyLeaves(principal: Principal, q: ListLeavesInput) {
    const staffId = this.requireStaff(principal);
    const branchId = q.branchId ? this.ctx.resolveBranchId(principal, q.branchId) : null;

    const where: any = { staffId };
    if (branchId) where.branchId = branchId;
    if (q.status) {
      const s = String(q.status).trim().toUpperCase();
      where.status = s === "APPLIED" ? "SUBMITTED" : s;
    }

    if (q.from) where.startDate = { gte: parseDateOnly(q.from) };
    if (q.to) where.endDate = { lte: parseDateOnly(q.to) };

    const items = await this.ctx.prisma.staffLeaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.take && q.take > 0 ? Math.min(q.take, 200) : 50,
      include: {
        branch: { select: { id: true, code: true, name: true } },
      },
    });

    return { items };
  }

  /**
   * Approver inbox:
   * - RM stage: reportingManagerApproval=PENDING and meta.routing.rmApproverUserId==me
   * - HR stage: hrApproval=PENDING and meta.routing.hrApproverUserId==me and RM already approved/bypassed
   */
  async listApprovalInbox(principal: Principal, q: InboxInput) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    const me = principal.userId;

    const take = q.take && q.take > 0 ? Math.min(q.take, 200) : 50;

    const stage = q.stage ?? null;
    const whereBase: any = { branchId, status: "SUBMITTED" };

    const jsonRm = { path: ["routing", "rmApproverUserId"], equals: me } as any;
    const jsonHr = { path: ["routing", "hrApproverUserId"], equals: me } as any;

    let where: any;

    if (stage === "RM") {
      where = {
        ...whereBase,
        reportingManagerApproval: "PENDING",
        meta: jsonRm,
      };
    } else if (stage === "HR") {
      where = {
        ...whereBase,
        hrApproval: "PENDING",
        reportingManagerApproval: "APPROVED",
        meta: jsonHr,
      };
    } else {
      // both stages (OR)
      where = {
        ...whereBase,
        OR: [
          { reportingManagerApproval: "PENDING", meta: jsonRm },
          { hrApproval: "PENDING", reportingManagerApproval: "APPROVED", meta: jsonHr },
        ],
      };
    }

    const items = await this.ctx.prisma.staffLeaveRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        staff: { select: { id: true, empCode: true, name: true, designation: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    });

    return { items };
  }

  async actOnLeave(principal: Principal, leaveId: string, input: LeaveActionInput) {
    const me = principal.userId;

    const leave = await this.ctx.prisma.staffLeaveRequest.findUnique({
      where: { id: leaveId },
      include: { staff: { select: { id: true, empCode: true, name: true } } },
    });

    if (!leave) throw new NotFoundException("Leave request not found");
    if (leave.status !== "SUBMITTED") throw new BadRequestException("Leave request is not in SUBMITTED state");

    const routing = (leave.meta as any)?.routing ?? {};
    const now = new Date();

    const decision = String(input.decision).toUpperCase();
    if (decision !== "APPROVE" && decision !== "REJECT") throw new BadRequestException("Invalid decision");

    if (input.stage === "RM") {
      // Must match routed RM approver
      if (!routing?.rmApproverUserId || routing.rmApproverUserId !== me) {
        throw new ForbiddenException("You are not the assigned RM approver for this request.");
      }
      if (leave.reportingManagerApproval !== "PENDING") {
        throw new BadRequestException("RM stage is not pending for this leave request.");
      }

      const nextMeta = this.pushHistory(leave.meta, {
        at: now.toISOString(),
        byUserId: me,
        action: decision === "APPROVE" ? "LEAVE_RM_APPROVED" : "LEAVE_RM_REJECTED",
        note: input.note ?? null,
      });

      const updated = await this.ctx.prisma.staffLeaveRequest.update({
        where: { id: leaveId },
        data: {
          reportingManagerApproval: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          reportingManagerApprovedByUserId: me,
          reportingManagerApprovedAt: now,

          status: decision === "APPROVE" ? "SUBMITTED" : "REJECTED",
          meta: nextMeta as Prisma.InputJsonValue,
        } as any,
      });

      await this.ctx.audit.log({
        branchId: leave.branchId,
        actorUserId: me,
        action: decision === "APPROVE" ? "STAFF_LEAVE_RM_APPROVED" : "STAFF_LEAVE_RM_REJECTED",
        entity: "StaffLeaveRequest",
        entityId: leaveId,
        meta: { note: input.note ?? null },
      });

      return { item: updated };
    }

    // HR stage
    if (input.stage === "HR") {
      if (!routing?.hrApproverUserId || routing.hrApproverUserId !== me) {
        throw new ForbiddenException("You are not the assigned HR approver for this request.");
      }
      if (leave.hrApproval !== "PENDING") {
        throw new BadRequestException("HR stage is not pending for this leave request.");
      }
      if (leave.reportingManagerApproval !== "APPROVED") {
        throw new BadRequestException("RM approval is required before HR action.");
      }

      const nextMeta = this.pushHistory(leave.meta, {
        at: now.toISOString(),
        byUserId: me,
        action: decision === "APPROVE" ? "LEAVE_HR_APPROVED" : "LEAVE_HR_REJECTED",
        note: input.note ?? null,
      });

      const updated = await this.ctx.prisma.staffLeaveRequest.update({
        where: { id: leaveId },
        data: {
          hrApproval: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          hrApprovedByUserId: me,
          hrApprovedAt: now,

          status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
          meta: nextMeta as Prisma.InputJsonValue,
        } as any,
      });

      await this.ctx.audit.log({
        branchId: leave.branchId,
        actorUserId: me,
        action: decision === "APPROVE" ? "STAFF_LEAVE_HR_APPROVED" : "STAFF_LEAVE_HR_REJECTED",
        entity: "StaffLeaveRequest",
        entityId: leaveId,
        meta: { note: input.note ?? null },
      });

      return { item: updated };
    }

    throw new BadRequestException("Invalid stage");
  }

  async cancelMyLeave(principal: Principal, leaveId: string, note?: string | null) {
    const staffId = this.requireStaff(principal);
    const me = principal.userId;

    const leave = await this.ctx.prisma.staffLeaveRequest.findUnique({
      where: { id: leaveId },
      select: {
        id: true,
        staffId: true,
        branchId: true,
        status: true,
        hrApproval: true,
        meta: true,
      },
    });

    if (!leave) throw new NotFoundException("Leave request not found");
    if (leave.staffId !== staffId) throw new ForbiddenException("You can cancel only your own leave request.");
    if (leave.status !== "SUBMITTED") throw new BadRequestException("Only SUBMITTED leave requests can be cancelled.");
    if (leave.hrApproval === "APPROVED") throw new BadRequestException("Cannot cancel after HR approval.");

    const now = new Date();
    const nextMeta = this.pushHistory(leave.meta, {
      at: now.toISOString(),
      byUserId: me,
      action: "LEAVE_CANCELLED",
      note: note ?? null,
    });

    const updated = await this.ctx.prisma.staffLeaveRequest.update({
      where: { id: leaveId },
      data: {
        status: "CANCELLED",
        meta: nextMeta as Prisma.InputJsonValue,
      } as any,
    });

    await this.ctx.audit.log({
      branchId: leave.branchId,
      actorUserId: me,
      action: "STAFF_LEAVE_CANCELLED",
      entity: "StaffLeaveRequest",
      entityId: leaveId,
      meta: { note: note ?? null },
    });

    return { item: updated };
  }
}
