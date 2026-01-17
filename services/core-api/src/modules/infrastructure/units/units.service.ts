import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import { LocationService } from "../location/location.service";
import type { CreateUnitDto, UpdateUnitDto } from "./dto";
import { assertUnitCode } from "../../../common/naming.util";

@Injectable()
export class UnitsService {
  constructor(private readonly ctx: InfraContextService, private readonly locationSvc: LocationService) {}

  async getUnit(principal: Principal, id: string) {
    const unit = await this.ctx.prisma.unit.findFirst({
      where: { id },
      include: {
        rooms: { orderBy: [{ code: "asc" }] },
        resources: { orderBy: [{ code: "asc" }] },
        department: true,
        unitType: true,
        locationNode: {
          include: {
            revisions: {
              orderBy: [{ effectiveFrom: "desc" }],
              take: 1,
            },
          },
        },
      },
    });
    if (!unit) throw new NotFoundException("Unit not found");

    this.ctx.resolveBranchId(principal, unit.branchId);
    return unit;
  }

  async listUnits(principal: Principal, q: any) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    const where: any = { branchId };
    if (q.departmentId) where.departmentId = q.departmentId;
    if (q.unitTypeId) where.unitTypeId = q.unitTypeId;
    if (q.locationNodeId) where.locationNodeId = q.locationNodeId;
    if (!q.includeInactive) where.isActive = true;
    if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { code: { contains: q.q, mode: "insensitive" } }];

    const at = new Date();

    return this.ctx.prisma.unit.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        department: { select: { id: true, name: true, code: true } },
        unitType: { select: { id: true, code: true, name: true } },
        locationNode: {
          select: {
            id: true,
            kind: true,
            parentId: true,
            revisions: {
              where: { effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
              orderBy: [{ effectiveFrom: "desc" }],
              take: 1,
              select: { code: true, name: true, isActive: true, effectiveFrom: true, effectiveTo: true },
            },
          },
        },
      },
    });
  }

  async listDepartments(principal: Principal, branchIdParam: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam);
    return this.ctx.prisma.department.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  async createUnit(principal: Principal, dto: CreateUnitDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const code = assertUnitCode(dto.code);

    const dept = await this.ctx.prisma.department.findFirst({
      where: { id: dto.departmentId, branchId },
      select: { id: true },
    });
    if (!dept) throw new BadRequestException("Invalid departmentId (must belong to your branch)");

    const ut = await this.ctx.prisma.unitTypeCatalog.findUnique({
      where: { id: dto.unitTypeId },
      select: { id: true, usesRoomsDefault: true },
    });
    if (!ut) throw new BadRequestException("Invalid unitTypeId");

    const loc = await this.locationSvc.assertValidLocationNode(branchId, dto.locationNodeId, { allowKinds: ["FLOOR", "ZONE"] });

    const created = await this.ctx.prisma.unit.create({
      data: {
        branchId,
        locationNodeId: loc.id,
        departmentId: dto.departmentId,
        unitTypeId: dto.unitTypeId,
        code,
        name: dto.name.trim(),
        usesRooms: dto.usesRooms ?? ut.usesRoomsDefault,
        isActive: dto.isActive ?? true,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_UNIT_CREATE",
      entity: "Unit",
      entityId: created.id,
      meta: dto,
    });

    return this.getUnit(principal, created.id);
  }

  async updateUnit(principal: Principal, id: string, dto: UpdateUnitDto) {
    const unit = await this.ctx.prisma.unit.findUnique({ where: { id }, select: { id: true, branchId: true } });
    if (!unit) throw new NotFoundException("Unit not found");

    const branchId = this.ctx.resolveBranchId(principal, unit.branchId);

    if (dto.locationNodeId) {
      await this.locationSvc.assertValidLocationNode(branchId, dto.locationNodeId, { allowKinds: ["FLOOR", "ZONE"] });
    }

    await this.ctx.prisma.unit.update({
      where: { id },
      data: {
        ...(dto.locationNodeId ? { locationNodeId: dto.locationNodeId } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.usesRooms !== undefined ? { usesRooms: dto.usesRooms } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.ctx.audit.log({ branchId, actorUserId: principal.userId, action: "INFRA_UNIT_UPDATE", entity: "Unit", entityId: id, meta: dto });

    return this.getUnit(principal, id);
  }

  async deactivateUnit(principal: Principal, unitId: string, opts: { hard?: boolean; cascade?: boolean } = {}) {
    const unit = await this.ctx.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!unit) throw new NotFoundException("Unit not found");

    if (principal.roleScope === "BRANCH" && principal.branchId !== unit.branchId) {
      throw new ForbiddenException("Cannot access another branch");
    }

    const hard = !!opts.hard;
    const cascade = opts.cascade !== false;

    if (hard) {
      const roomCount = await this.ctx.prisma.unitRoom.count({ where: { unitId } });
      const resCount = await this.ctx.prisma.unitResource.count({ where: { unitId } });

      if (roomCount || resCount) {
        throw new ConflictException(
          `Cannot hard delete unit: ${roomCount} rooms and ${resCount} resources exist. Deactivate (soft) or remove dependencies first.`,
        );
      }

      await this.ctx.prisma.unit.delete({ where: { id: unitId } });

      await this.ctx.audit.log({
        branchId: unit.branchId,
        actorUserId: principal.userId,
        action: "UNIT_DELETE_HARD",
        entity: "Unit",
        entityId: unit.id,
        meta: { hard: true },
      });

      return { ok: true, hardDeleted: true };
    }

    const updated = await this.ctx.prisma.unit.update({
      where: { id: unitId },
      data: { isActive: false },
      select: { id: true, branchId: true, isActive: true, code: true, name: true },
    });

    if (cascade) {
      await this.ctx.prisma.unitRoom.updateMany({ where: { unitId }, data: { isActive: false } });
      await this.ctx.prisma.unitResource.updateMany({ where: { unitId }, data: { isActive: false } });
    }

    await this.ctx.audit.log({
      branchId: unit.branchId,
      actorUserId: principal.userId,
      action: "UNIT_DEACTIVATE",
      entity: "Unit",
      entityId: updated.id,
      meta: { hard: false, cascade },
    });

    return updated;
  }
}
