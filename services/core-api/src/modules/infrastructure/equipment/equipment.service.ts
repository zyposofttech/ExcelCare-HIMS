import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreateDowntimeDto, CreateEquipmentAssetDto, UpdateEquipmentAssetDto } from "./dto";
import { canonicalizeCode } from "../../../common/naming.util";

@Injectable()
export class EquipmentService {
  constructor(private readonly ctx: InfraContextService) {}

  private enforceEquipmentSchedulable(dto: {
    category: string;
    isSchedulable?: boolean;
    aerbLicenseNo?: string | null;
    aerbValidTo?: string | null;
    pcpndtRegNo?: string | null;
    pcpndtValidTo?: string | null;
  }) {
    if (!dto.isSchedulable) return;

    if (dto.category === "RADIOLOGY") {
      if (!dto.aerbLicenseNo || !dto.aerbValidTo) {
        throw new BadRequestException("AERB compliance is required before RADIOLOGY equipment can be schedulable.");
      }
    }
    if (dto.category === "ULTRASOUND") {
      if (!dto.pcpndtRegNo || !dto.pcpndtValidTo) {
        throw new BadRequestException("PCPNDT compliance is required before ULTRASOUND equipment can be schedulable.");
      }
    }
  }

  async listEquipment(principal: Principal, q: { branchId?: string | null; q?: string }) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    const where: any = { branchId };
    if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { code: { contains: q.q, mode: "insensitive" } }];

    return this.ctx.prisma.equipmentAsset.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: { downtimeTickets: { orderBy: [{ openedAt: "desc" }], take: 5 } },
    });
  }

  async createEquipment(principal: Principal, dto: CreateEquipmentAssetDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const code = canonicalizeCode(dto.code);

    this.enforceEquipmentSchedulable(dto);

    const created = await this.ctx.prisma.equipmentAsset.create({
      data: {
        branchId,
        code,
        name: dto.name?.trim(),
        category: dto.category,
        make: dto.make,
        model: dto.model,
        serial: dto.serial,
        ownerDepartmentId: dto.ownerDepartmentId,
        locationNodeId: dto.locationNodeId ?? null,
        unitId: dto.unitId ?? null,
        roomId: dto.roomId ?? null,
        operationalStatus: dto.operationalStatus,
        amcVendor: dto.amcVendor ?? null,
        amcValidFrom: dto.amcValidFrom ? new Date(dto.amcValidFrom) : null,
        amcValidTo: dto.amcValidTo ? new Date(dto.amcValidTo) : null,
        warrantyValidTo: dto.warrantyValidTo ? new Date(dto.warrantyValidTo) : null,
        pmFrequencyDays: dto.pmFrequencyDays ?? null,
        nextPmDueAt: dto.nextPmDueAt ? new Date(dto.nextPmDueAt) : null,
        aerbLicenseNo: dto.aerbLicenseNo ?? null,
        aerbValidTo: dto.aerbValidTo ? new Date(dto.aerbValidTo) : null,
        pcpndtRegNo: dto.pcpndtRegNo ?? null,
        pcpndtValidTo: dto.pcpndtValidTo ? new Date(dto.pcpndtValidTo) : null,
        isSchedulable: dto.isSchedulable ?? false,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_EQUIPMENT_CREATE",
      entity: "EquipmentAsset",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async updateEquipment(principal: Principal, id: string, dto: UpdateEquipmentAssetDto) {
    const asset = await this.ctx.prisma.equipmentAsset.findUnique({ where: { id }, select: { id: true, branchId: true, category: true } });
    if (!asset) throw new NotFoundException("Equipment not found");

    const branchId = this.ctx.resolveBranchId(principal, asset.branchId);

    const category = (dto.category ?? asset.category) as any;
    this.enforceEquipmentSchedulable({
      category,
      isSchedulable: dto.isSchedulable,
      aerbLicenseNo: dto.aerbLicenseNo,
      aerbValidTo: dto.aerbValidTo ?? null,
      pcpndtRegNo: dto.pcpndtRegNo,
      pcpndtValidTo: dto.pcpndtValidTo ?? null,
    });

    const updated = await this.ctx.prisma.equipmentAsset.update({
      where: { id },
      data: {
        code: dto.code ? canonicalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        category: dto.category as any,
        make: dto.make ?? undefined,
        model: dto.model ?? undefined,
        serial: dto.serial ?? undefined,
        ownerDepartmentId: dto.ownerDepartmentId ?? undefined,
        unitId: dto.unitId ?? undefined,
        roomId: dto.roomId ?? undefined,
        locationNodeId: dto.locationNodeId ?? undefined,
        operationalStatus: dto.operationalStatus as any,
        amcVendor: dto.amcVendor ?? undefined,
        amcValidFrom: dto.amcValidFrom ? new Date(dto.amcValidFrom) : dto.amcValidFrom === null ? null : undefined,
        amcValidTo: dto.amcValidTo ? new Date(dto.amcValidTo) : dto.amcValidTo === null ? null : undefined,
        warrantyValidTo: dto.warrantyValidTo ? new Date(dto.warrantyValidTo) : dto.warrantyValidTo === null ? null : undefined,
        pmFrequencyDays: dto.pmFrequencyDays ?? undefined,
        nextPmDueAt: dto.nextPmDueAt ? new Date(dto.nextPmDueAt) : dto.nextPmDueAt === null ? null : undefined,
        aerbLicenseNo: dto.aerbLicenseNo ?? undefined,
        aerbValidTo: dto.aerbValidTo ? new Date(dto.aerbValidTo) : dto.aerbValidTo === null ? null : undefined,
        pcpndtRegNo: dto.pcpndtRegNo ?? undefined,
        pcpndtValidTo: dto.pcpndtValidTo ? new Date(dto.pcpndtValidTo) : dto.pcpndtValidTo === null ? null : undefined,
        isSchedulable: dto.isSchedulable ?? undefined,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_EQUIPMENT_UPDATE",
      entity: "EquipmentAsset",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  async openDowntime(principal: Principal, dto: CreateDowntimeDto) {
    const asset = await this.ctx.prisma.equipmentAsset.findUnique({ where: { id: dto.assetId }, select: { id: true, branchId: true } });
    if (!asset) throw new NotFoundException("Equipment not found");
    const branchId = this.ctx.resolveBranchId(principal, asset.branchId);

    const ticket = await this.ctx.prisma.downtimeTicket.create({
      data: { assetId: dto.assetId, reason: dto.reason.trim(), notes: dto.notes ?? null },
    });

    await this.ctx.prisma.equipmentAsset.update({ where: { id: dto.assetId }, data: { operationalStatus: "DOWN" as any } });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_EQUIPMENT_DOWNTIME_OPEN",
      entity: "DowntimeTicket",
      entityId: ticket.id,
      meta: dto,
    });

    return ticket;
  }

  async closeDowntime(principal: Principal, dto: { ticketId: string; notes?: string }) {
    const ticket = await this.ctx.prisma.downtimeTicket.findUnique({
      where: { id: dto.ticketId },
      include: { asset: { select: { id: true, branchId: true } } },
    });
    if (!ticket) throw new NotFoundException("Downtime ticket not found");
    const branchId = this.ctx.resolveBranchId(principal, ticket.asset.branchId);

    const updated = await this.ctx.prisma.downtimeTicket.update({
      where: { id: dto.ticketId },
      data: { status: "CLOSED" as any, notes: dto.notes ?? undefined, closedAt: new Date() },
    });

    await this.ctx.prisma.equipmentAsset.update({ where: { id: ticket.assetId }, data: { operationalStatus: "OPERATIONAL" as any } });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_EQUIPMENT_DOWNTIME_CLOSE",
      entity: "DowntimeTicket",
      entityId: updated.id,
      meta: dto,
    });

    return updated;
  }
}
