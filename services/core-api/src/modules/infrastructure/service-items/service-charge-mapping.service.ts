import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CloseServiceChargeMappingDto ,CloseCurrentServiceChargeMappingDto ,UpsertServiceChargeMappingDto } from "./dto";


@Injectable()
export class ServiceChargeMappingService {
  constructor(private readonly ctx: InfraContextService) {}

  async listServiceChargeMappings(
    principal: Principal,
    opts: {
      branchId: string | null;
      serviceItemId?: string;
      includeHistory?: boolean;
      includeRefs?: boolean;
      take?: number;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, opts.branchId ?? null);

    const where: any = { branchId };
    if (opts.serviceItemId) where.serviceItemId = opts.serviceItemId;

    if (!opts.includeHistory) {
      where.effectiveTo = null; // only current/open mapping
    }

    return this.ctx.prisma.serviceChargeMapping.findMany({
      where,
      orderBy: [{ serviceItemId: "asc" }, { version: "desc" }],
      take: opts.take ? Math.min(Math.max(opts.take, 1), 500) : 500,
      include: opts.includeRefs
        ? {
            serviceItem: true,
            chargeMasterItem: { include: { taxCode: true } },
          }
        : undefined,
    });
  }

  async getCurrentMappingForServiceItem(principal: Principal, serviceItemId: string, includeRefs?: boolean) {
    const svc = await this.ctx.prisma.serviceItem.findUnique({
      where: { id: serviceItemId },
      select: { id: true, branchId: true },
    });
    if (!svc) throw new BadRequestException("Invalid serviceItemId");

    const branchId = this.ctx.resolveBranchId(principal, svc.branchId);

    return this.ctx.prisma.serviceChargeMapping.findFirst({
      where: { branchId, serviceItemId, effectiveTo: null },
      orderBy: [{ version: "desc" }],
      include: includeRefs
        ? {
            serviceItem: true,
            chargeMasterItem: { include: { taxCode: true } },
          }
        : undefined,
    });
  }

  async closeServiceChargeMapping(principal: Principal, id: string, dto: CloseServiceChargeMappingDto) {
    const row = await this.ctx.prisma.serviceChargeMapping.findUnique({
      where: { id },
      select: { id: true, branchId: true, effectiveFrom: true, effectiveTo: true },
    });
    if (!row) throw new NotFoundException("ServiceChargeMapping not found");

    const branchId = this.ctx.resolveBranchId(principal, row.branchId);

    if (row.effectiveTo) return row; // already closed

    const effectiveTo = new Date(dto.effectiveTo);
    if (Number.isNaN(effectiveTo.getTime())) throw new BadRequestException("Invalid effectiveTo");
    if (effectiveTo < row.effectiveFrom) {
      throw new BadRequestException("effectiveTo cannot be before effectiveFrom");
    }

    const updated = await this.ctx.prisma.serviceChargeMapping.update({
      where: { id },
      data: { effectiveTo },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_MAPPING_UPDATE",
      entity: "ServiceChargeMapping",
      entityId: id,
      meta: { effectiveTo: dto.effectiveTo },
    });

    return updated;
  }

  async upsertServiceChargeMapping(principal: Principal, dto: UpsertServiceChargeMappingDto) {
    const svc = await this.ctx.prisma.serviceItem.findUnique({
      where: { id: dto.serviceItemId },
      select: { id: true, branchId: true },
    });
    if (!svc) throw new BadRequestException("Invalid serviceItemId");

    const branchId = this.ctx.resolveBranchId(principal, svc.branchId);

    const cm = await this.ctx.prisma.chargeMasterItem.findFirst({
      where: { id: dto.chargeMasterItemId, branchId },
      select: { id: true },
    });
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
  async closeCurrentMappingForServiceItem(principal: Principal, dto: CloseCurrentServiceChargeMappingDto) {
  const svc = await this.ctx.prisma.serviceItem.findUnique({
    where: { id: dto.serviceItemId },
    select: { id: true, branchId: true },
  });
  if (!svc) throw new BadRequestException("Invalid serviceItemId");

  const branchId = this.ctx.resolveBranchId(principal, svc.branchId);

  let mappingId = dto.mappingId;

  if (mappingId) {
    const m = await this.ctx.prisma.serviceChargeMapping.findFirst({
      where: { id: mappingId, branchId, serviceItemId: dto.serviceItemId },
      select: { id: true },
    });
    if (!m) throw new NotFoundException("Mapping not found for this serviceItemId");
  } else {
    const current = await this.ctx.prisma.serviceChargeMapping.findFirst({
      where: { branchId, serviceItemId: dto.serviceItemId, effectiveTo: null },
      orderBy: [{ version: "desc" }],
      select: { id: true },
    });
    if (!current) throw new BadRequestException("No active mapping to close");
    mappingId = current.id;
  }

  return this.closeServiceChargeMapping(principal, mappingId!, { effectiveTo: dto.effectiveTo });
}

}
