import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreateFormularyDto, FormularyItemDto } from "./dto";
import { FormularyService } from "./formulary.service";

@ApiTags("infrastructure/pharmacy/formulary")
@Controller(["infrastructure", "infra"])
export class FormularyController {
  constructor(private readonly svc: FormularyService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("pharmacy/formulary")
  @Permissions(PERM.INFRA_PHARMACY_FORMULARY_READ)
  async listFormularies(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.svc.listFormularies(this.principal(req), branchId);
  }

  @Post("pharmacy/formulary")
  @Permissions(PERM.INFRA_PHARMACY_FORMULARY_CREATE)
  async createFormulary(
    @Req() req: any,
    @Body() dto: CreateFormularyDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.createFormulary(this.principal(req), dto, branchId ?? null);
  }

  @Post("pharmacy/formulary/:id/items")
  @Permissions(PERM.INFRA_PHARMACY_FORMULARY_UPDATE)
  async addFormularyItems(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { items: FormularyItemDto[] },
  ) {
    return this.svc.addFormularyItems(this.principal(req), id, body.items ?? []);
  }

  @Post("pharmacy/formulary/:id/publish")
  @Permissions(PERM.INFRA_PHARMACY_FORMULARY_PUBLISH)
  async publishFormulary(@Req() req: any, @Param("id") id: string) {
    return this.svc.publishFormulary(this.principal(req), id);
  }
}
