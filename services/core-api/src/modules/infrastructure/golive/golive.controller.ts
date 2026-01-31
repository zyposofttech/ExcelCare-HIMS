import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { RunGoLiveDto } from "./dto";
import { GoLiveService } from "./golive.service";

@ApiTags("infrastructure/golive")
@Controller(["infrastructure", "infra"])
export class GoLiveController {
  constructor(private readonly svc: GoLiveService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("branch/go-live")
  @Permissions(PERM.INFRA_GOLIVE_READ)
  async goLivePreview(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.svc.runGoLive(this.principal(req), { persist: false }, branchId ?? null);
  }

  // Backward-compatible route for UI: /infra/golive/checks?branchId=...
  @Get("golive/checks")
  @Permissions(PERM.INFRA_GOLIVE_READ)
  async goLiveChecks(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.svc.runGoLive(this.principal(req), { persist: false }, branchId ?? null);
  }

  @Post("branch/go-live")
  @Permissions(PERM.INFRA_GOLIVE_RUN)
  async goLiveRun(@Req() req: any, @Body() dto: RunGoLiveDto, @Query("branchId") branchId?: string) {
    return this.svc.runGoLive(this.principal(req), dto, branchId ?? null);
  }
}
