import { BadRequestException, Injectable } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { UpsertServiceChargeMappingDto } from "./dto";

@Injectable()
export class ServiceChargeMappingService {
  constructor(private readonly ctx: InfraContextService) {}

  async upsertServiceChargeMapping(principal: Principal, dto: UpsertServiceChargeMappingDto) {
    const svc = await this.ctx.prisma.serviceItem.findUnique({ where: { id: dto.serviceItemId }, select: { id: true, branchId: true } });
    if (!svc) throw new BadRequestException("Invalid serviceItemId");

    const branchId = this.ctx.resolveBranchId(principal, svc.branchId);

    const cm = await this.ctx.prisma.chargeMasterItem.findFirst({ where: { id: dto.chargeMasterItemId, branchId }, select: { id: true } });
    if (!cm) throw new BadRequestException("Invalid chargeMasterItemId for this branch");

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    const last = await this.ctx.prisma.serviceChargeMapping.findFirst({
      where: { branchId, serviceItemId: dto.serviceItemId },
      orderBy: [{ version: "desc" }],
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    const overlapEnd = effectiveTo ?? new Date("9999-12-31T00:00:00.000Z");

    const existingOverlap = await this.ctx.prisma.serviceChargeMapping.findFirst({
      where: {
        branchId,
        serviceItemId: dto.serviceItemId,
        effectiveFrom: { lt: overlapEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
      select: { id: true },
    });

    if (existingOverlap) {
      throw new BadRequestException(
        "Overlapping service-charge mapping exists. Close existing effectiveTo before creating new mapping.",
      );
    }

    const created = await this.ctx.prisma.serviceChargeMapping.create({
      data: {
        branchId,
        serviceItemId: dto.serviceItemId,
        chargeMasterItemId: dto.chargeMasterItemId,
        effectiveFrom,
        effectiveTo,
        version: nextVersion,
      },
    });

    await this.ctx.prisma.fixItTask.updateMany({
      where: {
        branchId,
        serviceItemId: dto.serviceItemId,
        type: "SERVICE_CHARGE_MAPPING_MISSING" as any,
        status: { in: ["OPEN", "IN_PROGRESS"] as any },
      },
      data: { status: "RESOLVED" as any, resolvedAt: new Date() },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_MAPPING_UPDATE",
      entity: "ServiceChargeMapping",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }
}
