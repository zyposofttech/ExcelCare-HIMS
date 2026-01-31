import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
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
  @Permissions(PERM.INFRA_CHARGE_MASTER_READ)
  async list(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("q") q?: string,
    @Query("taxType") taxType?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("take") take?: string,
  ) {
    return this.svc.list(this.principal(req), {
      branchId: branchId ?? null,
      q,
      taxType,
      includeInactive: includeInactive === "true",
      take: take ? Number(take) : undefined,
    });
  }

  @Post("tax-codes")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  async create(@Req() req: any, @Body() dto: CreateTaxCodeDto, @Query("branchId") branchId?: string) {
    return this.svc.create(this.principal(req), dto, branchId ?? null);
  }

  @Get("tax-codes/:id")
  @Permissions(PERM.INFRA_CHARGE_MASTER_READ)
  async get(@Req() req: any, @Param("id") id: string) {
    return this.svc.get(this.principal(req), id);
  }

  @Patch("tax-codes/:id")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  async update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateTaxCodeDto) {
    return this.svc.update(this.principal(req), id, dto);
  }

  @Delete("tax-codes/:id")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  async deactivate(@Req() req: any, @Param("id") id: string) {
    return this.svc.deactivate(this.principal(req), id);
  }
}
