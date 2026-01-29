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
  create(@Req() req: any, @Body() dto: CreateChargeMasterItemDto, @Query("branchId") branchId?: string) {
    return this.svc.createChargeMasterItem(this.principal(req), dto, branchId ?? null);
  }

  @Get("charge-master")
  @Permissions(PERM.INFRA_CHARGE_MASTER_READ)
  list(@Req() req: any, @Query("branchId") branchId?: string, @Query("q") q?: string) {
    return this.svc.listChargeMasterItems(this.principal(req), { branchId: branchId ?? null, q });
  }

  @Get("charge-master/:id")
  @Permissions(PERM.INFRA_CHARGE_MASTER_READ)
  get(@Req() req: any, @Param("id") id: string) {
    return this.svc.getChargeMasterItem(this.principal(req), id);
  }

  @Patch("charge-master/:id")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateChargeMasterItemDto) {
    return this.svc.updateChargeMasterItem(this.principal(req), id, dto);
  }
}
