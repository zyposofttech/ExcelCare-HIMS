import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DiagnosticsTemplatesService } from "./diagnostics-templates.service";
import { ApplyTemplateDto, ListTemplatesQuery } from "./dto";
import type { Principal } from "./diagnostics.principal";

@ApiTags("infrastructure/diagnostics")
@Controller("infrastructure/diagnostics")
export class DiagnosticsTemplatesController {
  constructor(private readonly svc: DiagnosticsTemplatesService) {}

  private principalFrom(req: any): Principal {
    return (req?.user ?? req?.principal ?? {}) as Principal;
  }

  @Get("templates")
  listTemplates(@Req() req: any, @Query() q: ListTemplatesQuery) {
    return this.svc.listTemplates(this.principalFrom(req), q);
  }

  @Post("templates/apply")
  applyTemplate(@Req() req: any, @Body() dto: ApplyTemplateDto) {
    return this.svc.applyTemplate(this.principalFrom(req), dto);
  }
}
