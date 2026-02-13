import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreatePayerDto, UpdatePayerDto } from "./dto";
import { PayerService } from "./payer.service";

@ApiTags("infrastructure/payers")
@Controller(["infrastructure", "infra"])
export class PayerController {
  constructor(private readonly svc: PayerService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Post("payers")
  @Permissions(PERM.INFRA_PAYER_CREATE)
  async createPayer(
    @Req() req: any,
    @Body() dto: CreatePayerDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.createPayer(this.principal(req), dto, branchId ?? null);
  }

  @Get("payers")
  @Permissions(PERM.INFRA_PAYER_READ)
  async listPayers(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("q") q?: string,
    @Query("kind") kind?: string,
    @Query("status") status?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("take") take?: string,
  ) {
    return this.svc.listPayers(this.principal(req), {
      branchId: branchId ?? null,
      q,
      kind,
      status,
      includeInactive: includeInactive === "true",
      take: take ? Number(take) : undefined,
    });
  }

  @Get("payers/:id")
  @Permissions(PERM.INFRA_PAYER_READ)
  async getPayer(@Req() req: any, @Param("id") id: string) {
    return this.svc.getPayer(this.principal(req), id);
  }

  @Patch("payers/:id")
  @Permissions(PERM.INFRA_PAYER_UPDATE)
  async updatePayer(@Req() req: any, @Param("id") id: string, @Body() dto: UpdatePayerDto) {
    return this.svc.updatePayer(this.principal(req), id, dto);
  }

  @Delete("payers/:id")
  @Permissions(PERM.INFRA_PAYER_UPDATE)
  async deactivatePayer(@Req() req: any, @Param("id") id: string) {
    return this.svc.deactivatePayer(this.principal(req), id);
  }
}
