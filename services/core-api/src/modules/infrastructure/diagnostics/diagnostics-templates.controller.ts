import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { DiagnosticsTemplatesService } from "./diagnostics-templates.service";
import { ApplyTemplateDto, ListTemplatesQuery } from "./dto";
import type { Principal } from "./diagnostics.principal";

@ApiTags("infrastructure/diagnostics")
@Controller("infrastructure/diagnostics")
export class DiagnosticsTemplatesController {
  constructor(private readonly svc: DiagnosticsTemplatesService) {}

  private principalFrom(req: any): Principal {
    return (req?.principal ?? {}) as Principal;
  }

  @Get("templates")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  listTemplates(@Req() req: any, @Query() q: ListTemplatesQuery) {
    return this.svc.listTemplates(this.principalFrom(req), q);
  }

  @Post("templates/apply")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  applyTemplate(@Req() req: any, @Body() dto: ApplyTemplateDto) {
    return this.svc.applyTemplate(this.principalFrom(req), dto);
  }
}
