import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as Db from "@zypocare/db";

import type { Principal } from "../../auth/access-policy.service";
import { canonicalizeCode } from "../../../common/naming.util";
import { InfraContextService } from "../shared/infra-context.service";

import type { CreateOrderSetDto, UpdateOrderSetDto, UpsertOrderSetItemDto } from "./dto";

type EnsureOrderSet = {
  id: string;
  branchId: string;
  channel: any;
  status: any;
  version: number;
  code: string;
  name: string;
};

@Injectable()
export class OrderSetsService {
  constructor(private readonly ctx: InfraContextService) {}

  /** Runtime enum list (preferred). */
  private getCatalogueChannelValues(): string[] {
    const anyDb = Db as any;
    const enumObj = anyDb?.CatalogueChannel ?? anyDb?.Prisma?.CatalogueChannel;
    if (!enumObj) return [];
    const vals = Object.values(enumObj).filter((v) => typeof v === "string") as string[];
    return Array.from(new Set(vals));
  }

  private matchChannel(allowed: string[], raw: string): string | null {
    const upper = raw.toUpperCase();
    return allowed.find((v) => String(v).toUpperCase() === upper) ?? null;
  }

  /** Must NEVER return null because Prisma requires non-null. */
  private normalizeChannelForCreate(input: string | null | undefined): string {
    const allowed = this.getCatalogueChannelValues();
    const raw = String(input ?? "").trim();

    if (!raw) {
      // default
      if (allowed.length) return allowed.find((v) => String(v).toUpperCase() === "OPD") ?? allowed[0];
      return "OPD";
    }

    if (allowed.length) {
      const matched = this.matchChannel(allowed, raw);
      if (!matched) throw new BadRequestException(`Invalid channel '${raw}'. Allowed values: ${allowed.join(", ")}`);
      return matched;
    }

    // if enum not available at runtime, pass raw and let Prisma validate
    return raw;
  }

  /** Update: undefined => no change. Empty => reject. */
  private normalizeChannelForUpdate(input: string | null | undefined): string | undefined {
    if (input === undefined) return undefined;
    const raw = String(input ?? "").trim();
    if (!raw) throw new BadRequestException("channel must not be empty");

    const allowed = this.getCatalogueChannelValues();
    if (allowed.length) {
      const matched = this.matchChannel(allowed, raw);
      if (!matched) throw new BadRequestException(`Invalid channel '${raw}'. Allowed values: ${allowed.join(", ")}`);
      return matched;
    }

    return raw;
  }

  async meta(principal: Principal, branchIdParam?: string | null) {
    // resolve branch if provided, but meta can work even without it
    if (branchIdParam) this.ctx.resolveBranchId(principal, branchIdParam ?? null);

    const channels = this.getCatalogueChannelValues();
    return { channels };
  }

  private async ensureOrderSet(principal: Principal, id: string): Promise<EnsureOrderSet> {
    const os = await this.ctx.prisma.orderSet.findUnique({
      where: { id },
      select: {
        id: true,
        branchId: true,
        channel: true,
        status: true,
        version: true,
        code: true,
        name: true,
      } as any,
    });

    if (!os) throw new NotFoundException("Order set not found");

    const branchId = this.ctx.resolveBranchId(principal, (os as any).branchId);
    return { ...(os as any), branchId };
  }

  async create(principal: Principal, dto: CreateOrderSetDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const code = canonicalizeCode(dto.code);
    const channel = this.normalizeChannelForCreate(dto.channel);

    // ✅ Required relation connect (avoids "branch missing")
    const created = await this.ctx.prisma.orderSet.create({
      data: {
        branch: { connect: { id: branchId } },
        code,
        name: dto.name.trim(),
        description: dto.description ?? null,
        channel: channel as any,
      } as any,
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_ORDER_SET_CREATE",
      entity: "OrderSet",
      entityId: created.id,
      meta: { code, name: dto.name, channel },
    });

    return created;
  }

  async list(
    principal: Principal,
    q: { branchId?: string | null; q?: string; status?: string | null; channel?: string | null },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);

    const where: any = { branchId };

    if (q.status) where.status = q.status as any;

