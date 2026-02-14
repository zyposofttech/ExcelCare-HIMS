import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { ComplianceContextService } from "../compliance-context.service";
import type { CreateApprovalDto, DecideApprovalDto } from "./dto/approvals.dto";

@Injectable()
export class ApprovalsService {
  constructor(private readonly ctx: ComplianceContextService) { }

  private shape(row: any) {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      entityType: row.entityType,
      entityId: row.entityId,
      changeType: row.changeType,
      status: row.status,
      notes: row.notes ?? null,
      requestedAt: row.requestedAt,
      decidedAt: row.decidedAt ?? null,
      requestedById: row.requestedByStaffId,
      requestedByName: row.requestedBy?.name ?? null,
      decidedById: row.decidedByStaffId ?? null,
      decidedByName: row.decidedBy?.name ?? null,
      decisionNotes: row.decisionNotes ?? null,
      payloadDraft: row.payloadDraft,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async list(
    principal: Principal,
    query: {
      workspaceId?: string;
      branchId?: string;
      status?: string;
      cursor?: string;
      take?: number;
    },
  ) {
    const take = Math.min(Math.max(query.take ?? 50, 1), 200);
    const where: any = {};

    if (query.workspaceId) {
      await this.ctx.assertWorkspaceAccess(principal, query.workspaceId);
      where.workspaceId = query.workspaceId;
    } else if (query.branchId) {
      const bid = this.ctx.resolveBranchId(principal, query.branchId);
      where.workspace = { branchId: bid };
    }

    if (query.status) {
      where.status = query.status;
    } else {
      // UI "history" tab calls without status: show terminal decisions by default
      where.status = { in: ["APPROVED", "REJECTED"] };
    }

    const findArgs: any = {
      where,
      orderBy: [{ createdAt: "desc" }],
      take: take + 1,
      include: {
        requestedBy: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
      },
    };
    if (query.cursor) {
      findArgs.cursor = { id: query.cursor };
      findArgs.skip = 1;
    }

    const rows = await (this.ctx.prisma as any).complianceApproval.findMany(findArgs);
    const hasMore = rows.length > take;
    const itemsRaw = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore && itemsRaw.length ? itemsRaw[itemsRaw.length - 1].id : null;

    const items = itemsRaw.map((r: any) => this.shape(r));
    return { items, nextCursor, take };
  }

  async getOne(principal: Principal, approvalId: string) {
    const row = await (this.ctx.prisma as any).complianceApproval.findUnique({
      where: { id: approvalId },
      include: {
        requestedBy: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException("Approval not found");
    await this.ctx.assertWorkspaceAccess(principal, row.workspaceId);
    return this.shape(row);
  }

  async create(principal: Principal, dto: CreateApprovalDto) {
    await this.ctx.assertWorkspaceAccess(principal, dto.workspaceId);
    const actorStaffId = await this.ctx.requireActorStaffId(principal);

    const approval = await this.ctx.prisma.$transaction(async (tx) => {
      const created = await tx.complianceApproval.create({
        data: {
          workspaceId: dto.workspaceId,
          changeType: dto.changeType,
          entityType: dto.entityType as any,
          entityId: dto.entityId,
          payloadDraft: dto.payloadDraft,
          notes: dto.notes ?? null,
          requestedByStaffId: actorStaffId,
          status: "DRAFT",
        },
      });

      await this.ctx.logCompliance(
        {
          workspaceId: dto.workspaceId,
          entityType: "APPROVAL",
          entityId: created.id,
          action: "CREATE",
          actorStaffId,
          after: { changeType: dto.changeType, entityType: dto.entityType, entityId: dto.entityId },
        },
        tx,
      );

      await this.ctx.audit.log(
        {
          branchId: principal.branchId,
          actorUserId: principal.userId,
          action: "APPROVAL_CREATE",
          entity: "ComplianceApproval",
          entityId: created.id,
          meta: { changeType: dto.changeType, entityType: dto.entityType, entityId: dto.entityId },
        },
        tx,
      );

      return created;
    });

    return approval;
  }

  async submit(principal: Principal, approvalId: string) {
    const actorStaffId = await this.ctx.requireActorStaffId(principal);
    const existing = await this.ctx.prisma.complianceApproval.findUnique({ where: { id: approvalId } });
    if (!existing) throw new NotFoundException("Approval not found");
    if (existing.status !== "DRAFT") throw new BadRequestException("Only DRAFT approvals can be submitted");

    await this.ctx.assertWorkspaceAccess(principal, existing.workspaceId);

    const updated = await this.ctx.prisma.$transaction(async (tx) => {
      const result = await tx.complianceApproval.update({
        where: { id: approvalId },
        data: { status: "SUBMITTED" },
      });

      await this.ctx.logCompliance(
        {
          workspaceId: existing.workspaceId,
          entityType: "APPROVAL",
          entityId: approvalId,
          action: "SUBMIT",
          actorStaffId,
        },
        tx,
      );

      await this.ctx.audit.log(
        {
          branchId: principal.branchId,
          actorUserId: principal.userId,
          action: "APPROVAL_SUBMIT",
          entity: "ComplianceApproval",
          entityId: approvalId,
          meta: { changeType: existing.changeType },
        },
        tx,
      );

      return result;
    });

    return updated;
  }

  async decide(principal: Principal, approvalId: string, dto: DecideApprovalDto) {
    const actorStaffId = await this.ctx.requireActorStaffId(principal);

    const existing = await this.ctx.prisma.complianceApproval.findUnique({ where: { id: approvalId } });
    if (!existing) throw new NotFoundException("Approval not found");
    if (existing.status !== "SUBMITTED") throw new BadRequestException("Only SUBMITTED approvals can be decided");
    if (existing.requestedByStaffId === actorStaffId) {
      throw new BadRequestException("Cannot approve/reject your own request");
    }

    await this.ctx.assertWorkspaceAccess(principal, existing.workspaceId);

    const updated = await this.ctx.prisma.$transaction(async (tx) => {
      const result = await tx.complianceApproval.update({
        where: { id: approvalId },
        data: {
          status: dto.decision,
          decidedByStaffId: actorStaffId,
          decidedAt: new Date(),
          decisionNotes: dto.decisionNotes ?? null,
        },
      });

      await this.ctx.logCompliance(
        {
          workspaceId: existing.workspaceId,
          entityType: "APPROVAL",
          entityId: approvalId,
          action: dto.decision,
          actorStaffId,
          before: { status: existing.status },
          after: { status: dto.decision, decisionNotes: dto.decisionNotes },
        },
        tx,
      );

      await this.ctx.audit.log(
        {
          branchId: principal.branchId,
          actorUserId: principal.userId,
          action: `APPROVAL_${dto.decision}`,
          entity: "ComplianceApproval",
          entityId: approvalId,
          meta: { decision: dto.decision, decisionNotes: dto.decisionNotes, changeType: existing.changeType },
        },
        tx,
      );

      return result;
    });

    // Execute the approved change after the approval decision is persisted
    if (dto.decision === 'APPROVED') {
      try {
        await this.executeApprovedChange(updated);
      } catch (err) {
        // Log but don't fail the approval decision
        console.error('Failed to execute approved change:', err);
      }
    }

    return updated;
  }

  private async executeApprovedChange(approval: any) {
  const payload: any = approval.payloadDraft ?? {};

  switch (approval.changeType) {
    case "ABDM_SECRET_UPDATE": {
      // ✅ Prefer correct field. Fallback to old field to support legacy approvals.
      const newSecret = String(payload.clientSecretEnc ?? payload.clientSecret ?? "").trim();

      // Never allow redacted placeholder to be applied
      if (!newSecret || newSecret === "[REDACTED]") {
        throw new BadRequestException("Approved payload is missing clientSecretEnc");
      }

      await this.ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.abdmConfig.findUnique({
          where: { id: approval.entityId },
        });
        if (!existing) throw new NotFoundException("ABDM config not found");

        // ✅ Apply the secret to ABDM config
        await tx.abdmConfig.update({
          where: { id: approval.entityId },
          data: {
            clientSecretEnc: newSecret,
            status: existing.status === "NOT_CONFIGURED" ? "CONFIGURED" : existing.status,
          },
        });

        // ✅ Redact secret in approval payload after applying (so DB doesn’t retain it)
        await tx.complianceApproval.update({
          where: { id: approval.id },
          data: {
            payloadDraft: {
              ...payload,
              clientSecretEnc: "[REDACTED]",
              // also redact legacy key if it existed
              ...(payload.clientSecret ? { clientSecret: "[REDACTED]" } : {}),
            },
          },
        });

        // ✅ Compliance log (no secret)
        await this.ctx.logCompliance(
          {
            workspaceId: approval.workspaceId,
            entityType: "ABDM_CONFIG",
            entityId: approval.entityId,
            action: "SECRET_APPLIED",
            actorStaffId: approval.decidedByStaffId ?? null,
            after: { clientSecretEnc: "[REDACTED]" },
          },
          tx,
        );
      });

      break;
    }

    case "RATE_CARD_FREEZE": {
      await this.ctx.prisma.schemeRateCard.update({
        where: { id: approval.entityId },
        data: { status: "FROZEN" },
      });
      break;
    }

    case "NABH_CRITICAL_VERIFY": {
      await this.ctx.prisma.nabhWorkspaceItem.update({
        where: { id: approval.entityId },
        data: {
          status: "VERIFIED",
          verifiedAt: new Date(),
          verifiedByStaffId: approval.decidedByStaffId,
        },
      });
      break;
    }

    default:
      break;
  }
}

}
