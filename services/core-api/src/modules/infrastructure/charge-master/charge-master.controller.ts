import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreateChargeMasterItemDto, UpdateChargeMasterItemDto } from "./dto";
import { ChargeMasterService } from "./charge-master.service";

@ApiTags("infrastructure/charge-master")
@Controller(["infrastructure", "infra"])
export class ChargeMasterController {
  constructor(private readonly svc: ChargeMasterService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Post("charge-master")
  @Permissions(PERM.INFRA_CHARGE_MASTER_CREATE)
  async createChargeMaster(
    @Req() req: any,
    @Body() dto: CreateChargeMasterItemDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.createChargeMasterItem(this.principal(req), dto, branchId ?? null);
  }

  @Get("charge-master")
  @Permissions(PERM.INFRA_CHARGE_MASTER_READ)
  async listChargeMaster(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("q") q?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("take") take?: string,
  ) {
    return this.svc.listChargeMasterItems(this.principal(req), {
      branchId: branchId ?? null,
      q,
      includeInactive: includeInactive === "true",
      take: take ? Number(take) : undefined,
    });
  }

  @Get("charge-master/:id")
  @Permissions(PERM.INFRA_CHARGE_MASTER_READ)
  async getChargeMaster(@Req() req: any, @Param("id") id: string) {
    return this.svc.getChargeMasterItem(this.principal(req), id);
  }

  @Patch("charge-master/:id")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  async updateChargeMaster(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateChargeMasterItemDto) {
    return this.svc.updateChargeMasterItem(this.principal(req), id, dto);
  }
}
