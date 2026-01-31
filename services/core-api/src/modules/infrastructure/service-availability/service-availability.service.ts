import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import {
  CreateServiceAvailabilityCalendarDto,
  UpdateServiceAvailabilityCalendarDto,
  CreateServiceAvailabilityRuleDto,
  UpdateServiceAvailabilityRuleDto,
  CreateServiceBlackoutDto,
  UpdateServiceBlackoutDto,
} from "./dto";

@Injectable()
export class ServiceAvailabilityService {
  constructor(private readonly ctx: InfraContextService) {}

  // ---------- Helpers

  private parseIso(input: string, label: string) {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`Invalid ${label}`);
    return d;
  }

  private validateRule(startMinute: number, endMinute: number) {
    if (endMinute <= startMinute) throw new BadRequestException("endMinute must be > startMinute");
    if (startMinute < 0 || startMinute > 1439) throw new BadRequestException("startMinute out of range");
    if (endMinute < 1 || endMinute > 1440) throw new BadRequestException("endMinute out of range");
  }

  private async assertCalendarScoped(principal: Principal, calendarId: string) {
    const cal = await this.ctx.prisma.serviceAvailabilityCalendar.findUnique({
      where: { id: calendarId },
      select: { id: true, branchId: true, serviceItemId: true, isActive: true },
    });
    if (!cal) throw new NotFoundException("Availability calendar not found");
    this.ctx.resolveBranchId(principal, cal.branchId);
    return cal;
  }

  private async assertServiceItemScoped(principal: Principal, serviceItemId: string, branchIdParam?: string | null) {
    const svc = await this.ctx.prisma.serviceItem.findUnique({
      where: { id: serviceItemId },
      select: { id: true, branchId: true, requiresAppointment: true },
    });
    if (!svc) throw new BadRequestException("Invalid serviceItemId");

    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? svc.branchId);
    if (svc.branchId !== branchId) throw new BadRequestException("serviceItemId does not belong to branchId");
    return { svc, branchId };
  }

  // ---------- Calendars

  async listCalendars(
    principal: Principal,
    opts: { branchId: string | null; serviceItemId?: string; includeRules?: boolean; includeBlackouts?: boolean },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, opts.branchId ?? null);

    const where: any = { branchId };
    if (opts.serviceItemId) where.serviceItemId = opts.serviceItemId;

    return this.ctx.prisma.serviceAvailabilityCalendar.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      include:
        opts.includeRules || opts.includeBlackouts
          ? {
              rules: opts.includeRules ? { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] } : false,
              blackouts: opts.includeBlackouts ? { orderBy: [{ from: "asc" }] } : false,
            }
          : undefined,
    });
  }

  async createCalendar(principal: Principal, dto: CreateServiceAvailabilityCalendarDto, branchIdParam?: string | null) {
    const { branchId } = await this.assertServiceItemScoped(principal, dto.serviceItemId, branchIdParam);

    const name = String(dto.name ?? "").trim();
    if (!name) throw new BadRequestException("name is required");

    const isActive = dto.isActive ?? true;

    // enforce single active calendar per service item
    if (isActive) {
      await this.ctx.prisma.serviceAvailabilityCalendar.updateMany({
        where: { branchId, serviceItemId: dto.serviceItemId, isActive: true },
        data: { isActive: false },
      });
    }

    const created = await this.ctx.prisma.serviceAvailabilityCalendar.create({
      data: {
        branchId,
        serviceItemId: dto.serviceItemId,
        name,
        isActive,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_SCHED_CREATE",
      entity: "ServiceAvailabilityCalendar",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async updateCalendar(principal: Principal, id: string, dto: UpdateServiceAvailabilityCalendarDto) {
    const cal = await this.assertCalendarScoped(principal, id);

    const patch: any = {};
    if (dto.name !== undefined) {
      const name = String(dto.name ?? "").trim();
      if (!name) throw new BadRequestException("name cannot be empty");
      patch.name = name;
    }

    if (dto.isActive !== undefined) {
      patch.isActive = dto.isActive;

      if (dto.isActive === true) {
        // single active per service item
        await this.ctx.prisma.serviceAvailabilityCalendar.updateMany({
          where: { branchId: cal.branchId, serviceItemId: cal.serviceItemId, isActive: true, NOT: { id } },
          data: { isActive: false },
        });
      }
    }

    const updated = await this.ctx.prisma.serviceAvailabilityCalendar.update({ where: { id }, data: patch });

    await this.ctx.audit.log({
      branchId: cal.branchId,
      actorUserId: principal.userId,
      action: "INFRA_SCHED_CREATE",
      entity: "ServiceAvailabilityCalendar",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  async deactivateCalendar(principal: Principal, id: string) {
    const cal = await this.assertCalendarScoped(principal, id);

    const updated = await this.ctx.prisma.serviceAvailabilityCalendar.update({
      where: { id },
      data: { isActive: false },
    });

    await this.ctx.audit.log({
      branchId: cal.branchId,
      actorUserId: principal.userId,
      action: "INFRA_SCHED_CREATE",
      entity: "ServiceAvailabilityCalendar",
      entityId: id,
      meta: { isActive: false },
    });

    return updated;
  }

  async bootstrapDefault(principal: Principal, serviceItemId: string, branchIdParam?: string | null) {
    const { branchId } = await this.assertServiceItemScoped(principal, serviceItemId, branchIdParam);

    // deactivate any active
    await this.ctx.prisma.serviceAvailabilityCalendar.updateMany({
      where: { branchId, serviceItemId, isActive: true },
      data: { isActive: false },
    });

    const cal = await this.ctx.prisma.serviceAvailabilityCalendar.create({
      data: { branchId, serviceItemId, name: "Default Availability", isActive: true },
    });

    // Mon-Sat 09:00-17:00 capacity 1
    const rules = [1, 2, 3, 4, 5, 6].map((dow) => ({
      calendarId: cal.id,
      dayOfWeek: dow,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
      capacity: 1,
      isActive: true,
    }));

    await this.ctx.prisma.serviceAvailabilityRule.createMany({ data: rules });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_SCHED_CREATE",
      entity: "ServiceAvailabilityCalendar",
      entityId: cal.id,
      meta: { bootstrap: true },
    });

    return this.ctx.prisma.serviceAvailabilityCalendar.findUnique({
      where: { id: cal.id },
      include: { rules: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] }, blackouts: true },
    });
  }

  // ---------- Rules

  async listRules(principal: Principal, calendarId: string) {
    await this.assertCalendarScoped(principal, calendarId);

    return this.ctx.prisma.serviceAvailabilityRule.findMany({
      where: { calendarId },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
    });
  }

  async createRule(principal: Principal, calendarId: string, dto: CreateServiceAvailabilityRuleDto) {
    const cal = await this.assertCalendarScoped(principal, calendarId);

    const startMinute = dto.startMinute;
    const endMinute = dto.endMinute;
    this.validateRule(startMinute, endMinute);

    // enforce no overlaps within same day on active rules
    const overlap = await this.ctx.prisma.serviceAvailabilityRule.findFirst({
      where: {
        calendarId,
        dayOfWeek: dto.dayOfWeek,
        isActive: true,
        startMinute: { lt: endMinute },
        endMinute: { gt: startMinute },
      },
      select: { id: true },
    });
    if (overlap) throw new ConflictException("Overlapping availability rule exists for this day");

    const created = await this.ctx.prisma.serviceAvailabilityRule.create({
      data: {
        calendarId,
        dayOfWeek: dto.dayOfWeek,
        startMinute,
        endMinute,
        capacity: dto.capacity ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.ctx.audit.log({
      branchId: cal.branchId,
      actorUserId: principal.userId,
      action: "INFRA_SCHED_CREATE",
      entity: "ServiceAvailabilityRule",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async updateRule(principal: Principal, ruleId: string, dto: UpdateServiceAvailabilityRuleDto) {
    const existing = await this.ctx.prisma.serviceAvailabilityRule.findUnique({
      where: { id: ruleId },
      select: { id: true, calendarId: true, dayOfWeek: true, startMinute: true, endMinute: true, calendar: { select: { branchId: true } } },
    });
    if (!existing) throw new NotFoundException("Availability rule not found");

    this.ctx.resolveBranchId(principal, existing.calendar.branchId);

    const dayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const startMinute = dto.startMinute ?? existing.startMinute;
    const endMinute = dto.endMinute ?? existing.endMinute;
    this.validateRule(startMinute, endMinute);

    const overlap = await this.ctx.prisma.serviceAvailabilityRule.findFirst({
      where: {
        calendarId: existing.calendarId,
        dayOfWeek,
        isActive: true,
        startMinute: { lt: endMinute },
        endMinute: { gt: startMinute },
        NOT: { id: ruleId },
      },
      select: { id: true },
    });
    if (overlap) throw new ConflictException("Overlapping availability rule exists for this day");

    const updated = await this.ctx.prisma.serviceAvailabilityRule.update({
      where: { id: ruleId },
      data: {
        dayOfWeek: dto.dayOfWeek,
        startMinute: dto.startMinute,
        endMinute: dto.endMinute,
        capacity: dto.capacity,
        isActive: dto.isActive,
      },
    });

    await this.ctx.audit.log({
      branchId: existing.calendar.branchId,
      actorUserId: principal.userId,
      action: "INFRA_SCHED_CREATE",
      entity: "ServiceAvailabilityRule",
      entityId: ruleId,
      meta: dto,
    });

    return updated;
  }

  async deactivateRule(principal: Principal, ruleId: string) {
    const existing = await this.ctx.prisma.serviceAvailabilityRule.findUnique({
      where: { id: ruleId },
      select: { id: true, calendar: { select: { branchId: true } } },
    });
    if (!existing) throw new NotFoundException("Availability rule not found");

    this.ctx.resolveBranchId(principal, existing.calendar.branchId);

    return this.ctx.prisma.serviceAvailabilityRule.update({ where: { id: ruleId }, data: { isActive: false } });
  }

  // ---------- Blackouts

  async listBlackouts(principal: Principal, calendarId: string) {
    await this.assertCalendarScoped(principal, calendarId);

    return this.ctx.prisma.serviceBlackout.findMany({
      where: { calendarId },
      orderBy: [{ from: "asc" }],
    });
  }

  async createBlackout(principal: Principal, calendarId: string, dto: CreateServiceBlackoutDto) {
    const cal = await this.assertCalendarScoped(principal, calendarId);

    const from = this.parseIso(dto.from, "from");
    const to = this.parseIso(dto.to, "to");
    if (to <= from) throw new BadRequestException("to must be after from");

    const created = await this.ctx.prisma.serviceBlackout.create({
      data: {
        calendarId,
        from,
        to,
        reason: dto.reason ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId: cal.branchId,
      actorUserId: principal.userId,
      action: "INFRA_SCHED_CREATE",
      entity: "ServiceBlackout",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async updateBlackout(principal: Principal, blackoutId: string, dto: UpdateServiceBlackoutDto) {
    const existing = await this.ctx.prisma.serviceBlackout.findUnique({
      where: { id: blackoutId },
      select: { id: true, calendarId: true, from: true, to: true, calendar: { select: { branchId: true } } },
    });
    if (!existing) throw new NotFoundException("Blackout not found");
    this.ctx.resolveBranchId(principal, existing.calendar.branchId);

    const from = dto.from ? this.parseIso(dto.from, "from") : existing.from;
    const to = dto.to ? this.parseIso(dto.to, "to") : existing.to;
    if (to <= from) throw new BadRequestException("to must be after from");

    return this.ctx.prisma.serviceBlackout.update({
      where: { id: blackoutId },
      data: {
        from: dto.from ? from : undefined,
        to: dto.to ? to : undefined,
        reason: dto.reason === undefined ? undefined : (dto.reason ?? null),
      },
    });
  }

  async deleteBlackout(principal: Principal, blackoutId: string) {
    const existing = await this.ctx.prisma.serviceBlackout.findUnique({
      where: { id: blackoutId },
      select: { id: true, calendar: { select: { branchId: true } } },
    });
    if (!existing) throw new NotFoundException("Blackout not found");
    this.ctx.resolveBranchId(principal, existing.calendar.branchId);

    return this.ctx.prisma.serviceBlackout.delete({ where: { id: blackoutId } });
  }

  // ---------- Computed Slots (for UI preview + future booking engine)

  /**
   * Computes availability slots from active calendar rules minus blackouts.
   * tzOffsetMins: minutes offset from UTC (India=330). Default=330.
   */
  async computeSlots(
    principal: Principal,
    opts: {
      branchId: string | null;
      serviceItemId: string;
      from: string;
      to: string;
      slotMins?: number;
      tzOffsetMins?: number;
    },
  ) {
    const { branchId } = await this.assertServiceItemScoped(principal, opts.serviceItemId, opts.branchId ?? null);

    const slotMins = Math.min(Math.max(opts.slotMins ?? 15, 5), 240);
    const tzOffsetMins = opts.tzOffsetMins ?? 330;
    const offsetMs = tzOffsetMins * 60 * 1000;

    const fromUtc = this.parseIso(opts.from, "from");
    const toUtc = this.parseIso(opts.to, "to");
    if (toUtc <= fromUtc) throw new BadRequestException("to must be after from");

    const calendars = await this.ctx.prisma.serviceAvailabilityCalendar.findMany({
      where: { branchId, serviceItemId: opts.serviceItemId, isActive: true },
      include: {
        rules: { where: { isActive: true }, orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] },
        blackouts: { orderBy: [{ from: "asc" }] },
      },
    });

    if (!calendars.length) return { slots: [], meta: { calendars: 0 } };

    // merge rules/blackouts across active calendars (normally 1 active)
    const rules = calendars.flatMap((c) => c.rules);
    const blackouts = calendars.flatMap((c) => c.blackouts);

    const startOfLocalDayUtc = (utcDate: Date) => {
      const local = new Date(utcDate.getTime() + offsetMs);
      const y = local.getUTCFullYear();
      const m = local.getUTCMonth();
      const d = local.getUTCDate();
      return new Date(Date.UTC(y, m, d, 0, 0, 0) - offsetMs);
    };

    let dayStart = startOfLocalDayUtc(fromUtc);
    const slots: Array<{ start: string; end: string; capacity: number }> = [];

    while (dayStart < toUtc) {
      const dayLocal = new Date(dayStart.getTime() + offsetMs);
      const dow = dayLocal.getUTCDay();

      const dayRules = rules.filter((r) => r.dayOfWeek === dow);

      for (const r of dayRules) {
        const ruleStart = new Date(dayStart.getTime() + r.startMinute * 60 * 1000);
        const ruleEnd = new Date(dayStart.getTime() + r.endMinute * 60 * 1000);

        for (
          let t = ruleStart.getTime();
          t + slotMins * 60 * 1000 <= ruleEnd.getTime();
          t += slotMins * 60 * 1000
        ) {
          const s = new Date(t);
          const e = new Date(t + slotMins * 60 * 1000);

          // clip to requested window
          if (e <= fromUtc || s >= toUtc) continue;

          // blackout check (overlap)
          const blocked = blackouts.some((b) => s < b.to && e > b.from);
          if (blocked) continue;

          slots.push({ start: s.toISOString(), end: e.toISOString(), capacity: r.capacity ?? 0 });
        }
      }

      dayStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    }

    return { slots, meta: { calendars: calendars.length, slotMins, tzOffsetMins } };
  }
}
