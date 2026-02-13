import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreateGovSchemeDto, UpdateGovSchemeDto } from "./dto";
import { GovSchemeService } from "./gov-scheme.service";

@ApiTags("infrastructure/gov-schemes")
@Controller(["infrastructure", "infra"])
export class GovSchemeController {
  constructor(private readonly svc: GovSchemeService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Post("gov-schemes")
  @Permissions(PERM.INFRA_GOV_SCHEME_CREATE)
  async createScheme(
    @Req() req: any,
    @Body() dto: CreateGovSchemeDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.createScheme(this.principal(req), dto, branchId ?? null);
  }

  @Get("gov-schemes")
  @Permissions(PERM.INFRA_GOV_SCHEME_READ)
  async listSchemes(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("q") q?: string,
    @Query("schemeType") schemeType?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("take") take?: string,
  ) {
    return this.svc.listSchemes(this.principal(req), {
      branchId: branchId ?? null,
      q,
      schemeType,
      includeInactive: includeInactive === "true",
      take: take ? Number(take) : undefined,
    });
  }

  @Get("gov-schemes/:id")
  @Permissions(PERM.INFRA_GOV_SCHEME_READ)
  async getScheme(@Req() req: any, @Param("id") id: string) {
    return this.svc.getScheme(this.principal(req), id);
  }

  @Patch("gov-schemes/:id")
  @Permissions(PERM.INFRA_GOV_SCHEME_UPDATE)
  async updateScheme(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateGovSchemeDto) {
    return this.svc.updateScheme(this.principal(req), id, dto);
  }

  @Delete("gov-schemes/:id")
  @Permissions(PERM.INFRA_GOV_SCHEME_UPDATE)
  async deactivateScheme(@Req() req: any, @Param("id") id: string) {
    return this.svc.deactivateScheme(this.principal(req), id);
  }
}
