import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";
import type { Principal } from "./diagnostics.principal";
import { resolveBranchId } from "./diagnostics.util";
import type {
  AddCapabilityEquipmentDto,
  AddCapabilityResourceDto,
  AddCapabilityRoomDto,
  CreateCapabilityDto,
  ListCapabilitiesQuery,
  UpdateCapabilityDto,
} from "./dto";

@Injectable()
export class DiagnosticsCapabilitiesService {
  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  async list(principal: Principal, q: ListCapabilitiesQuery) {
    const branchId = resolveBranchId(principal, q.branchId);

    return this.prisma.diagnosticCapability.findMany({
      where: {
        branchId,
        ...(q.includeInactive ? {} : { isActive: true }),
        ...(q.servicePointId ? { servicePointId: q.servicePointId } : {}),
        ...(q.diagnosticItemId ? { diagnosticItemId: q.diagnosticItemId } : {}),
      },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
      include: {
        servicePoint: { include: { locationNode: true } },
        diagnosticItem: { include: { category: true } },
        _count: { select: { allowedRooms: true, allowedResources: true, allowedEquipment: true } },
      },
    });
  }

  async get(principal: Principal, args: { id: string; branchId: string }) {
    const branchId = resolveBranchId(principal, args.branchId);

    const cap = await this.prisma.diagnosticCapability.findFirst({
      where: { id: args.id, branchId },
      include: {
        servicePoint: { include: { locationNode: true } },
        diagnosticItem: { include: { category: true } },
        allowedRooms: { where: { isActive: true }, include: { room: true } },
        allowedResources: { where: { isActive: true }, include: { resource: true } },
        allowedEquipment: { where: { isActive: true }, include: { equipment: true } },
      },
    });
    if (!cap) throw new NotFoundException("Diagnostic capability not found");
    return cap;
  }

  async create(principal: Principal, dto: CreateCapabilityDto) {
    const branchId = resolveBranchId(principal, dto.branchId);

    // Validate service point
    const sp = await this.prisma.diagnosticServicePoint.findFirst({
      where: { id: dto.servicePointId, branchId, isActive: true },
      select: { id: true },
    });
    if (!sp) throw new BadRequestException("Invalid servicePointId for this branch");

    // Validate diagnostic item
    const item = await this.prisma.diagnosticItem.findFirst({
      where: { id: dto.diagnosticItemId, branchId, isActive: true },
      select: { id: true, kind: true },
    });
    if (!item) throw new BadRequestException("Invalid diagnosticItemId for this branch");

    // Enforce single primary per (servicePointId, diagnosticItemId) is already unique,
    // but you may want "single primary per diagnosticItem across all service points":
    // Not enforced here; typically you can have multiple service points, each with primary for the same item.

    return this.prisma.diagnosticCapability.upsert({
      where: { servicePointId_diagnosticItemId: { servicePointId: dto.servicePointId, diagnosticItemId: dto.diagnosticItemId } },
      create: {
        branchId,
        servicePointId: dto.servicePointId,
        diagnosticItemId: dto.diagnosticItemId,
        // Prisma enum type comes from generated client; DTO enum is runtime-valid but not type-identical.
        modality: (dto.modality ?? null) as any,
        defaultDurationMins: dto.defaultDurationMins ?? null,
        isPrimary: dto.isPrimary ?? false,
        isActive: true,
      },
      update: {
        isActive: true,
        modality: (dto.modality ?? null) as any,
        defaultDurationMins: dto.defaultDurationMins ?? null,
        isPrimary: dto.isPrimary ?? false,
      },
      include: {
        servicePoint: true,
        diagnosticItem: true,
      },
    });
  }

