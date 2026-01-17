import { Body, Controller, Get, Param, Patch, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { UpdateFixItDto } from "./dto";
import { FixItService } from "./fixit.service";

@ApiTags("infrastructure/fixit")
@Controller(["infrastructure", "infra"])
export class FixItController {
  constructor(private readonly svc: FixItService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("fixit")
  @Permissions(PERM.INFRA_FIXIT_READ)
  async listFixIts(@Req() req: any, @Query("branchId") branchId?: string, @Query("status") status?: string) {
    return this.svc.listFixIts(this.principal(req), { branchId: branchId ?? null, status });
  }

  @Patch("fixit/:id")
  @Permissions(PERM.INFRA_FIXIT_UPDATE)
  async updateFixIt(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateFixItDto) {
    return this.svc.updateFixIt(this.principal(req), id, dto);
  }
}