    if (q.channel) {
      const raw = String(q.channel).trim();
      if (raw) {
        const allowed = this.getCatalogueChannelValues();
        where.channel = (allowed.length ? (this.matchChannel(allowed, raw) ?? raw) : raw) as any;
      }
    }

    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: "insensitive" } },
        { code: { contains: q.q, mode: "insensitive" } },
      ];
    }

    return this.ctx.prisma.orderSet.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { serviceItem: true, diagnosticItem: true, pkg: true },
        },
      },
    });
  }

  async get(principal: Principal, id: string) {
    const os = await this.ensureOrderSet(principal, id);
    return this.ctx.prisma.orderSet.findUnique({
      where: { id: os.id },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { serviceItem: true, diagnosticItem: true, pkg: true },
        },
      },
    });
  }

  async update(principal: Principal, id: string, dto: UpdateOrderSetDto) {
    const os = await this.ensureOrderSet(principal, id);

    const channel = this.normalizeChannelForUpdate(dto.channel);

    const updated = await this.ctx.prisma.orderSet.update({
      where: { id: os.id },
      data: {
        code: dto.code ? canonicalizeCode(dto.code) : undefined,
        name: dto.name?.trim(),
        description: dto.description ?? undefined,
        channel: channel as any,
        status: dto.status !== undefined ? (dto.status as any) : undefined,
      } as any,
    });

    await this.ctx.audit.log({
      branchId: os.branchId,
      actorUserId: principal.userId,
      action: "INFRA_ORDER_SET_UPDATE",
      entity: "OrderSet",
      entityId: os.id,
      meta: { ...dto, channel },
    });

    return updated;
  }

  async upsertItem(principal: Principal, orderSetId: string, dto: UpsertOrderSetItemDto) {
    const os = await this.ensureOrderSet(principal, orderSetId);

    const svc = await this.ctx.prisma.serviceItem.findFirst({
      where: { id: dto.serviceItemId, branchId: os.branchId },
      select: { id: true },
    });
    if (!svc) throw new BadRequestException("Invalid serviceItemId for branch");

    const existing = await this.ctx.prisma.orderSetItem.findFirst({
      where: {
        orderSetId: os.id,
        itemType: "SERVICE_ITEM" as any,
        serviceItemId: dto.serviceItemId,
        isActive: true,
      },
      select: { id: true },
    });

    const item = existing
      ? await this.ctx.prisma.orderSetItem.update({
          where: { id: existing.id },
          data: { sortOrder: dto.sortOrder ?? undefined, isActive: true } as any,
        })
      : await this.ctx.prisma.orderSetItem.create({
          data: {
            orderSetId: os.id,
            itemType: "SERVICE_ITEM" as any,
            serviceItemId: dto.serviceItemId,
            quantity: 1,
            sortOrder: dto.sortOrder ?? 0,
            isActive: true,
          } as any,
        });

    await this.ctx.audit.log({
      branchId: os.branchId,
      actorUserId: principal.userId,
      action: "INFRA_ORDER_SET_ITEM_UPSERT",
      entity: "OrderSet",
      entityId: os.id,
      meta: { serviceItemId: dto.serviceItemId, sortOrder: dto.sortOrder ?? 0 },
    });

    return item;
  }

  async removeItem(principal: Principal, orderSetId: string, serviceItemId: string) {
    const os = await this.ensureOrderSet(principal, orderSetId);

    await this.ctx.prisma.orderSetItem.updateMany({
      where: { orderSetId: os.id, itemType: "SERVICE_ITEM" as any, serviceItemId },
      data: { isActive: false },
    });

    await this.ctx.audit.log({
      branchId: os.branchId,
      actorUserId: principal.userId,
      action: "INFRA_ORDER_SET_ITEM_REMOVE",
      entity: "OrderSet",
      entityId: os.id,
      meta: { serviceItemId },
    });

    return { ok: true };
  }

  async submit(principal: Principal, id: string, note?: string) {
    const os = await this.ensureOrderSet(principal, id);
    const updated = await this.ctx.prisma.orderSet.update({
      where: { id: os.id },
      data: { status: "IN_REVIEW" as any },
    });

    await this.ctx.audit.log({
      branchId: os.branchId,
      actorUserId: principal.userId,
      action: "INFRA_ORDER_SET_SUBMIT",
      entity: "OrderSet",
      entityId: os.id,
      meta: { note },
    });

    return updated;
  }

  async approve(principal: Principal, id: string, note?: string) {
    const os = await this.ensureOrderSet(principal, id);
    const updated = await this.ctx.prisma.orderSet.update({
      where: { id: os.id },
      data: { status: "APPROVED" as any },
    });

    await this.ctx.audit.log({
      branchId: os.branchId,
      actorUserId: principal.userId,
      action: "INFRA_ORDER_SET_APPROVE",
      entity: "OrderSet",
      entityId: os.id,
      meta: { note },
    });

    return updated;
  }

  async publish(principal: Principal, id: string, note?: string) {
    const os = await this.ensureOrderSet(principal, id);

    const full = await this.ctx.prisma.orderSet.findUnique({
      where: { id: os.id },
      include: {
        items: {
          orderBy: [{ sortOrder: "asc" }],
          include: { serviceItem: true, diagnosticItem: true, pkg: true },
        },
      },
    });
    if (!full) throw new NotFoundException("Order set not found");

    const nextVersion = ((full as any).version ?? 0) + 1;

    const updated = await this.ctx.prisma.orderSet.update({
      where: { id: os.id },
      data: {
        status: "PUBLISHED" as any,
        version: nextVersion as any,
        effectiveFrom: (full as any).effectiveFrom ?? new Date(),
        effectiveTo: null,
      } as any,
    });

    await this.ctx.prisma.orderSetVersion.create({
      data: {
        orderSetId: os.id,
        version: nextVersion as any,
        status: "PUBLISHED" as any,
        snapshot: full as any,
        effectiveFrom: new Date(),
        effectiveTo: null,
      } as any,
    });

    await this.ctx.audit.log({
      branchId: os.branchId,
      actorUserId: principal.userId,
      action: "INFRA_ORDER_SET_PUBLISH",
      entity: "OrderSet",
      entityId: os.id,
      meta: { version: nextVersion, note },
    });

    return updated;
  }

  async retire(principal: Principal, id: string, note?: string) {
    const os = await this.ensureOrderSet(principal, id);

    const updated = await this.ctx.prisma.orderSet.update({
      where: { id: os.id },
      data: { status: "RETIRED" as any, effectiveTo: new Date() } as any,
    });

    await this.ctx.audit.log({
      branchId: os.branchId,
      actorUserId: principal.userId,
      action: "INFRA_ORDER_SET_RETIRE",
      entity: "OrderSet",
      entityId: os.id,
      meta: { note },
    });

    return updated;
  }

  async versions(principal: Principal, id: string) {
    const os = await this.ensureOrderSet(principal, id);
    return this.ctx.prisma.orderSetVersion.findMany({
      where: { orderSetId: os.id },
      orderBy: [{ version: "desc" }],
    });
  }
}
