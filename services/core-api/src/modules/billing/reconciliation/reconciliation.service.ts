// ---------------------------------------------------------------------------
// Reconciliation Service
// ---------------------------------------------------------------------------
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InfraContextService } from "../../infrastructure/shared/infra-context.service";
import type { Principal } from "../../auth/access-policy.service";
import type { CreatePaymentAdviceDto } from "./dto/create-payment-advice.dto";
import type { ReconcileDto } from "./dto/reconcile.dto";

@Injectable()
export class ReconciliationService {
  constructor(private readonly ctx: InfraContextService) {}

  // ---- Create Payment Advice ----

  async createPaymentAdvice(
    principal: Principal,
    dto: CreatePaymentAdviceDto,
    branchIdParam?: string | null,
  ) {
    // Validate claim exists
    const claim = await this.ctx.prisma.claim.findUnique({
      where: { id: dto.claimId },
      select: { id: true, branchId: true, claimNumber: true },
    });
    if (!claim) throw new NotFoundException("Claim not found");

    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? claim.branchId);

    const paymentDate = new Date(dto.paymentDate);
    if (Number.isNaN(paymentDate.getTime())) {
      throw new BadRequestException("Invalid paymentDate");
    }

    const created = await this.ctx.prisma.paymentAdvice.create({
      data: {
        branchId,
        claimId: dto.claimId,
        adviceNumber: dto.adviceNumber ?? null,
        utrNumber: dto.utrNumber ?? null,
        paymentDate,
        amount: dto.amount as any,
        paymentMode: (dto.paymentMode ?? "NEFT") as any,
        status: "PA_RECEIVED" as any,
        bankReference: dto.bankReference ?? null,
        shortPaymentReason: dto.shortPaymentReason ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_PAYMENT_ADVICE_CREATE",
      entity: "PaymentAdvice",
      entityId: created.id,
      meta: { claimId: dto.claimId, amount: dto.amount },
    });

    return created;
  }

  // ---- List Payment Advices ----

  async listPaymentAdvices(
    principal: Principal,
    filters: { branchId?: string | null; claimId?: string; status?: string },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, filters.branchId ?? null);

    const where: any = { branchId };
    if (filters.claimId) where.claimId = filters.claimId;
    if (filters.status) where.status = filters.status;

    return this.ctx.prisma.paymentAdvice.findMany({
      where,
      include: {
        claim: {
          include: {
            insuranceCase: {
              include: {
                patient: true,
                payer: true,
              },
            },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });
  }

  // ---- Reconcile ----

  async reconcile(
    principal: Principal,
    paymentAdviceId: string,
    dto: ReconcileDto,
  ) {
    const pa = await this.ctx.prisma.paymentAdvice.findUnique({
      where: { id: paymentAdviceId },
      select: { id: true, branchId: true, claimId: true, status: true },
    });
    if (!pa) throw new NotFoundException("PaymentAdvice not found");

    this.ctx.resolveBranchId(principal, pa.branchId);

    if ((pa.status as string) === "PA_RECONCILED") {
      throw new BadRequestException("Payment advice is already reconciled");
    }

    // Update payment advice status
    const updated = await this.ctx.prisma.paymentAdvice.update({
      where: { id: paymentAdviceId },
      data: {
        status: "PA_RECONCILED" as any,
        reconciledAt: new Date(),
        reconciledByUserId: principal.userId,
        meta: dto.notes ? { reconciliationNotes: dto.notes } : undefined,
      },
    });

    // Recalculate paidAmount on the Claim (sum of all PA_RECONCILED payment advices)
    const reconciledAdvices = await this.ctx.prisma.paymentAdvice.findMany({
      where: {
        claimId: pa.claimId,
        status: "PA_RECONCILED" as any,
      },
      select: { amount: true },
    });

    const totalPaid = reconciledAdvices.reduce(
      (sum: number, adv: any) => sum + Number(adv.amount),
      0,
    );

    await this.ctx.prisma.claim.update({
      where: { id: pa.claimId },
      data: { paidAmount: totalPaid as any },
    });

    // Audit
    await this.ctx.audit.log({
      branchId: pa.branchId,
      actorUserId: principal.userId,
      action: "BILLING_PAYMENT_ADVICE_RECONCILE",
      entity: "PaymentAdvice",
      entityId: paymentAdviceId,
      meta: {
        claimId: pa.claimId,
        totalPaid,
        notes: dto.notes,
      },
    });

    return updated;
  }

  // ---- Summary ----

  async summary(principal: Principal, branchId?: string | null) {
    const resolvedBranchId = this.ctx.resolveBranchId(principal, branchId ?? null);

    // Total receivable: sum of totalAmount for claims NOT in terminal states
    const receivableClaims = await this.ctx.prisma.claim.findMany({
      where: {
        branchId: resolvedBranchId,
        status: {
          notIn: ["CLAIM_PAID", "CLAIM_CLOSED"] as any,
        },
      },
      select: { totalAmount: true },
    });

    const totalReceivable = receivableClaims.reduce(
      (sum: number, c: any) => sum + (c.totalAmount ? Number(c.totalAmount) : 0),
      0,
    );

    // Total received: sum of all payment advice amounts
    const allAdvices = await this.ctx.prisma.paymentAdvice.findMany({
      where: { branchId: resolvedBranchId },
      select: { amount: true },
    });

    const totalReceived = allAdvices.reduce(
      (sum: number, adv: any) => sum + Number(adv.amount),
      0,
    );

    // Pending reconciliation: count of PA_RECEIVED
    const pendingReconciliation = await this.ctx.prisma.paymentAdvice.count({
      where: {
        branchId: resolvedBranchId,
        status: "PA_RECEIVED" as any,
      },
    });

    return {
      totalReceivable,
      totalReceived,
      pendingReconciliation,
    };
  }
}
