import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { TariffPlansService } from "./tariff-plans.service";
import { UpsertInfraTariffRateDto, UpdateInfraTariffRateDto } from "./dto";

@ApiTags("infrastructure/tariff-plans")
@Controller(["infrastructure", "infra"])
export class TariffPlansController {
  constructor(private readonly svc: TariffPlansService) {}

  private principal(req: any) {
    return req.principal;
  }

  // ---------- Plans

  @Get("tariff-plans")
  @Permissions(PERM.INFRA_CHARGE_MASTER_READ)
  listPlans(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("kind") kind?: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("includeRefs") includeRefs?: string,
    @Query("take") take?: string,
  ) {
    return this.svc.listTariffPlans(this.principal(req), {
      branchId: branchId ?? null,
      kind,
      status,
      q,
      includeInactive: includeInactive === "true",
      includeRefs: includeRefs === "true",
      take: take ? Number(take) : undefined,
    });
  }

  @Post("tariff-plans")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  createPlan(@Req() req: any, @Body() dto: any, @Query("branchId") branchId?: string) {
    return this.svc.createTariffPlan(this.principal(req), dto, branchId ?? null);
  }

  @Patch("tariff-plans/:id")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  updatePlan(@Req() req: any, @Param("id") id: string, @Body() dto: any) {
    return this.svc.updateTariffPlan(this.principal(req), id, dto);
  }

  @Delete("tariff-plans/:id")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  retirePlan(@Req() req: any, @Param("id") id: string) {
    return this.svc.retireTariffPlan(this.principal(req), id);
  }

  // ---------- Rates (plan-scoped list)

  @Get("tariff-plans/:id/rates")
  @Permissions(PERM.INFRA_CHARGE_MASTER_READ)
  listRatesForPlan(
    @Req() req: any,
    @Param("id") id: string,
    @Query("includeHistory") includeHistory?: string,
    @Query("includeRefs") includeRefs?: string,
  ) {
    return this.svc.listTariffRates(this.principal(req), id, {
      includeHistory: includeHistory === "true",
      includeRefs: includeRefs === "true",
    });
  }

  // ---------- Rates (direct endpoints, UI fallback compatible)

  @Get("tariff-rates")
  @Permissions(PERM.INFRA_CHARGE_MASTER_READ)
  listRatesDirect(
    @Req() req: any,
    @Query("tariffPlanId") tariffPlanId: string,
    @Query("chargeMasterItemId") chargeMasterItemId?: string,
    @Query("includeHistory") includeHistory?: string,
    @Query("includeRefs") includeRefs?: string,
  ) {
    return this.svc.listTariffRates(this.principal(req), tariffPlanId, {
      chargeMasterItemId,
      includeHistory: includeHistory === "true",
      includeRefs: includeRefs === "true",
    });
  }

  @Post("tariff-rates")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  upsertRateDirect(@Req() req: any, @Body() dto: UpsertInfraTariffRateDto) {
    return this.svc.upsertTariffRate(this.principal(req), dto);
  }

  @Patch("tariff-rates/:id")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  updateRateById(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateInfraTariffRateDto) {
    return this.svc.updateTariffRateById(this.principal(req), id, dto);
  }

  @Post("tariff-rates/:id/close")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  closeRateById(@Req() req: any, @Param("id") id: string, @Query("effectiveTo") effectiveTo: string) {
    return this.svc.closeTariffRateById(this.principal(req), id, effectiveTo);
  }

  @Delete("tariff-rates/:id")
  @Permissions(PERM.INFRA_CHARGE_MASTER_UPDATE)
  deactivateRateById(@Req() req: any, @Param("id") id: string) {
    return this.svc.deactivateTariffRateById(this.principal(req), id);
  }
}
