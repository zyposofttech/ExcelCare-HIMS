import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../../infrastructure/shared/infra-context.service";
import type { CreateInsurancePolicyDto, UpdateInsurancePolicyDto } from "./dto";

@Injectable()
export class InsurancePolicyService {
  constructor(private readonly ctx: InfraContextService) {}

  async create(principal: Principal, dto: CreateInsurancePolicyDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);

    // Validate patient exists in branch
    const patient = await this.ctx.prisma.patient.findFirst({
      where: { id: dto.patientId, branchId },
      select: { id: true },
    });
    if (!patient) throw new BadRequestException("Patient not found in this branch");

    // Validate payer exists in branch
    const payer = await this.ctx.prisma.payer.findFirst({
      where: { id: dto.payerId, branchId },
      select: { id: true },
    });
    if (!payer) throw new BadRequestException("Payer not found in this branch");

    const created = await this.ctx.prisma.patientInsurancePolicy.create({
      data: {
        branchId,
        patientId: dto.patientId,
        payerId: dto.payerId,
        contractId: dto.contractId ?? null,
        policyNumber: dto.policyNumber.trim(),
        memberId: dto.memberId.trim(),
        groupId: dto.groupId?.trim() ?? null,
        employerName: dto.employerName?.trim() ?? null,
        planName: dto.planName?.trim() ?? null,
        relationship: (dto.relationship as any) ?? "SELF",
        status: (dto.status as any) ?? "ACTIVE",
        validFrom: new Date(dto.validFrom),
        validTo: new Date(dto.validTo),
        sumInsured: dto.sumInsured ?? null,
        balanceRemaining: dto.balanceRemaining ?? null,
        cardNumber: dto.cardNumber ?? null,
        cardImageUrl: dto.cardImageUrl ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_POLICY_CREATE",
      entity: "PatientInsurancePolicy",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async list(
    principal: Principal,
    filters: {
      branchId?: string | null;
      patientId?: string;
      payerId?: string;
      status?: string;
      q?: string;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, filters.branchId ?? null);
    const where: any = { branchId };

    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.payerId) where.payerId = filters.payerId;
    if (filters.status) where.status = filters.status;
    if (filters.q) {
      where.OR = [
        { policyNumber: { contains: filters.q, mode: "insensitive" } },
        { memberId: { contains: filters.q, mode: "insensitive" } },
        { planName: { contains: filters.q, mode: "insensitive" } },
        { employerName: { contains: filters.q, mode: "insensitive" } },
      ];
    }

    return this.ctx.prisma.patientInsurancePolicy.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: {
        patient: { select: { id: true, name: true, uhid: true } },
        payer: { select: { id: true, code: true, name: true, kind: true } },
      },
    });
  }

  async get(principal: Principal, id: string) {
    const row = await this.ctx.prisma.patientInsurancePolicy.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, uhid: true } },
        payer: { select: { id: true, code: true, name: true, kind: true } },
        contract: { select: { id: true, name: true, status: true } },
      },
    });
    if (!row) throw new NotFoundException("Insurance policy not found");

    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  async update(principal: Principal, id: string, dto: UpdateInsurancePolicyDto) {
    const existing = await this.ctx.prisma.patientInsurancePolicy.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Insurance policy not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.patientInsurancePolicy.update({
      where: { id },
      data: {
        patientId: dto.patientId ?? undefined,
        payerId: dto.payerId ?? undefined,
        contractId: dto.contractId === undefined ? undefined : (dto.contractId ?? null),
        policyNumber: dto.policyNumber?.trim(),
        memberId: dto.memberId?.trim(),
        groupId: dto.groupId === undefined ? undefined : (dto.groupId?.trim() ?? null),
        employerName: dto.employerName === undefined ? undefined : (dto.employerName?.trim() ?? null),
        planName: dto.planName === undefined ? undefined : (dto.planName?.trim() ?? null),
        relationship: dto.relationship ? (dto.relationship as any) : undefined,
        status: dto.status ? (dto.status as any) : undefined,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        sumInsured: dto.sumInsured === undefined ? undefined : (dto.sumInsured ?? null),
        balanceRemaining: dto.balanceRemaining === undefined ? undefined : (dto.balanceRemaining ?? null),
        cardNumber: dto.cardNumber === undefined ? undefined : (dto.cardNumber ?? null),
        cardImageUrl: dto.cardImageUrl === undefined ? undefined : (dto.cardImageUrl ?? null),
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_POLICY_UPDATE",
      entity: "PatientInsurancePolicy",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  async verify(principal: Principal, id: string) {
    const existing = await this.ctx.prisma.patientInsurancePolicy.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Insurance policy not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.patientInsurancePolicy.update({
      where: { id },
      data: {
        verifiedAt: new Date(),
        verifiedByUserId: principal.userId,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_POLICY_VERIFY",
      entity: "PatientInsurancePolicy",
      entityId: id,
      meta: {},
    });

    return updated;
  }
}
