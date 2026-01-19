import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreateUnitRoomDto, UpdateUnitRoomDto } from "./dto";
import { assertValidRoomCode } from "./room-code";

@Injectable()
export class RoomsService {
  constructor(private readonly ctx: InfraContextService) {}

  async listRooms(principal: Principal, q: { branchId?: string | null; unitId?: string | null; includeInactive?: boolean }) {
    // ✅ If branchId is not provided (common in GLOBAL calls), infer from unitId.
    let branchId = q.branchId ?? null;

    if (!branchId && q.unitId) {
      const unit = await this.ctx.prisma.unit.findUnique({
        where: { id: q.unitId },
        select: { id: true, branchId: true },
      });
      if (!unit) throw new NotFoundException("Unit not found");
      branchId = unit.branchId;
    }

    // If still missing, this will throw for GLOBAL principals (by design)
    const resolvedBranchId = this.ctx.resolveBranchId(principal, branchId);

    const where: any = { branchId: resolvedBranchId };
    if (q.unitId) where.unitId = q.unitId;
    if (!q.includeInactive) where.isActive = true;

    return this.ctx.prisma.unitRoom.findMany({
      where,
      orderBy: [{ unitId: "asc" }, { code: "asc" }],
      include: { unit: { select: { id: true, code: true, name: true } } },
    });
  }

  async createRoom(principal: Principal, dto: CreateUnitRoomDto) {
    const unit = await this.ctx.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { id: true, branchId: true, code: true, usesRooms: true, isActive: true },
    });
    if (!unit) throw new NotFoundException("Unit not found");
    if (!unit.isActive) throw new BadRequestException("Unit is inactive");

    const branchId = this.ctx.resolveBranchId(principal, unit.branchId);

    if (!unit.usesRooms) {
      throw new BadRequestException("This unit is configured as open-bay (usesRooms=false). Rooms are not allowed.");
    }

    const name = String(dto.name ?? "").trim();
    if (!name) throw new BadRequestException("Room name is required.");

    // ✅ NEW: allow TH01 / OT-1 / LAB1 / TR1 etc
    const code = assertValidRoomCode(dto.code);

    const exists = await this.ctx.prisma.unitRoom.findFirst({
      where: { branchId, unitId: dto.unitId, code },
      select: { id: true },
    });
    if (exists) throw new ConflictException(`Room code "${code}" already exists in this unit.`);

    const created = await this.ctx.prisma.unitRoom.create({
      data: {
        branchId,
        unitId: dto.unitId,
        code,
        name,
        isActive: dto.isActive ?? true,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_ROOM_CREATE",
      entity: "UnitRoom",
      entityId: created.id,
      meta: { ...dto, code, name },
    });

    return created;
  }

  async updateRoom(principal: Principal, id: string, dto: UpdateUnitRoomDto) {
    const room = await this.ctx.prisma.unitRoom.findUnique({
      where: { id },
      select: { id: true, branchId: true, unitId: true, code: true },
    });
    if (!room) throw new NotFoundException("Room not found");

    const branchId = this.ctx.resolveBranchId(principal, room.branchId);

    let nextCode: string | undefined = undefined;

    if (dto.code !== undefined) {
      nextCode = assertValidRoomCode(dto.code);

      // uniqueness per unit
      const exists = await this.ctx.prisma.unitRoom.findFirst({
        where: { branchId, unitId: room.unitId, code: nextCode, id: { not: room.id } },
        select: { id: true },
      });
      if (exists) throw new ConflictException(`Room code "${nextCode}" already exists in this unit.`);
    }

    const updated = await this.ctx.prisma.unitRoom.update({
      where: { id },
      data: {
        ...(nextCode !== undefined ? { code: nextCode } : {}),
        ...(dto.name !== undefined ? { name: String(dto.name ?? "").trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_ROOM_UPDATE",
      entity: "UnitRoom",
      entityId: id,
      meta: { ...dto, ...(nextCode ? { code: nextCode } : {}) },
    });

    return updated;
  }

  async deactivateRoom(principal: Principal, roomId: string, opts: { hard?: boolean; cascade?: boolean } = {}) {
    const room = await this.ctx.prisma.unitRoom.findUnique({
      where: { id: roomId },
      select: { id: true, branchId: true, unitId: true, isActive: true },
    });
    if (!room) throw new NotFoundException("Room not found");

    if ((principal as any).roleScope === "BRANCH" && (principal as any).branchId !== room.branchId) {
      throw new ForbiddenException("Cannot access another branch");
    }

    const hard = !!opts.hard;
    const cascade = opts.cascade !== false;

    if (hard) {
      const resCount = await this.ctx.prisma.unitResource.count({ where: { roomId } });
      if (resCount) {
        throw new ConflictException(
          `Cannot hard delete room: ${resCount} resources exist. Deactivate (soft) or remove dependencies first.`,
        );
      }

      await this.ctx.prisma.unitRoom.delete({ where: { id: roomId } });

      await this.ctx.audit.log({
        branchId: room.branchId,
        actorUserId: principal.userId,
        action: "ROOM_DELETE_HARD",
        entity: "UnitRoom",
        entityId: room.id,
        meta: { hard: true },
      });

      return { ok: true, hardDeleted: true };
    }

    const updated = await this.ctx.prisma.unitRoom.update({
      where: { id: roomId },
      data: { isActive: false },
      select: { id: true, branchId: true, isActive: true, code: true, name: true, unitId: true },
    });

    if (cascade) {
      await this.ctx.prisma.unitResource.updateMany({ where: { roomId }, data: { isActive: false } });
    }

    await this.ctx.audit.log({
      branchId: room.branchId,
      actorUserId: principal.userId,
      action: "ROOM_DEACTIVATE",
      entity: "UnitRoom",
      entityId: updated.id,
      meta: { hard: false, cascade },
    });

    return updated;
  }
}
