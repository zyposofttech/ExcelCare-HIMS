import { Body, Controller, Get, Param, Put, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { SetBranchUnitTypesDto } from "./dto";
import { UnitTypesService } from "./unit-types.service";

@ApiTags("infrastructure/unit-types")
@Controller(["infrastructure", "infra"])
export class UnitTypesController {
  constructor(private readonly svc: UnitTypesService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("unit-types/catalog")
  @Permissions(PERM.INFRA_UNITTYPE_READ)
  async unitTypeCatalog(@Req() req: any) {
    return this.svc.listUnitTypeCatalog(this.principal(req));
  }

  @Get("branches/:branchId/unit-types")
  @Permissions(PERM.INFRA_UNITTYPE_READ)
  async getBranchUnitTypes(@Req() req: any, @Param("branchId") branchId: string) {
    return this.svc.getBranchUnitTypes(this.principal(req), branchId);
  }

  @Put("branches/:branchId/unit-types")
  @Permissions(PERM.INFRA_UNITTYPE_UPDATE)
  async setBranchUnitTypes(@Req() req: any, @Param("branchId") branchId: string, @Body() dto: SetBranchUnitTypesDto) {
    return this.svc.setBranchUnitTypes(this.principal(req), dto.unitTypeIds, branchId);
  }
}
