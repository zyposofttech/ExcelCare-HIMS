import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import {
  CreateServiceAvailabilityCalendarDto,
  UpdateServiceAvailabilityCalendarDto,
  CreateServiceAvailabilityRuleDto,
  UpdateServiceAvailabilityRuleDto,
  CreateServiceBlackoutDto,
  UpdateServiceBlackoutDto,
} from "./dto";
import { ServiceAvailabilityService } from "./service-availability.service";

@ApiTags("infrastructure/service-availability")
@Controller(["infrastructure", "infra"])
export class ServiceAvailabilityController {
  constructor(private readonly svc: ServiceAvailabilityService) {}

  private principal(req: any) {
    return req.principal;
  }

  // ---------- Calendars

  @Get("service-availability/calendars")
  @Permissions(PERM.INFRA_SCHED_READ)
  listCalendars(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("serviceItemId") serviceItemId?: string,
    @Query("includeRules") includeRules?: string,
    @Query("includeBlackouts") includeBlackouts?: string,
  ) {
    return this.svc.listCalendars(this.principal(req), {
      branchId: branchId ?? null,
      serviceItemId,
      includeRules: includeRules === "true",
      includeBlackouts: includeBlackouts === "true",
    });
  }

  @Post("service-availability/calendars")
  @Permissions(PERM.INFRA_SCHED_CREATE)
  createCalendar(
    @Req() req: any,
    @Body() dto: CreateServiceAvailabilityCalendarDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.createCalendar(this.principal(req), dto, branchId ?? null);
  }

  @Patch("service-availability/calendars/:id")
  @Permissions(PERM.INFRA_SCHED_CREATE)
  updateCalendar(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateServiceAvailabilityCalendarDto) {
    return this.svc.updateCalendar(this.principal(req), id, dto);
  }

  @Delete("service-availability/calendars/:id")
  @Permissions(PERM.INFRA_SCHED_CREATE)
  deactivateCalendar(@Req() req: any, @Param("id") id: string) {
    return this.svc.deactivateCalendar(this.principal(req), id);
  }

  @Post("service-availability/bootstrap")
  @Permissions(PERM.INFRA_SCHED_CREATE)
  bootstrap(@Req() req: any, @Query("serviceItemId") serviceItemId: string, @Query("branchId") branchId?: string) {
    return this.svc.bootstrapDefault(this.principal(req), serviceItemId, branchId ?? null);
  }

  // ---------- Rules

  @Get("service-availability/calendars/:calendarId/rules")
  @Permissions(PERM.INFRA_SCHED_READ)
  listRules(@Req() req: any, @Param("calendarId") calendarId: string) {
    return this.svc.listRules(this.principal(req), calendarId);
  }

  @Post("service-availability/calendars/:calendarId/rules")
  @Permissions(PERM.INFRA_SCHED_CREATE)
  createRule(
    @Req() req: any,
    @Param("calendarId") calendarId: string,
    @Body() dto: CreateServiceAvailabilityRuleDto,
  ) {
    return this.svc.createRule(this.principal(req), calendarId, dto);
  }

  @Patch("service-availability/rules/:ruleId")
  @Permissions(PERM.INFRA_SCHED_CREATE)
  updateRule(@Req() req: any, @Param("ruleId") ruleId: string, @Body() dto: UpdateServiceAvailabilityRuleDto) {
    return this.svc.updateRule(this.principal(req), ruleId, dto);
  }

  @Delete("service-availability/rules/:ruleId")
  @Permissions(PERM.INFRA_SCHED_CREATE)
  deactivateRule(@Req() req: any, @Param("ruleId") ruleId: string) {
    return this.svc.deactivateRule(this.principal(req), ruleId);
  }

  // ---------- Blackouts

  @Get("service-availability/calendars/:calendarId/blackouts")
  @Permissions(PERM.INFRA_SCHED_READ)
  listBlackouts(@Req() req: any, @Param("calendarId") calendarId: string) {
    return this.svc.listBlackouts(this.principal(req), calendarId);
  }

  @Post("service-availability/calendars/:calendarId/blackouts")
  @Permissions(PERM.INFRA_SCHED_CREATE)
  createBlackout(
    @Req() req: any,
    @Param("calendarId") calendarId: string,
    @Body() dto: CreateServiceBlackoutDto,
  ) {
    return this.svc.createBlackout(this.principal(req), calendarId, dto);
  }

  @Patch("service-availability/blackouts/:blackoutId")
  @Permissions(PERM.INFRA_SCHED_CREATE)
  updateBlackout(@Req() req: any, @Param("blackoutId") blackoutId: string, @Body() dto: UpdateServiceBlackoutDto) {
    return this.svc.updateBlackout(this.principal(req), blackoutId, dto);
  }

  @Delete("service-availability/blackouts/:blackoutId")
  @Permissions(PERM.INFRA_SCHED_CREATE)
  deleteBlackout(@Req() req: any, @Param("blackoutId") blackoutId: string) {
    return this.svc.deleteBlackout(this.principal(req), blackoutId);
  }

  // ---------- Computed Slots (preview)

  @Get("service-availability/slots")
  @Permissions(PERM.INFRA_SCHED_READ)
  slots(
    @Req() req: any,
    @Query("branchId") branchId: string,
    @Query("serviceItemId") serviceItemId: string,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("slotMins") slotMins?: string,
    @Query("tzOffsetMins") tzOffsetMins?: string,
  ) {
    return this.svc.computeSlots(this.principal(req), {
      branchId: branchId ?? null,
      serviceItemId,
      from,
      to,
      slotMins: slotMins ? Number(slotMins) : undefined,
      tzOffsetMins: tzOffsetMins ? Number(tzOffsetMins) : undefined,
    });
  }
}
