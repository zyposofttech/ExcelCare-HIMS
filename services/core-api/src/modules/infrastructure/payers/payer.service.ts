import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreatePayerDto, UpdatePayerDto } from "./dto";
import { canonicalizeCode } from "../../../common/naming.util";

@Injectable()
export class PayerService {
  constructor(private readonly ctx: InfraContextService) {}

  private validatePAN(pan?: string | null) {
    if (!pan) return;
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      throw new BadRequestException("Invalid PAN format. Expected AAAAA9999A");
    }
  }

  private validateGSTIN(gstin?: string | null) {
    if (!gstin) return;
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(gstin)) {
      throw new BadRequestException("Invalid GSTIN format");
    }
  }

  async createPayer(principal: Principal, dto: CreatePayerDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const code = canonicalizeCode(dto.code);

    this.validatePAN(dto.panNumber);
    this.validateGSTIN(dto.gstinNumber);

    const duplicate = await this.ctx.prisma.payer.findFirst({
      where: { branchId, code },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException(`Payer code "${code}" already exists in this branch`);

    const created = await this.ctx.prisma.payer.create({
      data: {
        branchId,
        code,
        name: dto.name.trim(),
        shortName: dto.shortName?.trim() ?? null,
        displayName: dto.displayName?.trim() ?? null,
        kind: dto.kind as any,
        status: (dto.status as any) ?? "ACTIVE",

        // Regulatory
        irdaiRegistration: dto.irdaiRegistration ?? null,
        licenseNumber: dto.licenseNumber ?? null,
        licenseValidTill: dto.licenseValidTill ? new Date(dto.licenseValidTill) : null,
        panNumber: dto.panNumber ?? null,
        gstinNumber: dto.gstinNumber ?? null,
        cinNumber: dto.cinNumber ?? null,

        // Contacts & Addresses
        addresses: dto.addresses ?? undefined,
        contacts: dto.contacts ?? undefined,
        portalUrl: dto.portalUrl ?? null,

        // Financial Terms
        creditDays: dto.creditDays ?? null,
        creditLimit: dto.creditLimit ?? null,
        gracePeriodDays: dto.gracePeriodDays ?? null,
        interestRate: dto.interestRate ?? null,
        earlyPaymentDiscount: dto.earlyPaymentDiscount ?? null,
        settlementTerms: dto.settlementTerms ?? undefined,

        // Operational Config
        requiresPreauth: dto.requiresPreauth ?? false,
        preauthThreshold: dto.preauthThreshold ?? null,
        supportingDocs: dto.supportingDocs ?? [],
        claimSubmissionMethod: dto.claimSubmissionMethod ?? [],

        // Network Config
        networkType: dto.networkType ?? null,
        empanelmentLevel: dto.empanelmentLevel ?? null,
        roomRentLimit: dto.roomRentLimit ?? null,
        icuRentLimit: dto.icuRentLimit ?? null,

        // Integration
        apiEndpoint: dto.apiEndpoint ?? null,
        authMethod: dto.authMethod ?? null,
        webhookUrl: dto.webhookUrl ?? null,

        // Empanelment
        empanelmentStartDate: dto.empanelmentStartDate ? new Date(dto.empanelmentStartDate) : null,
        empanelmentEndDate: dto.empanelmentEndDate ? new Date(dto.empanelmentEndDate) : null,
        autoRenewal: dto.autoRenewal ?? false,

        isActive: dto.isActive ?? true,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_PAYER_CREATE",
      entity: "Payer",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async listPayers(
    principal: Principal,
    q: {
      branchId?: string | null;
      q?: string;
      kind?: string;
      status?: string;
      includeInactive?: boolean;
      take?: number;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    const where: any = { branchId };

    if (!q.includeInactive) where.isActive = true;
    if (q.kind) where.kind = q.kind;
    if (q.status) where.status = q.status;
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: "insensitive" } },
        { code: { contains: q.q, mode: "insensitive" } },
        { shortName: { contains: q.q, mode: "insensitive" } },
      ];
    }

    return this.ctx.prisma.payer.findMany({
      where,
      orderBy: [{ name: "asc" }],
      take: q.take && Number.isFinite(q.take) ? Math.min(Math.max(q.take, 1), 500) : 200,
      include: { contracts: { select: { id: true, name: true, status: true } } },
    });
  }

  async getPayer(principal: Principal, id: string) {
    const row = await this.ctx.prisma.payer.findUnique({
      where: { id },
      include: {
        contracts: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
    if (!row) throw new NotFoundException("Payer not found");

    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  async updatePayer(principal: Principal, id: string, dto: UpdatePayerDto) {
    const existing = await this.ctx.prisma.payer.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Payer not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    if (dto.panNumber !== undefined) this.validatePAN(dto.panNumber);
    if (dto.gstinNumber !== undefined) this.validateGSTIN(dto.gstinNumber);

    const updated = await this.ctx.prisma.payer.update({
      where: { id },
      data: {
        code: dto.code ? canonicalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        shortName: dto.shortName === undefined ? undefined : (dto.shortName?.trim() ?? null),
        displayName: dto.displayName === undefined ? undefined : (dto.displayName?.trim() ?? null),
        kind: dto.kind ? (dto.kind as any) : undefined,
        status: dto.status ? (dto.status as any) : undefined,

        irdaiRegistration: dto.irdaiRegistration === undefined ? undefined : (dto.irdaiRegistration ?? null),
        licenseNumber: dto.licenseNumber === undefined ? undefined : (dto.licenseNumber ?? null),
        licenseValidTill:
          dto.licenseValidTill === undefined
            ? undefined
            : dto.licenseValidTill
              ? new Date(dto.licenseValidTill)
              : null,
        panNumber: dto.panNumber === undefined ? undefined : (dto.panNumber ?? null),
        gstinNumber: dto.gstinNumber === undefined ? undefined : (dto.gstinNumber ?? null),
        cinNumber: dto.cinNumber === undefined ? undefined : (dto.cinNumber ?? null),

        addresses: dto.addresses === undefined ? undefined : (dto.addresses ?? undefined),
        contacts: dto.contacts === undefined ? undefined : (dto.contacts ?? undefined),
        portalUrl: dto.portalUrl === undefined ? undefined : (dto.portalUrl ?? null),

        creditDays: dto.creditDays === undefined ? undefined : (dto.creditDays ?? null),
        creditLimit: dto.creditLimit === undefined ? undefined : (dto.creditLimit ?? null),
        gracePeriodDays: dto.gracePeriodDays === undefined ? undefined : (dto.gracePeriodDays ?? null),
        interestRate: dto.interestRate === undefined ? undefined : (dto.interestRate ?? null),
        earlyPaymentDiscount: dto.earlyPaymentDiscount === undefined ? undefined : (dto.earlyPaymentDiscount ?? null),
        settlementTerms: dto.settlementTerms === undefined ? undefined : (dto.settlementTerms ?? undefined),

        requiresPreauth: dto.requiresPreauth ?? undefined,
        preauthThreshold: dto.preauthThreshold === undefined ? undefined : (dto.preauthThreshold ?? null),
        supportingDocs: dto.supportingDocs ?? undefined,
        claimSubmissionMethod: dto.claimSubmissionMethod ?? undefined,

        networkType: dto.networkType === undefined ? undefined : (dto.networkType ?? null),
        empanelmentLevel: dto.empanelmentLevel === undefined ? undefined : (dto.empanelmentLevel ?? null),
        roomRentLimit: dto.roomRentLimit === undefined ? undefined : (dto.roomRentLimit ?? null),
        icuRentLimit: dto.icuRentLimit === undefined ? undefined : (dto.icuRentLimit ?? null),

        apiEndpoint: dto.apiEndpoint === undefined ? undefined : (dto.apiEndpoint ?? null),
        authMethod: dto.authMethod === undefined ? undefined : (dto.authMethod ?? null),
        webhookUrl: dto.webhookUrl === undefined ? undefined : (dto.webhookUrl ?? null),

        empanelmentStartDate:
          dto.empanelmentStartDate === undefined
            ? undefined
            : dto.empanelmentStartDate
              ? new Date(dto.empanelmentStartDate)
              : null,
        empanelmentEndDate:
          dto.empanelmentEndDate === undefined
            ? undefined
            : dto.empanelmentEndDate
              ? new Date(dto.empanelmentEndDate)
              : null,
        autoRenewal: dto.autoRenewal ?? undefined,

        isActive: dto.isActive ?? undefined,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_PAYER_UPDATE",
      entity: "Payer",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  async deactivatePayer(principal: Principal, id: string) {
    const existing = await this.ctx.prisma.payer.findUnique({
      where: { id },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!existing) throw new NotFoundException("Payer not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    if (!existing.isActive) {
      return this.ctx.prisma.payer.findUnique({ where: { id } });
    }

    const updated = await this.ctx.prisma.payer.update({
      where: { id },
      data: { isActive: false, status: "INACTIVE" },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_PAYER_DEACTIVATE",
      entity: "Payer",
      entityId: id,
      meta: {},
    });

    return updated;
  }
}
