import { Body, Controller, Get, Param, Put, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { UpdateBranchInfraConfigDto } from "./dto";
import { BranchConfigService } from "./branch-config.service";

@ApiTags("infrastructure/branch-config")
@Controller(["infrastructure", "infra"])
export class BranchConfigController {
  constructor(private readonly svc: BranchConfigService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("branches/:branchId/infra-config")
  @Permissions(PERM.INFRA_GOLIVE_READ)
  async getBranchInfraConfig(@Req() req: any, @Param("branchId") branchId: string) {
    return this.svc.getBranchInfraConfig(this.principal(req), branchId);
  }

  @Put("branches/:branchId/infra-config")
  @Permissions(PERM.INFRA_GOLIVE_RUN)
  async updateBranchInfraConfig(
    @Req() req: any,
    @Param("branchId") branchId: string,
    @Body() dto: UpdateBranchInfraConfigDto,
  ) {
    return this.svc.updateBranchInfraConfig(this.principal(req), branchId, dto);
  }
}
