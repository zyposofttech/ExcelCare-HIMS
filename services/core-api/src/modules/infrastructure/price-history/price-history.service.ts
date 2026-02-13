import { Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";

@Injectable()
export class PriceHistoryService {
  constructor(private readonly ctx: InfraContextService) {}

  async listHistory(
    principal: Principal,
    q: {
      branchId?: string | null;
      serviceItemId?: string;
      chargeMasterItemId?: string;
      dateFrom?: string;
      dateTo?: string;
      take?: number;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    const where: any = { branchId };

    if (q.serviceItemId) where.serviceItemId = q.serviceItemId;
    if (q.chargeMasterItemId) where.chargeMasterItemId = q.chargeMasterItemId;

    if (q.dateFrom || q.dateTo) {
      where.effectiveFrom = {};
      if (q.dateFrom) where.effectiveFrom.gte = new Date(q.dateFrom);
      if (q.dateTo) where.effectiveFrom.lte = new Date(q.dateTo);
    }

    return this.ctx.prisma.servicePriceHistory.findMany({
      where,
      orderBy: { effectiveFrom: "desc" },
      take: q.take && Number.isFinite(q.take) ? Math.min(Math.max(q.take, 1), 500) : 200,
      include: {
        serviceItem: { select: { id: true, code: true, name: true } },
        chargeMasterItem: { select: { id: true, code: true, name: true } },
        approvedByUser: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
      },
    });
  }

  async getServiceHistory(principal: Principal, serviceItemId: string) {
    const item = await this.ctx.prisma.serviceItem.findUnique({
      where: { id: serviceItemId },
      select: { id: true, branchId: true },
    });
    if (!item) throw new NotFoundException("Service item not found");

    this.ctx.resolveBranchId(principal, item.branchId);

    return this.ctx.prisma.servicePriceHistory.findMany({
      where: { serviceItemId },
      orderBy: { effectiveFrom: "desc" },
      take: 100,
      include: {
        approvedByUser: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
      },
    });
  }

  async getChargeHistory(principal: Principal, chargeMasterItemId: string) {
    const item = await this.ctx.prisma.chargeMasterItem.findUnique({
      where: { id: chargeMasterItemId },
      select: { id: true, branchId: true },
    });
    if (!item) throw new NotFoundException("Charge master item not found");

    this.ctx.resolveBranchId(principal, item.branchId);

    return this.ctx.prisma.servicePriceHistory.findMany({
      where: { chargeMasterItemId },
      orderBy: { effectiveFrom: "desc" },
      take: 100,
      include: {
        approvedByUser: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Record a price change. Called by other services (ServiceItems, TariffPlans)
   * when a price field changes.
   */
  async recordPriceChange(opts: {
    branchId: string;
    serviceItemId?: string | null;
    chargeMasterItemId?: string | null;
    tariffRateId?: string | null;
    oldPrice: number;
    newPrice: number;
    changeReason?: string;
    effectiveFrom?: Date;
    userId?: string;
  }) {
    const changeAmount = opts.newPrice - opts.oldPrice;
    const changePercent = opts.oldPrice !== 0 ? (changeAmount / opts.oldPrice) * 100 : 0;

    return this.ctx.prisma.servicePriceHistory.create({
      data: {
        branchId: opts.branchId,
        serviceItemId: opts.serviceItemId ?? null,
        chargeMasterItemId: opts.chargeMasterItemId ?? null,
        tariffRateId: opts.tariffRateId ?? null,
        oldPrice: opts.oldPrice,
        newPrice: opts.newPrice,
        changeAmount: Math.abs(changeAmount),
        changePercent: Math.round(changePercent * 10000) / 10000,
        changeReason: opts.changeReason ?? null,
        effectiveFrom: opts.effectiveFrom ?? new Date(),
        createdByUserId: opts.userId ?? null,
      },
    });
  }
}
