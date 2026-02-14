import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as path from "path";
import * as fs from "fs";
import type { Principal } from "../../auth/access-policy.service";
import { ComplianceContextService } from "../compliance-context.service";

import type { UploadEvidenceDto, UpdateEvidenceDto, LinkEvidenceDto } from "./dto/evidence.dto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "compliance", "evidence");

@Injectable()
export class EvidenceService {
  constructor(private readonly ctx: ComplianceContextService) {}

  async list(
    principal: Principal,
    query: {
      workspaceId?: string;
      linkedType?: string;
      linkedId?: string;
      expiringInDays?: number;
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
    }
    if (query.status) where.status = query.status;
    if (query.expiringInDays) {
      where.expiresAt = {
        lte: new Date(Date.now() + query.expiringInDays * 24 * 60 * 60 * 1000),
        gte: new Date(),
      };
      where.status = "ACTIVE";
    }

    if (query.linkedType && query.linkedId) {
      where.links = {
        some: {
          targetType: query.linkedType as any,
          targetId: query.linkedId,
        },
      };
    }

    const findArgs: any = {
      where,
      orderBy: [{ createdAt: "desc" }],
      take: take + 1,
      include: {
        links: true,
        _count: { select: { links: true } },
      },
    };
    if (query.cursor) {
      findArgs.cursor = { id: query.cursor };
      findArgs.skip = 1;
    }

    const rows = await this.ctx.prisma.evidenceArtifact.findMany(findArgs);
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore && items.length ? items[items.length - 1].id : null;

    return { items, nextCursor, take };
  }

  async upload(
    principal: Principal,
    dto: UploadEvidenceDto,
    file: { filename: string; originalname: string; mimetype: string; size: number },
  ) {
    await this.ctx.assertWorkspaceAccess(principal, dto.workspaceId);
    const evidence = await this.ctx.prisma.$transaction(async (tx) => {
      const actorStaffId = await this.ctx.requireActorStaffId(principal, tx);
      const created = await tx.evidenceArtifact.create({
        data: {
          workspaceId: dto.workspaceId,
          title: dto.title,
          tags: dto.tags ?? [],
          fileKey: file.filename,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          uploadedByStaffId: actorStaffId,
        },
      });

      await this.ctx.logCompliance(
        {
          workspaceId: dto.workspaceId,
          entityType: "EVIDENCE",
          entityId: created.id,
          action: "UPLOAD",
          actorStaffId,
          after: { title: dto.title, fileName: file.originalname },
        },
        tx,
      );

      await this.ctx.audit.log(
        {
          branchId: principal.branchId,
          actorUserId: principal.userId,
          action: "EVIDENCE_UPLOAD",
          entity: "Evidence",
          entityId: created.id,
          meta: { fileName: file.originalname, title: dto.title },
        },
        tx,
      );

      return created;
    });

    return evidence;
  }

  async get(principal: Principal, evidenceId: string) {
    const evidence = await this.ctx.prisma.evidenceArtifact.findUnique({
      where: { id: evidenceId },
      include: {
        links: true,
        uploadedBy: { select: { id: true, firstName: true, lastName: true, name: true } },
      },
    });
    if (!evidence) throw new NotFoundException("Evidence not found");
    await this.ctx.assertWorkspaceAccess(principal, evidence.workspaceId);
    return evidence;
  }

