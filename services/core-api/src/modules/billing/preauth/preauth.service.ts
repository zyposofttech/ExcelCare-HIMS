import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../../infrastructure/shared/infra-context.service";
import { ClaimsGatewayService } from "../claims-gateway/claims-gateway.service";
import type { CreatePreauthDto, UpdatePreauthDto, PreauthQueryDto } from "./dto";

@Injectable()
export class PreauthService {
  private readonly logger = new Logger(PreauthService.name);

  constructor(
    private readonly ctx: InfraContextService,
    private readonly claimsGateway: ClaimsGatewayService,
  ) {}

  // ------------------------------------------------------------------ create
  async create(principal: Principal, dto: CreatePreauthDto, branchIdParam?: string | null) {
    // Validate insurance case
    const insuranceCase = await this.ctx.prisma.insuranceCase.findUnique({
      where: { id: dto.insuranceCaseId },
      select: { id: true, branchId: true },
    });
    if (!insuranceCase) throw new BadRequestException("Insurance case not found");

    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? insuranceCase.branchId);

    const created = await this.ctx.prisma.preauthRequest.create({
      data: {
        branchId,
        insuranceCaseId: dto.insuranceCaseId,
        requestNumber: dto.requestNumber.trim(),
        status: "PREAUTH_DRAFT" as any,
        requestedAmount: dto.requestedAmount ?? null,
        packageCode: dto.packageCode ?? null,
        procedureSummary: dto.procedureSummary ?? null,
        clinicalNotes: dto.clinicalNotes ?? null,
        // Clinical coding fields
        primaryDiagnosisCode: dto.primaryDiagnosisCode ?? null,
        primaryDiagnosisDesc: dto.primaryDiagnosisDesc ?? null,
        secondaryDiagnosisCodes: dto.secondaryDiagnosisCodes ?? [],
        procedureCodes: dto.procedureCodes ?? [],
        hbpPackageCode: dto.hbpPackageCode ?? null,
        implantDetails: dto.implantDetails ?? null,
        investigationSummary: dto.investigationSummary ?? null,
        otNotes: dto.otNotes ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_PREAUTH_CREATE",
      entity: "PreauthRequest",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  // ------------------------------------------------------------------ list
  async list(
    principal: Principal,
    filters: {
      branchId?: string | null;
      insuranceCaseId?: string;
      status?: string;
      q?: string;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, filters.branchId ?? null);

    const where: any = { branchId };
    if (filters.insuranceCaseId) where.insuranceCaseId = filters.insuranceCaseId;
    if (filters.status) where.status = filters.status as any;

    const search = (filters.q ?? "").trim();
    if (search) {
      where.OR = [
        { requestNumber: { contains: search, mode: "insensitive" } },
        { insuranceCase: { caseNumber: { contains: search, mode: "insensitive" } } },
        { insuranceCase: { patient: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

    return this.ctx.prisma.preauthRequest.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        insuranceCase: {
          select: {
            id: true,
            caseNumber: true,
            patient: { select: { id: true, name: true, uhid: true } },
            payer: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }

  // ------------------------------------------------------------------ get
  async get(principal: Principal, id: string) {
    const row = await this.ctx.prisma.preauthRequest.findUnique({
      where: { id },
      include: {
        insuranceCase: {
          include: {
            patient: { select: { id: true, name: true, uhid: true } },
            payer: { select: { id: true, name: true, code: true } },
          },
        },
        queries: { orderBy: { queriedAt: "asc" } },
        documentLinks: true,
      },
    });
    if (!row) throw new NotFoundException("Preauth request not found");

    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  // ------------------------------------------------------------------ update
  async update(principal: Principal, id: string, dto: UpdatePreauthDto) {
    const existing = await this.ctx.prisma.preauthRequest.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Preauth request not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.preauthRequest.update({
      where: { id },
      data: {
        requestNumber: dto.requestNumber?.trim(),
        requestedAmount: dto.requestedAmount === undefined ? undefined : (dto.requestedAmount ?? null),
        packageCode: dto.packageCode === undefined ? undefined : (dto.packageCode ?? null),
        procedureSummary: dto.procedureSummary === undefined ? undefined : (dto.procedureSummary ?? null),
        clinicalNotes: dto.clinicalNotes === undefined ? undefined : (dto.clinicalNotes ?? null),
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_PREAUTH_UPDATE",
      entity: "PreauthRequest",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  // ------------------------------------------------------------------ submit
  async submit(principal: Principal, id: string) {
    const existing = await this.ctx.prisma.preauthRequest.findUnique({
      where: { id },
      select: { id: true, branchId: true, status: true },
    });
    if (!existing) throw new NotFoundException("Preauth request not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.preauthRequest.update({
      where: { id },
      data: {
        status: "PREAUTH_SUBMITTED" as any,
        submittedAt: new Date(),
        submittedByUserId: principal.userId,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_PREAUTH_SUBMIT",
      entity: "PreauthRequest",
      entityId: id,
      meta: { previousStatus: existing.status },
    });

    // Attempt to send through the claims gateway (best-effort)
    try {
      await this.claimsGateway.submitPreauth(principal, id);
    } catch (err: any) {
      this.logger.warn(
        `Gateway call failed for preauth ${id} — preauth is still marked SUBMITTED internally: ${err?.message}`,
      );
    }

    return updated;
  }

  // ------------------------------------------------------------------ approve
  async approve(principal: Principal, id: string, body: { approvedAmount?: number; validTill?: string }) {
    const existing = await this.ctx.prisma.preauthRequest.findUnique({
      where: { id },
      select: { id: true, branchId: true, status: true },
    });
    if (!existing) throw new NotFoundException("Preauth request not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.preauthRequest.update({
      where: { id },
      data: {
        status: "PREAUTH_APPROVED" as any,
        approvedAt: new Date(),
        approvedByUserId: principal.userId,
        approvedAmount: body.approvedAmount ?? undefined,
        validTill: body.validTill ? new Date(body.validTill) : undefined,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_PREAUTH_APPROVE",
      entity: "PreauthRequest",
      entityId: id,
      meta: { ...body, previousStatus: existing.status },
    });

    return updated;
  }

  // ------------------------------------------------------------------ reject
  async reject(principal: Principal, id: string, body: { rejectionReason?: string }) {
    const existing = await this.ctx.prisma.preauthRequest.findUnique({
      where: { id },
      select: { id: true, branchId: true, status: true },
    });
    if (!existing) throw new NotFoundException("Preauth request not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.preauthRequest.update({
      where: { id },
      data: {
        status: "PREAUTH_REJECTED" as any,
        rejectedAt: new Date(),
        rejectionReason: body.rejectionReason ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_PREAUTH_REJECT",
      entity: "PreauthRequest",
      entityId: id,
      meta: { ...body, previousStatus: existing.status },
    });

    return updated;
  }

  // ------------------------------------------------------------------ addQuery
  async addQuery(principal: Principal, preauthId: string, dto: PreauthQueryDto) {
    const preauth = await this.ctx.prisma.preauthRequest.findUnique({
      where: { id: preauthId },
      select: { id: true, branchId: true, status: true },
    });
    if (!preauth) throw new NotFoundException("Preauth request not found");

    const branchId = this.ctx.resolveBranchId(principal, preauth.branchId);

    const query = await this.ctx.prisma.preauthQuery.create({
      data: {
        preauthId,
        queryText: dto.queryText,
        querySource: dto.querySource as any,
        queriedByUserId: principal.userId,
        responseText: dto.responseText ?? null,
        respondedAt: dto.responseText ? new Date() : null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        attachmentUrls: dto.attachmentUrls ?? [],
      },
    });

    // If query from TPA, mark preauth as QUERY_RAISED
    if (dto.querySource === "TPA") {
      await this.ctx.prisma.preauthRequest.update({
        where: { id: preauthId },
        data: { status: "PREAUTH_QUERY_RAISED" as any },
      });
    }

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_PREAUTH_QUERY_ADD",
      entity: "PreauthQuery",
      entityId: query.id,
      meta: { preauthId, querySource: dto.querySource },
    });

    return query;
  }
}
