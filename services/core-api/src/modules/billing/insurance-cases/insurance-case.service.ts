import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../../infrastructure/shared/infra-context.service";
import type { CreateInsuranceCaseDto, UpdateInsuranceCaseDto, TransitionCaseDto } from "./dto";

/**
 * Allowed status transitions for InsuranceCase.
 * Keys are the current status; values are the list of statuses reachable from it.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["POLICY_VERIFIED", "CANCELLED"],
  POLICY_VERIFIED: ["PREAUTH_PENDING", "ADMITTED", "CANCELLED"],
  PREAUTH_PENDING: ["PREAUTH_APPROVED", "CANCELLED"],
  PREAUTH_APPROVED: ["ADMITTED", "CANCELLED"],
  ADMITTED: ["DISCHARGE_PENDING", "CANCELLED"],
  DISCHARGE_PENDING: ["CLAIM_SUBMITTED", "CANCELLED"],
  CLAIM_SUBMITTED: ["CLAIM_APPROVED", "CANCELLED"],
  CLAIM_APPROVED: ["SETTLED", "CANCELLED"],
  SETTLED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

@Injectable()
export class InsuranceCaseService {
  constructor(private readonly ctx: InfraContextService) {}

  // ------------------------------------------------------------------ create
  async create(principal: Principal, dto: CreateInsuranceCaseDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);

    // Validate referenced entities exist
    const [patient, encounter, policy, payer] = await Promise.all([
      this.ctx.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } }),
      this.ctx.prisma.encounter.findUnique({ where: { id: dto.encounterId }, select: { id: true } }),
      this.ctx.prisma.patientInsurancePolicy.findUnique({ where: { id: dto.policyId }, select: { id: true } }),
      this.ctx.prisma.payer.findUnique({ where: { id: dto.payerId }, select: { id: true } }),
    ]);

    if (!patient) throw new BadRequestException("Patient not found");
    if (!encounter) throw new BadRequestException("Encounter not found");
    if (!policy) throw new BadRequestException("Insurance policy not found");
    if (!payer) throw new BadRequestException("Payer not found");

    const created = await this.ctx.prisma.insuranceCase.create({
      data: {
        branchId,
        caseNumber: dto.caseNumber.trim(),
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        admissionId: dto.admissionId ?? null,
        policyId: dto.policyId,
        payerId: dto.payerId,
        contractId: dto.contractId ?? null,
        schemeConfigId: dto.schemeConfigId ?? null,
        caseType: (dto.caseType ?? "CASHLESS") as any,
        status: "DRAFT" as any,
        treatingDoctorId: dto.treatingDoctorId ?? null,
        primaryDiagnosis: dto.primaryDiagnosis ?? null,
        procedures: dto.procedures ?? [],
        packageCode: dto.packageCode ?? null,
        packageName: dto.packageName ?? null,
        estimatedAmount: dto.estimatedAmount ?? null,
        assignedToUserId: dto.assignedToUserId ?? null,
        slaDeadline: dto.slaDeadline ? new Date(dto.slaDeadline) : null,
        notes: dto.notes ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_CASE_CREATE",
      entity: "InsuranceCase",
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
      status?: string;
      patientId?: string;
      payerId?: string;
      encounterId?: string;
      q?: string;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, filters.branchId ?? null);

    const where: any = { branchId };
    if (filters.status) where.status = filters.status as any;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.payerId) where.payerId = filters.payerId;
    if (filters.encounterId) where.encounterId = filters.encounterId;

    const search = (filters.q ?? "").trim();
    if (search) {
      where.OR = [
        { caseNumber: { contains: search, mode: "insensitive" } },
        { patient: { name: { contains: search, mode: "insensitive" } } },
        { primaryDiagnosis: { contains: search, mode: "insensitive" } },
      ];
    }

    return this.ctx.prisma.insuranceCase.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        patient: { select: { id: true, name: true, uhid: true } },
        payer: { select: { id: true, name: true, code: true } },
        policy: { select: { id: true, policyNumber: true } },
        encounter: { select: { id: true, type: true, status: true } },
      },
    });
  }

  // ------------------------------------------------------------------ get
  async get(principal: Principal, id: string) {
    const row = await this.ctx.prisma.insuranceCase.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, uhid: true } },
        payer: { select: { id: true, name: true, code: true } },
        policy: true,
        encounter: { select: { id: true, type: true, status: true } },
        admission: true,
        contract: true,
        schemeConfig: true,
        preauthRequests: { orderBy: { createdAt: "desc" } },
        claims: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!row) throw new NotFoundException("Insurance case not found");

    // Branch-scope check
    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  // ------------------------------------------------------------------ update
  async update(principal: Principal, id: string, dto: UpdateInsuranceCaseDto) {
    const existing = await this.ctx.prisma.insuranceCase.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Insurance case not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.insuranceCase.update({
      where: { id },
      data: {
        caseNumber: dto.caseNumber?.trim(),
        admissionId: dto.admissionId === undefined ? undefined : (dto.admissionId ?? null),
        contractId: dto.contractId === undefined ? undefined : (dto.contractId ?? null),
        schemeConfigId: dto.schemeConfigId === undefined ? undefined : (dto.schemeConfigId ?? null),
        caseType: dto.caseType ? (dto.caseType as any) : undefined,
        treatingDoctorId: dto.treatingDoctorId === undefined ? undefined : (dto.treatingDoctorId ?? null),
        primaryDiagnosis: dto.primaryDiagnosis === undefined ? undefined : (dto.primaryDiagnosis ?? null),
        procedures: dto.procedures ?? undefined,
        packageCode: dto.packageCode === undefined ? undefined : (dto.packageCode ?? null),
        packageName: dto.packageName === undefined ? undefined : (dto.packageName ?? null),
        estimatedAmount: dto.estimatedAmount === undefined ? undefined : (dto.estimatedAmount ?? null),
        assignedToUserId: dto.assignedToUserId === undefined ? undefined : (dto.assignedToUserId ?? null),
        slaDeadline:
          dto.slaDeadline === undefined
            ? undefined
            : dto.slaDeadline
              ? new Date(dto.slaDeadline)
              : null,
        notes: dto.notes === undefined ? undefined : (dto.notes ?? null),
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_CASE_UPDATE",
      entity: "InsuranceCase",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  // ------------------------------------------------------------------ transition
  async transition(principal: Principal, id: string, dto: TransitionCaseDto) {
    const existing = await this.ctx.prisma.insuranceCase.findUnique({
      where: { id },
      select: { id: true, branchId: true, status: true },
    });
    if (!existing) throw new NotFoundException("Insurance case not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);
    const currentStatus = existing.status as string;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(dto.targetStatus)) {
      throw new BadRequestException(
        `Transition from "${currentStatus}" to "${dto.targetStatus}" is not allowed. Allowed targets: ${allowed.join(", ") || "none"}`,
      );
    }

    const updated = await this.ctx.prisma.insuranceCase.update({
      where: { id },
      data: {
        status: dto.targetStatus as any,
        notes: dto.notes ?? undefined,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_CASE_TRANSITION",
      entity: "InsuranceCase",
      entityId: id,
      meta: { from: currentStatus, to: dto.targetStatus, notes: dto.notes },
    });

    return updated;
  }

  // ------------------------------------------------------------------ dashboard
  async dashboard(principal: Principal, branchId?: string | null) {
    const resolvedBranchId = this.ctx.resolveBranchId(principal, branchId ?? null);

    const now = new Date();
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day15 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Open statuses (everything except SETTLED, CLOSED, CANCELLED)
    const openStatuses = [
      "DRAFT",
      "POLICY_VERIFIED",
      "PREAUTH_PENDING",
      "PREAUTH_APPROVED",
      "ADMITTED",
      "DISCHARGE_PENDING",
      "CLAIM_SUBMITTED",
      "CLAIM_APPROVED",
    ] as any[];

    const [totalOpen, preauthPending, claimsPending, slaBreaches, aging] = await Promise.all([
      // Total open cases
      this.ctx.prisma.insuranceCase.count({
        where: { branchId: resolvedBranchId, status: { in: openStatuses } },
      }),

      // Preauth pending
      this.ctx.prisma.insuranceCase.count({
        where: { branchId: resolvedBranchId, status: "PREAUTH_PENDING" as any },
      }),

      // Claims pending (submitted but not yet approved/settled)
      this.ctx.prisma.insuranceCase.count({
        where: { branchId: resolvedBranchId, status: "CLAIM_SUBMITTED" as any },
      }),

      // SLA breaches (open cases where slaDeadline is past)
      this.ctx.prisma.insuranceCase.count({
        where: {
          branchId: resolvedBranchId,
          status: { in: openStatuses },
          slaDeadline: { lt: now },
        },
      }),

      // Aging buckets based on createdAt for open cases
      Promise.all([
        // 0-7 days
        this.ctx.prisma.insuranceCase.count({
          where: {
            branchId: resolvedBranchId,
            status: { in: openStatuses },
            createdAt: { gte: day7 },
          },
        }),
        // 8-15 days
        this.ctx.prisma.insuranceCase.count({
          where: {
            branchId: resolvedBranchId,
            status: { in: openStatuses },
            createdAt: { lt: day7, gte: day15 },
          },
        }),
        // 16-30 days
        this.ctx.prisma.insuranceCase.count({
          where: {
            branchId: resolvedBranchId,
            status: { in: openStatuses },
            createdAt: { lt: day15, gte: day30 },
          },
        }),
        // 30+ days
        this.ctx.prisma.insuranceCase.count({
          where: {
            branchId: resolvedBranchId,
            status: { in: openStatuses },
            createdAt: { lt: day30 },
          },
        }),
      ]),
    ]);

    return {
      totalOpen,
      preauthPending,
      claimsPending,
      slaBreaches,
      agingBuckets: {
        days0to7: aging[0],
        days8to15: aging[1],
        days16to30: aging[2],
        days30plus: aging[3],
      },
    };
  }
}
