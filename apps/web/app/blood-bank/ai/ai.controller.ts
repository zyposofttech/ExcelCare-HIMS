import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { AiService } from "./ai.service";

@ApiTags("blood-bank/ai")
@Controller("blood-bank")
export class AiController {
  constructor(private readonly svc: AiService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("ai/insights")
  // NOTE: PERM.BB_AI_READ does not exist in the current IAM catalog.
  // For now, protect AI insights behind an existing read permission.
  @Permissions(PERM.BB_AUDIT_READ)
  insights(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.svc.insights(this.principal(req), branchId ?? null);
  }
}
