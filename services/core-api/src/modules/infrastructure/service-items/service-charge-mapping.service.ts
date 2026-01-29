import { BadRequestException, Injectable } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CloseServiceChargeMappingDto, UpsertServiceChargeMappingDto } from "./dto";

@Injectable()
export class ServiceChargeMappingService {
  constructor(private readonly ctx: InfraContextService) {}

  private async openFixItOnce(branchId: string, input: {
    type: any;
    entityType?: any;
    entityId?: string | null;
    serviceItemId?: string | null;
    title: string;
    details?: any;
    severity?: any;
  }) {
    const exists = await this.ctx.prisma.fixItTask.findFirst({
      where: {
        branchId,
        type: input.type,
        status: { in: ["OPEN", "IN_PROGRESS"] as any },
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
      select: { id: true },
    });
    if (exists) return;

    await this.ctx.prisma.fixItTask.create({
      data: {
        branchId,
        type: input.type,
        status: "OPEN" as any,
        severity: (input.severity ?? "BLOCKER") as any,
        entityType: (input.entityType ?? null) as any,
        entityId: input.entityId ?? null,
        serviceItemId: input.serviceItemId ?? null,
        title: input.title,
        details: input.details ?? undefined,
      },
    });
  }

  private async resolveFixIts(branchId: string, where: any) {
    await this.ctx.prisma.fixItTask.updateMany({
      where: { branchId, status: { in: ["OPEN", "IN_PROGRESS"] as any }, ...where },
      data: { status: "RESOLVED" as any, resolvedAt: new Date() },
    });
  }

  async upsertServiceChargeMapping(principal: Principal, dto: UpsertServiceChargeMappingDto) {
    const svc = await this.ctx.prisma.serviceItem.findUnique({
      where: { id: dto.serviceItemId },
      select: { id: true, branchId: true, code: true, name: true, chargeUnit: true },
    });
    if (!svc) throw new BadRequestException("Invalid serviceItemId");

    const branchId = this.ctx.resolveBranchId(principal, svc.branchId);

    const cm = await this.ctx.prisma.chargeMasterItem.findFirst({
      where: { id: dto.chargeMasterItemId, branchId },
      select: { id: true, code: true, name: true, chargeUnit: true, isActive: true },
    });
    if (!cm) throw new BadRequestException("Invalid chargeMasterItemId for this branch");
    if (cm.isActive === false) throw new BadRequestException("Cannot map an INACTIVE ChargeMasterItem");

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

    // Resolve mapping-missing FixIt (old + new style)
    await this.resolveFixIts(branchId, {
      type: "SERVICE_CHARGE_MAPPING_MISSING" as any,
      OR: [
        { serviceItemId: dto.serviceItemId },
        { entityType: "SERVICE_ITEM" as any, entityId: dto.serviceItemId },
      ],
    });

    // Charge unit mismatch open/resolve
    const mismatch = (svc.chargeUnit as any) !== (cm.chargeUnit as any);
    if (mismatch) {
      await this.openFixItOnce(branchId, {
        type: "CHARGE_UNIT_MISMATCH" as any,
        entityType: "SERVICE_ITEM" as any,
        entityId: svc.id,
        serviceItemId: svc.id,
        title: `Charge unit mismatch for ${svc.code}`,
        details: {
          serviceItemId: svc.id,
          serviceChargeUnit: svc.chargeUnit,
          chargeMasterItemId: cm.id,
          chargeMasterChargeUnit: cm.chargeUnit,
        },
        severity: "BLOCKER",
      });
    } else {
      await this.resolveFixIts(branchId, {
        type: "CHARGE_UNIT_MISMATCH" as any,
        entityType: "SERVICE_ITEM" as any,
        entityId: svc.id,
      });
    }

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

  async closeCurrentMapping(principal: Principal, dto: CloseServiceChargeMappingDto) {
    const svc = await this.ctx.prisma.serviceItem.findUnique({
      where: { id: dto.serviceItemId },
      select: { id: true, branchId: true },
    });
    if (!svc) throw new BadRequestException("Invalid serviceItemId");

    const branchId = this.ctx.resolveBranchId(principal, svc.branchId);

    const active = await this.ctx.prisma.serviceChargeMapping.findFirst({
      where: { branchId, serviceItemId: dto.serviceItemId, effectiveTo: null },
      orderBy: [{ effectiveFrom: "desc" }],
      select: { id: true, effectiveFrom: true },
    });
    if (!active) throw new BadRequestException("No active mapping to close");

    const effectiveTo = new Date(dto.effectiveTo);
    if (Number.isNaN(effectiveTo.getTime())) throw new BadRequestException("Invalid effectiveTo");
    if (effectiveTo < active.effectiveFrom) throw new BadRequestException("effectiveTo cannot be before effectiveFrom");

    const closed = await this.ctx.prisma.serviceChargeMapping.update({
      where: { id: active.id },
      data: { effectiveTo },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_MAPPING_CLOSE",
      entity: "ServiceChargeMapping",
      entityId: closed.id,
      meta: dto,
    });

    return closed;
  }
}
