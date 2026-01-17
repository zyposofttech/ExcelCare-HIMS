import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreateChargeMasterItemDto } from "./dto";
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
  async listChargeMaster(@Req() req: any, @Query("branchId") branchId?: string, @Query("q") q?: string) {
    return this.svc.listChargeMasterItems(this.principal(req), { branchId: branchId ?? null, q });
  }
}
