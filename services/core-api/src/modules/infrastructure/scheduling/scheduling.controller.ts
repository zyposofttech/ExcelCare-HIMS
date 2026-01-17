import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CancelProcedureBookingDto, CreateProcedureBookingDto } from "./dto";
import { SchedulingService } from "./scheduling.service";

@ApiTags("infrastructure/bookings")
@Controller(["infrastructure", "infra"])
export class SchedulingController {
  constructor(private readonly svc: SchedulingService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("bookings")
  @Permissions(PERM.INFRA_SCHED_READ)
  async listBookings(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("unitId") unitId?: string,
    @Query("resourceId") resourceId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.svc.listBookings(this.principal(req), { branchId: branchId ?? null, unitId, resourceId, from, to });
  }

  @Post("bookings")
  @Permissions(PERM.INFRA_SCHED_CREATE)
  async createBooking(@Req() req: any, @Body() dto: CreateProcedureBookingDto) {
    return this.svc.createBooking(this.principal(req), dto);
  }

  @Post("bookings/:id/cancel")
  @Permissions(PERM.INFRA_SCHED_CANCEL)
  async cancelBooking(@Req() req: any, @Param("id") id: string, @Body() dto: CancelProcedureBookingDto) {
    return this.svc.cancelBooking(this.principal(req), id, dto.reason);
  }
}
