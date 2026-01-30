import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/roles.decorator";
import type { Principal } from "../auth/access-policy.service";
import { BillingService } from "./billing.service";
import {
  ActivateTariffPlanDto,
  CreateTariffPlanDto,
  UpdateTariffPlanDto,
  UpsertTariffRateDto,
  CreateTaxCodeDto,
  UpdateTaxCodeDto,
} from "./dto";

@ApiTags("billing")
@Controller("billing")
@Roles("SUPER_ADMIN", "BRANCH_ADMIN", "BILLING")
export class BillingController {
  constructor(private readonly svc: BillingService) { }

  private principal(req: any): Principal {
    return req.principal;
  }

  // -------- Tariff Plans

  @Get("tariff-plans")
  listPlans(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("kind") kind?: string,
    @Query("status") status?: string,
  ) {
    return this.svc.listTariffPlans(this.principal(req), { branchId: branchId ?? null, kind, status });
  }

  @Get("tariff-plans/:id")
  getPlan(@Req() req: any, @Param("id") id: string) {
    return this.svc.getTariffPlan(this.principal(req), id);
  }

  @Post("tariff-plans")
  createPlan(@Req() req: any, @Body() dto: CreateTariffPlanDto) {
    return this.svc.createTariffPlan(this.principal(req), dto);
  }

  @Patch("tariff-plans/:id")
  updatePlan(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateTariffPlanDto) {
    return this.svc.updateTariffPlan(this.principal(req), id, dto);
  }

  @Post("tariff-plans/:id/activate")
  activate(@Req() req: any, @Param("id") id: string, @Body() dto: ActivateTariffPlanDto) {
    return this.svc.activateTariffPlan(this.principal(req), id, dto);
  }

  @Post("tariff-plans/:id/retire")
  retire(@Req() req: any, @Param("id") id: string) {
    return this.svc.retireTariffPlan(this.principal(req), id);
  }

  // -------- Tariff Rates

  @Get("tariff-plans/:tariffPlanId/rates")
  listRates(
    @Req() req: any,
    @Param("tariffPlanId") tariffPlanId: string,
    @Query("chargeMasterItemId") chargeMasterItemId?: string,
    @Query("includeHistory") includeHistory?: string,
  ) {
    return this.svc.listTariffRates(this.principal(req), tariffPlanId, {
      chargeMasterItemId,
      includeHistory: includeHistory === "true",
    });
  }

  @Post("tariff-plans/:tariffPlanId/rates")
  upsertRate(@Req() req: any, @Param("tariffPlanId") tariffPlanId: string, @Body() dto: UpsertTariffRateDto) {
    return this.svc.upsertTariffRate(this.principal(req), dto, tariffPlanId);
  }

  @Post("tariff-plans/:tariffPlanId/rates/close")
  closeCurrentRate(
    @Req() req: any,
    @Param("tariffPlanId") tariffPlanId: string,
    @Query("chargeMasterItemId") chargeMasterItemId: string,
    @Query("effectiveTo") effectiveTo: string,
  ) {
    return this.svc.closeCurrentTariffRate(this.principal(req), tariffPlanId, chargeMasterItemId, effectiveTo);
  }

  // -------- Legacy aliases (keeps your UI from breaking if it used older endpoints)
  @Get("tariffs")
  listPlansAlias(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.svc.listTariffPlans(this.principal(req), { branchId: branchId ?? null });
  }

  @Post("tariffs")
  createPlanAlias(@Req() req: any, @Body() dto: CreateTariffPlanDto) {
    return this.svc.createTariffPlan(this.principal(req), dto);
  }

  @Post("tariffs/rates")
  upsertRateAlias(@Req() req: any, @Body() dto: UpsertTariffRateDto) {
    return this.svc.upsertTariffRate(this.principal(req), dto);
  }
  // -------- Tax Codes (Option-B)

  @Get("tax-codes")
  listTaxCodes(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("q") q?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("take") take?: string,
  ) {
    return this.svc.listTaxCodes(this.principal(req), {
      branchId: branchId ?? null,
      q,
      includeInactive: includeInactive === "true",
      take: take ? Number(take) : undefined,
    });
  }

  @Post("tax-codes")
  createTaxCode(
    @Req() req: any,
    @Body() dto: CreateTaxCodeDto,
    @Query("branchId") branchId?: string,
  ) {
    // UI sometimes sends branchId in body; allow both
    return this.svc.createTaxCode(this.principal(req), dto, branchId ?? null);
  }


  @Patch("tax-codes/:id")
  updateTaxCode(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateTaxCodeDto) {
    return this.svc.updateTaxCode(this.principal(req), id, dto);
  }

  @Delete("tax-codes/:id")
  deactivateTaxCode(@Req() req: any, @Param("id") id: string) {
    return this.svc.deactivateTaxCode(this.principal(req), id);
  }

}
