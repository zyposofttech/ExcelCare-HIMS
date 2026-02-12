import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { StaffWorkforceService } from "./staff-workforce.service";

type ApplyLeaveBody = {
  branchId?: string | null;
  leaveType: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string | null;
  meta?: any;
};

type LeaveActionBody = {
  stage: "RM" | "HR"; // Reporting Manager (HOD/BranchAdmin fallback) or HR (SuperAdmin)
  decision: "APPROVE" | "REJECT";
  note?: string | null;
};

@ApiTags("infrastructure/staff-workforce")
@Controller([
  "infrastructure",
  "infra",
  "infrastructure/human-resource",
  "infra/human-resource",
  "infrastructure/hr",
  "infra/hr",
])
export class StaffWorkforceController {
  constructor(private readonly svc: StaffWorkforceService) {}

  private principal(req: any) {
    return req.principal;
  }

  // ---------------- Leave Requests ----------------

  /**
   * Apply leave (self-service)
   * Flow:
   * - Staff -> HOD (Department Head)
   * - If no HOD: Branch Admin
   * - If no Branch Admin: Super Admin
   * - If requester is HOD: goes directly to Super Admin (HR stage)
   */
  @Post("staff/workforce/leaves")
  async applyLeave(@Req() req: any, @Body() body: ApplyLeaveBody) {
    return this.svc.applyLeave(this.principal(req), body);
  }

  /** List my leave requests */
  @Get("staff/workforce/leaves/my")
  async myLeaves(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
    @Query("from") from?: string, // YYYY-MM-DD
    @Query("to") to?: string, // YYYY-MM-DD
    @Query("take") take?: string,
  ) {
    return this.svc.listMyLeaves(this.principal(req), {
      branchId: branchId ?? null,
      status: status ?? null,
      from: from ?? null,
      to: to ?? null,
      take: take ? Number(take) : undefined,
    });
  }

  /**
   * Inbox for approvers (HOD / Branch Admin / Super Admin)
   * - Shows leave requests where the current user is the expected approver (based on meta routing)
   */
  @Get("staff/workforce/leaves/inbox")
  @Permissions(PERM.STAFF_READ)
  async inbox(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("stage") stage?: "RM" | "HR",
    @Query("take") take?: string,
  ) {
    return this.svc.listApprovalInbox(this.principal(req), {
      branchId: branchId ?? null,
      stage: stage ?? null,
      take: take ? Number(take) : undefined,
    });
  }

  /** Approve/Reject leave at RM or HR stage */
  @Post("staff/workforce/leaves/:leaveId/action")
  @Permissions(PERM.STAFF_UPDATE)
  async action(@Req() req: any, @Param("leaveId") leaveId: string, @Body() body: LeaveActionBody) {
    return this.svc.actOnLeave(this.principal(req), leaveId, body);
  }

  /** Cancel my leave (only when still SUBMITTED and not fully approved) */
  @Post("staff/workforce/leaves/:leaveId/cancel")
  async cancel(@Req() req: any, @Param("leaveId") leaveId: string, @Body() body?: { note?: string | null }) {
    return this.svc.cancelMyLeave(this.principal(req), leaveId, body?.note ?? null);
  }
}
