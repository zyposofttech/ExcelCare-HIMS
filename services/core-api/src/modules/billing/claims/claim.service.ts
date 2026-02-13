import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../../infrastructure/shared/infra-context.service";
import { ClaimsGatewayService } from "../claims-gateway/claims-gateway.service";
import type { CreateClaimDto, UpdateClaimDto, ClaimLineItemDto, ClaimDeductionDto } from "./dto";

@Injectable()
export class ClaimService {
  private readonly logger = new Logger(ClaimService.name);

  constructor(
    private readonly ctx: InfraContextService,
    private readonly claimsGateway: ClaimsGatewayService,
  ) {}

  // ------------------------------------------------------------------ create
  async create(principal: Principal, dto: CreateClaimDto, branchIdParam?: string | null) {
    // Validate insurance case
    const insuranceCase = await this.ctx.prisma.insuranceCase.findUnique({
      where: { id: dto.insuranceCaseId },
      select: { id: true, branchId: true },
    });
    if (!insuranceCase) throw new BadRequestException("Insurance case not found");

    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? insuranceCase.branchId);

    const created = await this.ctx.prisma.claim.create({
      data: {
        branchId,
        insuranceCaseId: dto.insuranceCaseId,
        claimNumber: dto.claimNumber.trim(),
        claimType: (dto.claimType ?? "FINAL") as any,
        status: "CLAIM_DRAFT" as any,
        totalAmount: dto.totalAmount ?? null,
        notes: dto.notes ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_CLAIM_CREATE",
      entity: "Claim",
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
      claimType?: string;
      q?: string;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, filters.branchId ?? null);

    const where: any = { branchId };
    if (filters.insuranceCaseId) where.insuranceCaseId = filters.insuranceCaseId;
    if (filters.status) where.status = filters.status as any;
    if (filters.claimType) where.claimType = filters.claimType as any;

    const search = (filters.q ?? "").trim();
    if (search) {
      where.OR = [
        { claimNumber: { contains: search, mode: "insensitive" } },
        { insuranceCase: { caseNumber: { contains: search, mode: "insensitive" } } },
        { insuranceCase: { patient: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

    return this.ctx.prisma.claim.findMany({
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
        _count: { select: { lineItems: true } },
      },
    });
  }

  // ------------------------------------------------------------------ get
  async get(principal: Principal, id: string) {
    const row = await this.ctx.prisma.claim.findUnique({
      where: { id },
      include: {
        insuranceCase: {
          include: {
            patient: { select: { id: true, name: true, uhid: true } },
            payer: { select: { id: true, name: true, code: true } },
          },
        },
        lineItems: {
          orderBy: { createdAt: "asc" },
          include: {
            serviceItem: { select: { id: true, code: true, name: true } },
            chargeMasterItem: { select: { id: true, code: true, name: true } },
          },
        },
        deductions: { orderBy: { createdAt: "asc" } },
        versions: { orderBy: { versionNumber: "desc" } },
        documentLinks: true,
        paymentAdvices: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!row) throw new NotFoundException("Claim not found");

    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  // ------------------------------------------------------------------ update
  async update(principal: Principal, id: string, dto: UpdateClaimDto) {
    const existing = await this.ctx.prisma.claim.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Claim not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.claim.update({
      where: { id },
      data: {
        claimNumber: dto.claimNumber?.trim(),
        claimType: dto.claimType ? (dto.claimType as any) : undefined,
        totalAmount: dto.totalAmount === undefined ? undefined : (dto.totalAmount ?? null),
        notes: dto.notes === undefined ? undefined : (dto.notes ?? null),
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_CLAIM_UPDATE",
      entity: "Claim",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  // ------------------------------------------------------------------ submit
  async submit(principal: Principal, id: string) {
    const existing = await this.ctx.prisma.claim.findUnique({
      where: { id },
      select: { id: true, branchId: true, status: true },
    });
    if (!existing) throw new NotFoundException("Claim not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.claim.update({
      where: { id },
      data: {
        status: "CLAIM_SUBMITTED" as any,
        submittedAt: new Date(),
        submittedByUserId: principal.userId,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_CLAIM_SUBMIT",
      entity: "Claim",
      entityId: id,
      meta: { previousStatus: existing.status },
    });

    // Attempt to send through the claims gateway (best-effort)
    try {
      await this.claimsGateway.submitClaim(principal, id);
    } catch (err: any) {
      this.logger.warn(
        `Gateway call failed for claim ${id} — claim is still marked SUBMITTED internally: ${err?.message}`,
      );
    }

    return updated;
  }

  // ------------------------------------------------------------------ addLineItem
  async addLineItem(principal: Principal, claimId: string, dto: ClaimLineItemDto) {
    const claim = await this.ctx.prisma.claim.findUnique({
      where: { id: claimId },
      select: { id: true, branchId: true },
    });
    if (!claim) throw new NotFoundException("Claim not found");

    const branchId = this.ctx.resolveBranchId(principal, claim.branchId);

    const lineItem = await this.ctx.prisma.claimLineItem.create({
      data: {
        claimId,
        serviceItemId: dto.serviceItemId ?? null,
        chargeMasterItemId: dto.chargeMasterItemId ?? null,
        description: dto.description.trim(),
        quantity: dto.quantity ?? 1,
        unitPrice: dto.unitPrice,
        totalPrice: dto.totalPrice,
        packageCode: dto.packageCode ?? null,
        hsnSac: dto.hsnSac ?? null,
        // Clinical coding fields (NHCX/FHIR)
        icdCode: dto.icdCode ?? null,
        icdDescription: dto.icdDescription ?? null,
        cptCode: dto.cptCode ?? null,
        cptDescription: dto.cptDescription ?? null,
        snomedCode: dto.snomedCode ?? null,
        modifiers: dto.modifiers ?? [],
        placeOfService: dto.placeOfService ?? null,
        diagnosisRef: dto.diagnosisRef ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_CLAIM_LINE_ITEM_ADD",
      entity: "ClaimLineItem",
      entityId: lineItem.id,
      meta: { claimId, ...dto },
    });

    return lineItem;
  }

  // ------------------------------------------------------------------ removeLineItem
  async removeLineItem(principal: Principal, claimId: string, lineItemId: string) {
    const claim = await this.ctx.prisma.claim.findUnique({
      where: { id: claimId },
      select: { id: true, branchId: true },
    });
    if (!claim) throw new NotFoundException("Claim not found");

    const branchId = this.ctx.resolveBranchId(principal, claim.branchId);

    const lineItem = await this.ctx.prisma.claimLineItem.findFirst({
      where: { id: lineItemId, claimId },
      select: { id: true },
    });
    if (!lineItem) throw new NotFoundException("Line item not found");

    await this.ctx.prisma.claimLineItem.delete({ where: { id: lineItemId } });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_CLAIM_LINE_ITEM_REMOVE",
      entity: "ClaimLineItem",
      entityId: lineItemId,
      meta: { claimId },
    });

    return { deleted: true, id: lineItemId };
  }

  // ------------------------------------------------------------------ addDeduction
  async addDeduction(principal: Principal, claimId: string, dto: ClaimDeductionDto) {
    const claim = await this.ctx.prisma.claim.findUnique({
      where: { id: claimId },
      select: { id: true, branchId: true },
    });
    if (!claim) throw new NotFoundException("Claim not found");

    const branchId = this.ctx.resolveBranchId(principal, claim.branchId);

    const deduction = await this.ctx.prisma.claimDeduction.create({
      data: {
        claimId,
        reasonCode: dto.reasonCode.trim(),
        reasonCategory: dto.reasonCategory as any,
        description: dto.description,
        amount: dto.amount,
        isDisputed: dto.isDisputed ?? false,
        disputeNotes: dto.disputeNotes ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_CLAIM_DEDUCTION_ADD",
      entity: "ClaimDeduction",
      entityId: deduction.id,
      meta: { claimId, ...dto },
    });

    return deduction;
  }

  // ------------------------------------------------------------------ createSnapshot
  async createSnapshot(principal: Principal, claimId: string) {
    const claim = await this.ctx.prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        lineItems: true,
        deductions: true,
      },
    });
    if (!claim) throw new NotFoundException("Claim not found");

    const branchId = this.ctx.resolveBranchId(principal, claim.branchId);

    // Determine next version number
    const lastVersion = await this.ctx.prisma.claimVersion.findFirst({
      where: { claimId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    // Build snapshot JSON with claim + line items + deductions
    const { lineItems, deductions, ...claimData } = claim;
    const snapshot = {
      claim: claimData,
      lineItems,
      deductions,
      snapshotAt: new Date().toISOString(),
    };

    const version = await this.ctx.prisma.claimVersion.create({
      data: {
        claimId,
        versionNumber: nextVersionNumber,
        snapshot: snapshot as any,
        createdByUserId: principal.userId,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_CLAIM_SNAPSHOT_CREATE",
      entity: "ClaimVersion",
      entityId: version.id,
      meta: { claimId, versionNumber: nextVersionNumber },
    });

    return version;
  }

  // ------------------------------------------------------------------ resubmit
  async resubmit(principal: Principal, claimId: string) {
    const original = await this.ctx.prisma.claim.findUnique({
      where: { id: claimId },
      include: { lineItems: true },
    });
    if (!original) throw new NotFoundException("Claim not found");

    const branchId = this.ctx.resolveBranchId(principal, original.branchId);

    // Create a new claim linked to original via resubmissionOfId
    const newClaim = await this.ctx.prisma.claim.create({
      data: {
        branchId,
        insuranceCaseId: original.insuranceCaseId,
        claimNumber: `${original.claimNumber}-R${Date.now().toString(36).slice(-4).toUpperCase()}`,
        claimType: original.claimType as any,
        status: "CLAIM_DRAFT" as any,
        totalAmount: original.totalAmount,
        notes: original.notes,
        resubmissionOfId: original.id,
      },
    });

    // Copy line items from original claim
    if (original.lineItems.length > 0) {
      await this.ctx.prisma.claimLineItem.createMany({
        data: original.lineItems.map((li) => ({
          claimId: newClaim.id,
          serviceItemId: li.serviceItemId,
          chargeMasterItemId: li.chargeMasterItemId,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          totalPrice: li.totalPrice,
          packageCode: li.packageCode,
          hsnSac: li.hsnSac,
          // Copy clinical coding fields
          icdCode: li.icdCode,
          icdDescription: li.icdDescription,
          cptCode: li.cptCode,
          cptDescription: li.cptDescription,
          snomedCode: li.snomedCode,
          modifiers: li.modifiers,
          placeOfService: li.placeOfService,
          diagnosisRef: li.diagnosisRef,
        })),
      });
    }

    // Mark original as resubmitted
    await this.ctx.prisma.claim.update({
      where: { id: claimId },
      data: { status: "CLAIM_RESUBMITTED" as any },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_CLAIM_RESUBMIT",
      entity: "Claim",
      entityId: newClaim.id,
      meta: { originalClaimId: claimId },
    });

    return newClaim;
  }
}
