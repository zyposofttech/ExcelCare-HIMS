import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreatePricingTierDto, UpdatePricingTierDto, UpsertTierRateDto } from "./dto";
import { PricingTierService } from "./pricing-tier.service";

@ApiTags("infrastructure/pricing-tiers")
@Controller(["infrastructure", "infra"])
export class PricingTierController {
  constructor(private readonly svc: PricingTierService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Post("pricing-tiers")
  @Permissions(PERM.INFRA_PRICING_TIER_CREATE)
  async createTier(
    @Req() req: any,
    @Body() dto: CreatePricingTierDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.createTier(this.principal(req), dto, branchId ?? null);
  }

  @Get("pricing-tiers")
  @Permissions(PERM.INFRA_PRICING_TIER_READ)
  async listTiers(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("q") q?: string,
    @Query("kind") kind?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("take") take?: string,
  ) {
    return this.svc.listTiers(this.principal(req), {
      branchId: branchId ?? null,
      q,
      kind,
      includeInactive: includeInactive === "true",
      take: take ? Number(take) : undefined,
    });
  }

  @Get("pricing-tiers/:id")
  @Permissions(PERM.INFRA_PRICING_TIER_READ)
  async getTier(@Req() req: any, @Param("id") id: string) {
    return this.svc.getTier(this.principal(req), id);
  }

  @Patch("pricing-tiers/:id")
  @Permissions(PERM.INFRA_PRICING_TIER_UPDATE)
  async updateTier(@Req() req: any, @Param("id") id: string, @Body() dto: UpdatePricingTierDto) {
    return this.svc.updateTier(this.principal(req), id, dto);
  }

  @Delete("pricing-tiers/:id")
  @Permissions(PERM.INFRA_PRICING_TIER_UPDATE)
  async deactivateTier(@Req() req: any, @Param("id") id: string) {
    return this.svc.deactivateTier(this.principal(req), id);
  }

  // ── Tier Rates (nested) ──

  @Post("pricing-tiers/:id/rates")
  @Permissions(PERM.INFRA_PRICING_TIER_CREATE)
  async addRate(@Req() req: any, @Param("id") id: string, @Body() dto: UpsertTierRateDto) {
    return this.svc.addTierRate(this.principal(req), id, dto);
  }

  @Get("pricing-tiers/:id/rates")
  @Permissions(PERM.INFRA_PRICING_TIER_READ)
  async listRates(@Req() req: any, @Param("id") id: string) {
    return this.svc.listTierRates(this.principal(req), id);
  }

  @Delete("pricing-tiers/:id/rates/:rateId")
  @Permissions(PERM.INFRA_PRICING_TIER_UPDATE)
  async deleteRate(@Req() req: any, @Param("id") id: string, @Param("rateId") rateId: string) {
    return this.svc.deleteTierRate(this.principal(req), id, rateId);
  }
}
