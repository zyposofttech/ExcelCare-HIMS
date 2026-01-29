import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { ServiceAvailabilityService } from "./service-availability.service";
import { CreateAvailabilityRuleDto, UpdateAvailabilityRuleDto, UpsertServiceAvailabilityCalendarDto } from "./dto";

@ApiTags("infrastructure/service-availability")
@Controller(["infrastructure", "infra"])
export class ServiceAvailabilityController {
  constructor(private readonly svc: ServiceAvailabilityService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("service-availability")
  @Permissions(PERM.INFRA_SERVICE_AVAILABILITY_READ)
  list(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("serviceItemId") serviceItemId?: string,
  ) {
    return this.svc.list(this.principal(req), { branchId: branchId ?? null, serviceItemId: serviceItemId ?? null });
  }

  @Post("service-availability")
  @Permissions(PERM.INFRA_SERVICE_AVAILABILITY_UPDATE)
  upsertCalendar(
    @Req() req: any,
    @Body() dto: UpsertServiceAvailabilityCalendarDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.upsertCalendar(this.principal(req), dto, branchId ?? null);
  }

  @Post("service-availability/:calendarId/rules")
  @Permissions(PERM.INFRA_SERVICE_AVAILABILITY_UPDATE)
  addRule(@Req() req: any, @Param("calendarId") calendarId: string, @Body() dto: CreateAvailabilityRuleDto) {
    return this.svc.addRule(this.principal(req), calendarId, dto);
  }

  @Patch("service-availability/rules/:ruleId")
  @Permissions(PERM.INFRA_SERVICE_AVAILABILITY_UPDATE)
  updateRule(@Req() req: any, @Param("ruleId") ruleId: string, @Body() dto: UpdateAvailabilityRuleDto) {
    return this.svc.updateRule(this.principal(req), ruleId, dto);
  }

  @Post("service-availability/rules/:ruleId/deactivate")
  @Permissions(PERM.INFRA_SERVICE_AVAILABILITY_UPDATE)
  deactivateRule(@Req() req: any, @Param("ruleId") ruleId: string) {
    return this.svc.deactivateRule(this.principal(req), ruleId);
  }
}
