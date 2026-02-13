import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../../infrastructure/shared/infra-context.service";
import type { CreateInsuranceDocumentDto, LinkDocumentDto, UpdateInsuranceDocumentDto } from "./dto";

@Injectable()
export class InsuranceDocumentService {
  constructor(private readonly ctx: InfraContextService) {}

  async create(principal: Principal, dto: CreateInsuranceDocumentDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);

    const created = await this.ctx.prisma.insuranceDocument.create({
      data: {
        branchId,
        title: dto.title.trim(),
        fileUrl: dto.fileUrl.trim(),
        fileMime: dto.fileMime ?? null,
        fileSizeBytes: dto.fileSizeBytes ?? null,
        checksum: dto.checksum ?? null,
        docRole: (dto.docRole as any) ?? "DOC_OTHER",
        version: dto.version ?? 1,
        tags: dto.tags ?? [],
        uploadedByUserId: principal.userId,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_DOCUMENT_CREATE",
      entity: "InsuranceDocument",
      entityId: created.id,
      meta: { title: dto.title, docRole: dto.docRole },
    });

    return created;
  }

  async list(
    principal: Principal,
    filters: {
      branchId?: string | null;
      entityType?: string;
      entityId?: string;
      docRole?: string;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, filters.branchId ?? null);

    // When entityType + entityId provided, query via links
    if (filters.entityType && filters.entityId) {
      const links = await this.ctx.prisma.insuranceDocumentLink.findMany({
        where: {
          entityType: filters.entityType as any,
          entityId: filters.entityId,
          document: { branchId },
        },
        include: {
          document: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });

      return links.map((link) => ({
        ...link.document,
        linkId: link.id,
        entityType: link.entityType,
        entityId: link.entityId,
        isRequired: link.isRequired,
      }));
    }

    const where: any = { branchId };
    if (filters.docRole) where.docRole = filters.docRole;

    return this.ctx.prisma.insuranceDocument.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });
  }

  async get(principal: Principal, id: string) {
    const row = await this.ctx.prisma.insuranceDocument.findUnique({
      where: { id },
      include: {
        links: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
    if (!row) throw new NotFoundException("Insurance document not found");

    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  async update(principal: Principal, id: string, dto: UpdateInsuranceDocumentDto) {
    const existing = await this.ctx.prisma.insuranceDocument.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Insurance document not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.insuranceDocument.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        fileUrl: dto.fileUrl?.trim(),
        fileMime: dto.fileMime === undefined ? undefined : (dto.fileMime ?? null),
        fileSizeBytes: dto.fileSizeBytes === undefined ? undefined : (dto.fileSizeBytes ?? null),
        checksum: dto.checksum === undefined ? undefined : (dto.checksum ?? null),
        docRole: dto.docRole ? (dto.docRole as any) : undefined,
        version: dto.version ?? undefined,
        tags: dto.tags ?? undefined,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_DOCUMENT_UPDATE",
      entity: "InsuranceDocument",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  async verify(principal: Principal, id: string) {
    const existing = await this.ctx.prisma.insuranceDocument.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Insurance document not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.insuranceDocument.update({
      where: { id },
      data: {
        verifiedAt: new Date(),
        verifiedByUserId: principal.userId,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_DOCUMENT_VERIFY",
      entity: "InsuranceDocument",
      entityId: id,
      meta: {},
    });

    return updated;
  }

  async linkDocument(principal: Principal, dto: LinkDocumentDto) {
    // Validate document exists and resolve branch
    const doc = await this.ctx.prisma.insuranceDocument.findUnique({
      where: { id: dto.documentId },
      select: { id: true, branchId: true },
    });
    if (!doc) throw new NotFoundException("Insurance document not found");

    const branchId = this.ctx.resolveBranchId(principal, doc.branchId);

    // Build typed relation fields based on entityType
    const typedRelations: Record<string, string | null> = {
      insuranceCaseId: null,
      preauthRequestId: null,
      claimId: null,
      policyId: null,
    };

    switch (dto.entityType) {
      case "INSURANCE_CASE":
        typedRelations.insuranceCaseId = dto.entityId;
        break;
      case "PREAUTH":
        typedRelations.preauthRequestId = dto.entityId;
        break;
      case "CLAIM":
        typedRelations.claimId = dto.entityId;
        break;
      case "PATIENT_POLICY":
        typedRelations.policyId = dto.entityId;
        break;
      default:
        throw new BadRequestException(`Unsupported entity type: ${dto.entityType}`);
    }

    const link = await this.ctx.prisma.insuranceDocumentLink.create({
      data: {
        documentId: dto.documentId,
        entityType: dto.entityType as any,
        entityId: dto.entityId,
        isRequired: dto.isRequired ?? false,
        insuranceCaseId: typedRelations.insuranceCaseId,
        preauthRequestId: typedRelations.preauthRequestId,
        claimId: typedRelations.claimId,
        policyId: typedRelations.policyId,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_DOCUMENT_LINK",
      entity: "InsuranceDocumentLink",
      entityId: link.id,
      meta: { documentId: dto.documentId, entityType: dto.entityType, entityId: dto.entityId },
    });

    return link;
  }

  async unlinkDocument(principal: Principal, linkId: string) {
    const link = await this.ctx.prisma.insuranceDocumentLink.findUnique({
      where: { id: linkId },
      include: { document: { select: { branchId: true } } },
    });
    if (!link) throw new NotFoundException("Document link not found");

    const branchId = this.ctx.resolveBranchId(principal, link.document.branchId);

    await this.ctx.prisma.insuranceDocumentLink.delete({
      where: { id: linkId },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_DOCUMENT_UNLINK",
      entity: "InsuranceDocumentLink",
      entityId: linkId,
      meta: { documentId: link.documentId, entityType: link.entityType, entityId: link.entityId },
    });

    return { deleted: true };
  }
}