  async update(principal: Principal, evidenceId: string, dto: UpdateEvidenceDto) {
    const existing = await this.ctx.prisma.evidenceArtifact.findUnique({ where: { id: evidenceId } });
    if (!existing) throw new NotFoundException("Evidence not found");

    await this.ctx.assertWorkspaceAccess(principal, existing.workspaceId);

    const updated = await this.ctx.prisma.$transaction(async (tx) => {
      const actorStaffId = await this.ctx.requireActorStaffId(principal, tx);
      const result = await tx.evidenceArtifact.update({
        where: { id: evidenceId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.tags !== undefined && { tags: dto.tags }),
          ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

      await this.ctx.logCompliance(
        {
          workspaceId: existing.workspaceId,
          entityType: "EVIDENCE",
          entityId: evidenceId,
          action: "UPDATE",
          actorStaffId,
          before: existing,
          after: result,
        },
        tx,
      );

      await this.ctx.audit.log(
        {
          branchId: principal.branchId,
          actorUserId: principal.userId,
          action: "EVIDENCE_UPDATE",
          entity: "Evidence",
          entityId: evidenceId,
          meta: dto,
        },
        tx,
      );

      return result;
    });

    return updated;
  }

  async link(principal: Principal, evidenceId: string, dto: LinkEvidenceDto) {
    const evidence = await this.ctx.prisma.evidenceArtifact.findUnique({ where: { id: evidenceId } });
    if (!evidence) throw new NotFoundException("Evidence not found");

    await this.ctx.assertWorkspaceAccess(principal, evidence.workspaceId);
    const actorStaffId = await this.ctx.requireActorStaffId(principal);

    const targetType = dto.workspaceId ? "COMPLIANCE_WORKSPACE" : (dto.targetType ?? "");
    const targetId = dto.workspaceId ? dto.workspaceId : (dto.targetId ?? "");
    if (!targetType || !targetId) throw new BadRequestException("Provide workspaceId OR targetType + targetId");

    // Check for duplicate link
    const existing = await this.ctx.prisma.evidenceLink.findFirst({
      where: { evidenceId, targetType: targetType as any, targetId },
    });
    if (existing) throw new BadRequestException("Evidence already linked to this entity");

    const link = await this.ctx.prisma.$transaction(async (tx) => {
      const created = await tx.evidenceLink.create({
        data: {
          evidenceId,
          targetType: targetType as any,
          targetId,
        },
      });

      await this.ctx.logCompliance(
        {
          workspaceId: evidence.workspaceId,
          entityType: "EVIDENCE",
          entityId: evidenceId,
          action: "LINK",
          actorStaffId,
          after: { targetType, targetId },
        },
        tx,
      );

      await this.ctx.audit.log(
        {
          branchId: principal.branchId,
          actorUserId: principal.userId,
          action: "EVIDENCE_LINK",
          entity: "Evidence",
          entityId: evidenceId,
          meta: { targetType, targetId, linkId: created.id },
        },
        tx,
      );

      return created;
    });

    return link;
  }

  async findFirstLink(evidenceId: string) {
    return this.ctx.prisma.evidenceLink.findFirst({
      where: { evidenceId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findWorkspaceLink(evidenceId: string, workspaceId: string) {
    return this.ctx.prisma.evidenceLink.findFirst({
      where: { evidenceId, targetType: "COMPLIANCE_WORKSPACE" as any, targetId: workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  async unlink(principal: Principal, evidenceId: string, linkId: string) {
    const link = await this.ctx.prisma.evidenceLink.findUnique({ where: { id: linkId } });
    if (!link || link.evidenceId !== evidenceId) throw new NotFoundException("Link not found");

    const evidence = await this.ctx.prisma.evidenceArtifact.findUnique({ where: { id: evidenceId } });

    await this.ctx.assertWorkspaceAccess(principal, evidence!.workspaceId);
    const actorStaffId = await this.ctx.requireActorStaffId(principal);

    await this.ctx.prisma.$transaction(async (tx) => {
      await tx.evidenceLink.delete({ where: { id: linkId } });

      await this.ctx.logCompliance(
        {
          workspaceId: evidence!.workspaceId,
          entityType: "EVIDENCE",
          entityId: evidenceId,
          action: "UNLINK",
          actorStaffId,
          before: link,
        },
        tx,
      );

      await this.ctx.audit.log(
        {
          branchId: principal.branchId,
          actorUserId: principal.userId,
          action: "EVIDENCE_UNLINK",
          entity: "Evidence",
          entityId: evidenceId,
          meta: { linkId, targetType: link.targetType, targetId: link.targetId },
        },
        tx,
      );
    });

    return { success: true };
  }

  async downloadEvidence(principal: Principal, evidenceId: string) {
    const evidence = await this.ctx.prisma.evidenceArtifact.findUniqueOrThrow({
      where: { id: evidenceId },
    });

    await this.ctx.assertWorkspaceAccess(principal, evidence.workspaceId);

    const filePath = path.resolve(UPLOAD_DIR, evidence.fileKey);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException("Evidence file not found on disk");
    }

    return {
      filePath,
      fileName: evidence.fileName,
      mimeType: evidence.mimeType,
      sizeBytes: evidence.sizeBytes,
    };
  }
}
