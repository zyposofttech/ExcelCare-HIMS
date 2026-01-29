import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreateAvailabilityRuleDto, UpdateAvailabilityRuleDto, UpsertServiceAvailabilityCalendarDto } from "./dto";

@Injectable()
export class ServiceAvailabilityService {
  constructor(private readonly ctx: InfraContextService) {}

  private async resolveAvailabilityFixIt(branchId: string, serviceItemId: string) {
    await this.ctx.prisma.fixItTask.updateMany({
      where: {
        branchId,
        type: "SERVICE_AVAILABILITY_MISSING" as any,
        status: { in: ["OPEN", "IN_PROGRESS"] as any },
        entityType: "SERVICE_ITEM" as any,
        entityId: serviceItemId,
      } as any,
      data: { status: "RESOLVED" as any, resolvedAt: new Date() } as any,
    });
  }

  async list(principal: Principal, q: { branchId?: string | null; serviceItemId?: string | null }) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);

    const where: any = { branchId };
    if (q.serviceItemId) where.serviceItemId = q.serviceItemId;

    return this.ctx.prisma.serviceAvailabilityCalendar.findMany({
      where,
      include: { rules: { where: { isActive: true } as any, orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] } },
      orderBy: [{ updatedAt: "desc" }],
    });
  }

  async upsertCalendar(principal: Principal, dto: UpsertServiceAvailabilityCalendarDto, branchIdParam?: string | null) {
    const svc = await this.ctx.prisma.serviceItem.findUnique({
      where: { id: dto.serviceItemId },
      select: { id: true, branchId: true, requiresAppointment: true },
    });
    if (!svc) throw new BadRequestException("Invalid serviceItemId");

    const branchId = this.ctx.resolveBranchId(principal, dto.branchId ?? branchIdParam ?? svc.branchId);

    const existing = await this.ctx.prisma.serviceAvailabilityCalendar.findFirst({
      where: { branchId, serviceItemId: dto.serviceItemId },
      select: { id: true },
    });

    const saved = existing
      ? await this.ctx.prisma.serviceAvailabilityCalendar.update({
          where: { id: existing.id },
          data: {
            isActive: dto.isActive ?? true,
            name: dto.name ?? undefined,
            timezone: dto.timezone ?? undefined,
          } as any,
        })
      : await this.ctx.prisma.serviceAvailabilityCalendar.create({
          data: {
            branchId,
            serviceItemId: dto.serviceItemId,
            isActive: dto.isActive ?? true,
            name: dto.name ?? null,
            timezone: dto.timezone ?? "Asia/Kolkata",
          } as any,
        });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_AVAILABILITY_CALENDAR_UPSERT",
      entity: "ServiceAvailabilityCalendar",
      entityId: saved.id,
      meta: dto,
    });

    return saved;
  }

  async addRule(principal: Principal, calendarId: string, dto: CreateAvailabilityRuleDto) {
    const cal = await this.ctx.prisma.serviceAvailabilityCalendar.findUnique({
      where: { id: calendarId },
      select: { id: true, branchId: true, serviceItemId: true },
    });
    if (!cal) throw new NotFoundException("Calendar not found");

    const branchId = this.ctx.resolveBranchId(principal, cal.branchId);

    if (dto.endMin <= dto.startMin) throw new BadRequestException("endMin must be > startMin");

    const created = await this.ctx.prisma.serviceAvailabilityRule.create({
      data: {
        calendarId: cal.id,
        dayOfWeek: dto.dayOfWeek as any,
        startMin: dto.startMin,
        endMin: dto.endMin,
        slotSizeMin: dto.slotSizeMin ?? 15,
        maxAppointmentsPerSlot: dto.maxAppointmentsPerSlot ?? 1,
        isActive: dto.isActive ?? true,
      } as any,
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_AVAILABILITY_RULE_CREATE",
      entity: "ServiceAvailabilityRule",
      entityId: created.id,
      meta: dto,
    });

    // If the service required appointment, creating at least one active rule resolves FixIt
    if (created.isActive) {
      await this.resolveAvailabilityFixIt(branchId, cal.serviceItemId);
    }

    return created;
  }

  async updateRule(principal: Principal, ruleId: string, dto: UpdateAvailabilityRuleDto) {
    const rule = await this.ctx.prisma.serviceAvailabilityRule.findUnique({
      where: { id: ruleId },
      select: { id: true, isActive: true, calendar: { select: { id: true, branchId: true, serviceItemId: true } } },
    });
    if (!rule) throw new NotFoundException("Rule not found");

    const branchId = this.ctx.resolveBranchId(principal, rule.calendar.branchId);

    const startMin = dto.startMin ?? undefined;
    const endMin = dto.endMin ?? undefined;

    // validate if both provided
    if (startMin !== undefined && endMin !== undefined && endMin <= startMin) {
      throw new BadRequestException("endMin must be > startMin");
    }

    const updated = await this.ctx.prisma.serviceAvailabilityRule.update({
      where: { id: ruleId },
      data: {
        startMin,
        endMin,
        slotSizeMin: dto.slotSizeMin ?? undefined,
        maxAppointmentsPerSlot: dto.maxAppointmentsPerSlot ?? undefined,
        isActive: dto.isActive ?? undefined,
      } as any,
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_SERVICE_AVAILABILITY_RULE_UPDATE",
      entity: "ServiceAvailabilityRule",
      entityId: updated.id,
      meta: dto,
    });

    // If rule activated, resolve FixIt
    if (dto.isActive === true) {
      await this.resolveAvailabilityFixIt(branchId, rule.calendar.serviceItemId);
    }

    return updated;
  }

  async deactivateRule(principal: Principal, ruleId: string) {
    return this.updateRule(principal, ruleId, { isActive: false });
  }
}
