import { Body, Controller, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CloseServiceChargeMappingDto, UpsertServiceChargeMappingDto } from "./dto";
import { ServiceChargeMappingService } from "./service-charge-mapping.service";

@ApiTags("infrastructure/service-mapping")
@Controller(["infrastructure", "infra"])
export class ServiceChargeMappingController {
  constructor(private readonly svc: ServiceChargeMappingService) {}
  private principal(req: any) { return req.principal; }

  @Post("services/mapping")
  @Permissions(PERM.INFRA_SERVICE_MAPPING_UPDATE)
  async upsertMapping(@Req() req: any, @Body() dto: UpsertServiceChargeMappingDto) {
    return this.svc.upsertServiceChargeMapping(this.principal(req), dto);
  }

  @Post("service-charge-mappings")
  @Permissions(PERM.INFRA_SERVICE_MAPPING_UPDATE)
  async upsertMappingAlias(@Req() req: any, @Body() dto: UpsertServiceChargeMappingDto) {
    return this.svc.upsertServiceChargeMapping(this.principal(req), dto);
  }

  @Post("services/mapping/close")
  @Permissions(PERM.INFRA_SERVICE_MAPPING_UPDATE)
  async closeCurrentMapping(@Req() req: any, @Body() dto: CloseServiceChargeMappingDto) {
    return this.svc.closeCurrentMapping(this.principal(req), dto);
  }
}
