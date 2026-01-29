import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { TaxCodesService } from "./tax-codes.service";
import { CreateTaxCodeDto, UpdateTaxCodeDto } from "./dto";

@ApiTags("infrastructure/tax-codes")
@Controller(["infrastructure", "infra"])
export class TaxCodesController {
  constructor(private readonly svc: TaxCodesService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("tax-codes")
  @Permissions(PERM.INFRA_TAX_CODE_READ)
  list(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("q") q?: string,
  ) {
    return this.svc.list(this.principal(req), {
      branchId: branchId ?? null,
      includeInactive: includeInactive === "true",
      search: q ?? "",
    });
  }

  @Get("tax-codes/:id")
  @Permissions(PERM.INFRA_TAX_CODE_READ)
  get(@Req() req: any, @Param("id") id: string) {
    return this.svc.get(this.principal(req), id);
  }

  @Post("tax-codes")
  @Permissions(PERM.INFRA_TAX_CODE_CREATE)
  create(@Req() req: any, @Body() dto: CreateTaxCodeDto, @Query("branchId") branchId?: string) {
    return this.svc.create(this.principal(req), dto, branchId ?? null);
  }

  @Patch("tax-codes/:id")
  @Permissions(PERM.INFRA_TAX_CODE_UPDATE)
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateTaxCodeDto) {
    return this.svc.update(this.principal(req), id, dto);
  }
}