  async update(principal: Principal, id: string, dto: UpdateCapabilityDto) {
    const existing = await this.prisma.diagnosticCapability.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Diagnostic capability not found");

    const branchId = resolveBranchId(principal, dto.branchId ?? existing.branchId);

    if (existing.branchId !== branchId) throw new BadRequestException("Invalid branchId for this capability");

    return this.prisma.diagnosticCapability.update({
      where: { id },
      data: {
        ...(dto.modality !== undefined ? { modality: dto.modality as any } : {}),
        ...(dto.defaultDurationMins !== undefined ? { defaultDurationMins: dto.defaultDurationMins } : {}),
        ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { servicePoint: true, diagnosticItem: true },
    });
  }

  async softDelete(principal: Principal, args: { id: string; branchId: string }) {
    const branchId = resolveBranchId(principal, args.branchId);

    const cap = await this.prisma.diagnosticCapability.findFirst({ where: { id: args.id, branchId } });
    if (!cap) throw new NotFoundException("Diagnostic capability not found");

    return this.prisma.diagnosticCapability.update({
      where: { id: args.id },
      data: { isActive: false },
    });
  }

  // ---------------- Allowed Rooms ----------------
  async listAllowedRooms(principal: Principal, args: { capabilityId: string; branchId: string }) {
    const branchId = resolveBranchId(principal, args.branchId);
    await this.assertCapability(branchId, args.capabilityId);

    return this.prisma.diagnosticCapabilityRoom.findMany({
      where: { branchId, capabilityId: args.capabilityId, isActive: true },
      orderBy: [{ createdAt: "asc" }],
      include: { room: { include: { unit: true } } },
    });
  }

  async addAllowedRoom(principal: Principal, args: { capabilityId: string; branchId: string }, dto: AddCapabilityRoomDto) {
    const branchId = resolveBranchId(principal, args.branchId);

    const cap = await this.assertCapability(branchId, args.capabilityId);

    // Optional strong rule: room must belong to same branch AND be part of service point mappings
    const room = await this.prisma.unitRoom.findFirst({ where: { id: dto.roomId, branchId, isActive: true }, select: { id: true } });
    if (!room) throw new BadRequestException("Invalid roomId for this branch");

    const mapped = await this.prisma.diagnosticServicePointRoom.findFirst({
      where: { branchId, servicePointId: cap.servicePointId, roomId: dto.roomId, isActive: true },
      select: { id: true },
    });
    if (!mapped) throw new BadRequestException("Room is not mapped to this service point. Map it first.");

    return this.prisma.diagnosticCapabilityRoom.upsert({
      where: { capabilityId_roomId: { capabilityId: args.capabilityId, roomId: dto.roomId } },
      create: { branchId, capabilityId: args.capabilityId, roomId: dto.roomId, isActive: true },
      update: { isActive: true },
      include: { room: true },
    });
  }

  async removeAllowedRoom(principal: Principal, args: { capabilityId: string; linkId: string; branchId: string }) {
    const branchId = resolveBranchId(principal, args.branchId);
    await this.assertCapability(branchId, args.capabilityId);

    const link = await this.prisma.diagnosticCapabilityRoom.findFirst({
      where: { id: args.linkId, branchId, capabilityId: args.capabilityId },
      select: { id: true },
    });
    if (!link) throw new NotFoundException("Allowed room link not found");

    return this.prisma.diagnosticCapabilityRoom.update({ where: { id: args.linkId }, data: { isActive: false } });
  }

  // ---------------- Allowed Resources ----------------
  async listAllowedResources(principal: Principal, args: { capabilityId: string; branchId: string }) {
    const branchId = resolveBranchId(principal, args.branchId);
    await this.assertCapability(branchId, args.capabilityId);

    return this.prisma.diagnosticCapabilityResource.findMany({
      where: { branchId, capabilityId: args.capabilityId, isActive: true },
      orderBy: [{ createdAt: "asc" }],
      include: { resource: { include: { unit: true, room: true } } },
    });
  }

  async addAllowedResource(principal: Principal, args: { capabilityId: string; branchId: string }, dto: AddCapabilityResourceDto) {
    const branchId = resolveBranchId(principal, args.branchId);

    const cap = await this.assertCapability(branchId, args.capabilityId);

    const res = await this.prisma.unitResource.findFirst({ where: { id: dto.resourceId, branchId, isActive: true }, select: { id: true } });
    if (!res) throw new BadRequestException("Invalid resourceId for this branch");

    const mapped = await this.prisma.diagnosticServicePointResource.findFirst({
      where: { branchId, servicePointId: cap.servicePointId, resourceId: dto.resourceId, isActive: true },
      select: { id: true },
    });
    if (!mapped) throw new BadRequestException("Resource is not mapped to this service point. Map it first.");

    return this.prisma.diagnosticCapabilityResource.upsert({
      where: { capabilityId_resourceId: { capabilityId: args.capabilityId, resourceId: dto.resourceId } },
      create: { branchId, capabilityId: args.capabilityId, resourceId: dto.resourceId, isActive: true },
      update: { isActive: true },
      include: { resource: true },
    });
  }

  async removeAllowedResource(principal: Principal, args: { capabilityId: string; linkId: string; branchId: string }) {
    const branchId = resolveBranchId(principal, args.branchId);
    await this.assertCapability(branchId, args.capabilityId);

    const link = await this.prisma.diagnosticCapabilityResource.findFirst({
      where: { id: args.linkId, branchId, capabilityId: args.capabilityId },
      select: { id: true },
    });
    if (!link) throw new NotFoundException("Allowed resource link not found");

    return this.prisma.diagnosticCapabilityResource.update({ where: { id: args.linkId }, data: { isActive: false } });
  }

  // ---------------- Allowed Equipment ----------------
  async listAllowedEquipment(principal: Principal, args: { capabilityId: string; branchId: string }) {
    const branchId = resolveBranchId(principal, args.branchId);
    await this.assertCapability(branchId, args.capabilityId);

    return this.prisma.diagnosticCapabilityEquipment.findMany({
      where: { branchId, capabilityId: args.capabilityId, isActive: true },
      orderBy: [{ createdAt: "asc" }],
      include: { equipment: true },
    });
  }

  async addAllowedEquipment(principal: Principal, args: { capabilityId: string; branchId: string }, dto: AddCapabilityEquipmentDto) {
    const branchId = resolveBranchId(principal, args.branchId);

    const cap = await this.assertCapability(branchId, args.capabilityId);

    const eq = await this.prisma.equipmentAsset.findFirst({ where: { id: dto.equipmentId, branchId }, select: { id: true } });
    if (!eq) throw new BadRequestException("Invalid equipmentId for this branch");

    const mapped = await this.prisma.diagnosticServicePointEquipment.findFirst({
      where: { branchId, servicePointId: cap.servicePointId, equipmentId: dto.equipmentId, isActive: true },
      select: { id: true },
    });
    if (!mapped) throw new BadRequestException("Equipment is not mapped to this service point. Map it first.");

    return this.prisma.diagnosticCapabilityEquipment.upsert({
      where: { capabilityId_equipmentId: { capabilityId: args.capabilityId, equipmentId: dto.equipmentId } },
      create: { branchId, capabilityId: args.capabilityId, equipmentId: dto.equipmentId, isActive: true },
      update: { isActive: true },
      include: { equipment: true },
    });
  }

  async removeAllowedEquipment(principal: Principal, args: { capabilityId: string; linkId: string; branchId: string }) {
    const branchId = resolveBranchId(principal, args.branchId);
    await this.assertCapability(branchId, args.capabilityId);

    const link = await this.prisma.diagnosticCapabilityEquipment.findFirst({
      where: { id: args.linkId, branchId, capabilityId: args.capabilityId },
      select: { id: true },
    });
    if (!link) throw new NotFoundException("Allowed equipment link not found");

    return this.prisma.diagnosticCapabilityEquipment.update({ where: { id: args.linkId }, data: { isActive: false } });
  }

  private async assertCapability(branchId: string, capabilityId: string) {
    const cap = await this.prisma.diagnosticCapability.findFirst({
      where: { id: capabilityId, branchId, isActive: true },
      select: { id: true, servicePointId: true },
    });
    if (!cap) throw new NotFoundException("Capability not found or inactive");
    return cap;
  }
}
