import { Body, Controller, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { ValidateImportDto } from "./dto";
import { ImportService } from "./import.service";

@ApiTags("infrastructure/import")
@Controller(["infrastructure", "infra"])
export class ImportController {
  constructor(private readonly svc: ImportService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Post("import/validate")
  @Permissions(PERM.INFRA_IMPORT_VALIDATE)
  async validateImport(@Req() req: any, @Body() dto: ValidateImportDto, @Query("branchId") branchId?: string) {
    return this.svc.validateImport(this.principal(req), dto, branchId ?? null);
  }

  @Post("import/commit")
  @Permissions(PERM.INFRA_IMPORT_COMMIT)
  async commitImport(@Req() req: any, @Query("jobId") jobId: string) {
    return this.svc.commitImport(this.principal(req), jobId);
  }
}
