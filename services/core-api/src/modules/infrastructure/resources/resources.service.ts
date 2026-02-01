import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import { BranchConfigService } from "../branch-config/branch-config.service";
import type { CreateUnitResourceDto, UpdateUnitResourceDto } from "./dto";
import { assertResourceCode } from "../../../common/naming.util";

@Injectable()
export class ResourcesService {
  constructor(private readonly ctx: InfraContextService, private readonly cfgSvc: BranchConfigService) {}

  async listResources(
    principal: Principal,
    q: {
      branchId?: string | null;
      unitId?: string | null;
      roomId?: string | null;
      resourceType?: string | null;
      state?: string | null;
      q?: string | null;
      includeInactive?: boolean;
    },
  ) {
    const includeInactive = !!q.includeInactive;

    // Determine branch scope
    let branchId: string;
    if (q.unitId) {
      const unit = await this.ctx.prisma.unit.findUnique({ where: { id: q.unitId }, select: { id: true, branchId: true } });
      if (!unit) throw new NotFoundException("Unit not found");
      branchId = this.ctx.resolveBranchId(principal, unit.branchId);
    } else {
      branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    }

    const where: any = {
      branchId,
      ...(includeInactive ? {} : { isActive: true }),
    };

    if (q.unitId) where.unitId = q.unitId;
    if (q.roomId) where.roomId = q.roomId;
    if (q.resourceType) where.resourceType = q.resourceType;
    if (q.state) where.state = q.state;

    if (q.q) {
      where.OR = [
        { code: { contains: q.q, mode: "insensitive" } },
        { name: { contains: q.q, mode: "insensitive" } },
      ];
    }

    return this.ctx.prisma.unitResource.findMany({
      where,
      orderBy: [{ code: "asc" }],
    });
  }

  async createResource(principal: Principal, dto: CreateUnitResourceDto) {
    const unit = await this.ctx.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { id: true, branchId: true, code: true, usesRooms: true, isActive: true },
    });
    if (!unit) throw new NotFoundException("Unit not found");

    const branchId = this.ctx.resolveBranchId(principal, unit.branchId);

    const room = dto.roomId
      ? await this.ctx.prisma.unitRoom.findUnique({
          where: { id: dto.roomId },
          select: { id: true, unitId: true, code: true, isActive: true },
        })
      : null;

    if (dto.roomId && (!room || room.unitId !== unit.id)) {
      throw new BadRequestException("Invalid roomId for this unit");
    }

    if (unit.usesRooms && !room) {
      throw new BadRequestException("This unit uses rooms; roomId is required for resources.");
    }
    if (!unit.usesRooms && room) {
      throw new BadRequestException("This unit is open-bay; roomId must be null.");
    }

    const willBeActive = dto.isActive ?? true;
    if (!unit.isActive && willBeActive) {
      throw new BadRequestException("Cannot create an active resource under an inactive unit");
    }
    if (room && !room.isActive && willBeActive) {
      throw new BadRequestException("Cannot create an active resource under an inactive room");
    }

    const code = assertResourceCode({
      unitCode: unit.code,
      roomCode: room?.code ?? null,
      resourceType: dto.resourceType as any,
      resourceCode: dto.code,
    });

    const dup = await this.ctx.prisma.unitResource.findFirst({
      where: { unitId: unit.id, code },
      select: { id: true },
    });
    if (dup) throw new BadRequestException(`Resource code "${code}" already exists in this unit`);

    const created = await this.ctx.prisma.unitResource.create({
      data: {
        branchId,
        unitId: unit.id,
        roomId: room?.id ?? null,
        resourceType: dto.resourceType as any,
        code,
        name: dto.name.trim(),
        state: "AVAILABLE",
        isActive: willBeActive,
        isSchedulable: dto.isSchedulable ?? dto.resourceType !== "BED",
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_RESOURCE_CREATE",
      entity: "UnitResource",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async updateResource(principal: Principal, id: string, dto: UpdateUnitResourceDto) {
    const res = await this.ctx.prisma.unitResource.findUnique({ where: { id }, select: { id: true, branchId: true } });
    if (!res) throw new NotFoundException("Resource not found");
    const branchId = this.ctx.resolveBranchId(principal, res.branchId);

    const updated = await this.ctx.prisma.unitResource.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        isActive: dto.isActive,
        isSchedulable: dto.isSchedulable,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_RESOURCE_UPDATE",
      entity: "UnitResource",
      entityId: id,
      meta: dto,
    });
    return updated;
  }

  async setResourceState(principal: Principal, id: string, nextState: any) {
    const res = await this.ctx.prisma.unitResource.findUnique({
      where: { id },
      select: { id: true, branchId: true, resourceType: true, state: true, isActive: true },
    });
    if (!res) throw new NotFoundException("Resource not found");

    const branchId = this.ctx.resolveBranchId(principal, res.branchId);

    if (!res.isActive) throw new BadRequestException("Cannot change state of an inactive resource");

    // Housekeeping gate (setup-only): applies only to BED resources when enabled
    if (res.resourceType === "BED") {
      const cfg = await this.cfgSvc.ensureBranchInfraConfig(branchId);
      const gateEnabled = cfg.housekeepingGateEnabled;

      const allowed = new Set(["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE", "INACTIVE"]);
      if (!allowed.has(nextState)) throw new BadRequestException("Invalid state");

      if (gateEnabled && res.state === "OCCUPIED" && nextState === "AVAILABLE") {
        throw new BadRequestException(
          "Housekeeping Gate: Bed cannot move from OCCUPIED to AVAILABLE directly. Move to CLEANING first.",
        );
      }
    }

    const updated = await this.ctx.prisma.unitResource.update({ where: { id }, data: { state: nextState } });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_RESOURCE_STATE_UPDATE",
      entity: "UnitResource",
      entityId: id,
      meta: { from: res.state, to: nextState },
    });

    return updated;
  }

  async deactivateResource(principal: Principal, resourceId: string, opts: { hard?: boolean } = {}) {
    const res = await this.ctx.prisma.unitResource.findUnique({
      where: { id: resourceId },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!res) throw new NotFoundException("Resource not found");

    const branchId = this.ctx.resolveBranchId(principal, res.branchId);

    const hard = !!opts.hard;

    if (hard) {
      await this.ctx.prisma.unitResource.delete({ where: { id: resourceId } });

      await this.ctx.audit.log({
        branchId,
        actorUserId: principal.userId,
        action: "RESOURCE_DELETE_HARD",
        entity: "UnitResource",
        entityId: res.id,
        meta: { hard: true },
      });

      return { ok: true, hardDeleted: true };
    }

    const updated = await this.ctx.prisma.unitResource.update({
      where: { id: resourceId },
      data: { isActive: false },
      select: { id: true, branchId: true, isActive: true, code: true, name: true, state: true },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "RESOURCE_DEACTIVATE",
      entity: "UnitResource",
      entityId: updated.id,
      meta: { hard: false },
    });

    return updated;
  }
}