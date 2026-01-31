import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CloseCurrentServiceChargeMappingDto, CloseServiceChargeMappingDto, UpsertServiceChargeMappingDto } from "./dto";

import { ServiceChargeMappingService } from "./service-charge-mapping.service";

@ApiTags("infrastructure/service-mapping")
@Controller(["infrastructure", "infra"])
export class ServiceChargeMappingController {
  constructor(private readonly svc: ServiceChargeMappingService) {}

  private principal(req: any) {
    return req.principal;
  }

  /**
   * ✅ NEW: list mappings (used by UI on load)
   * /api/infrastructure/service-charge-mappings?branchId=...&serviceItemId=...&includeHistory=true&includeRefs=true
   */
  @Get("service-charge-mappings")
  @Permissions(PERM.INFRA_SERVICE_READ)
  async list(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("serviceItemId") serviceItemId?: string,
    @Query("includeHistory") includeHistory?: string,
    @Query("includeRefs") includeRefs?: string,
    @Query("take") take?: string,
  ) {
    return this.svc.listServiceChargeMappings(this.principal(req), {
      branchId: branchId ?? null,
      serviceItemId,
      includeHistory: includeHistory === "true",
      includeRefs: includeRefs === "true",
      take: take ? Number(take) : undefined,
    });
  }

  /**
   * ✅ NEW: current mapping for a service item (handy for UI right panel)
   */
  @Get("service-charge-mappings/current/:serviceItemId")
  @Permissions(PERM.INFRA_SERVICE_READ)
  async current(
    @Req() req: any,
    @Param("serviceItemId") serviceItemId: string,
    @Query("includeRefs") includeRefs?: string,
  ) {
    return this.svc.getCurrentMappingForServiceItem(this.principal(req), serviceItemId, includeRefs === "true");
  }

  /**
   * ✅ NEW: canonical endpoint used by your frontend
   * POST /api/infrastructure/service-charge-mappings
   */
  @Post("service-charge-mappings")
  @Permissions(PERM.INFRA_SERVICE_MAPPING_UPDATE)
  async upsertCanonical(@Req() req: any, @Body() dto: UpsertServiceChargeMappingDto) {
    return this.svc.upsertServiceChargeMapping(this.principal(req), dto);
  }

  /**
   * ✅ ALIAS: old endpoint some screens used
   * POST /api/infrastructure/services/mapping
   */
  @Post("services/mapping")
  @Permissions(PERM.INFRA_SERVICE_MAPPING_UPDATE)
  async upsertLegacy(@Req() req: any, @Body() dto: UpsertServiceChargeMappingDto) {
    return this.svc.upsertServiceChargeMapping(this.principal(req), dto);
  }

  /**
   * ✅ NEW: close mapping (required because you enforce "no overlap")
   * POST /api/infrastructure/service-charge-mappings/:id/close
   */
  @Post("service-charge-mappings/:id/close")
  @Permissions(PERM.INFRA_SERVICE_MAPPING_UPDATE)
  async close(@Req() req: any, @Param("id") id: string, @Body() dto: CloseServiceChargeMappingDto) {
    return this.svc.closeServiceChargeMapping(this.principal(req), id, dto);
  }
  /**
 * ✅ ALIAS: close current mapping by serviceItemId (used by service-items UI)
 * POST /api/infrastructure/services/mapping/close
 */
@Post("services/mapping/close")
@Permissions(PERM.INFRA_SERVICE_MAPPING_UPDATE)
async closeLegacyByServiceItem(@Req() req: any, @Body() dto: CloseCurrentServiceChargeMappingDto) {
  return this.svc.closeCurrentMappingForServiceItem(this.principal(req), dto);
}

/**
 * ✅ CANONICAL (UI convenience): close current mapping by serviceItemId
 * POST /api/infrastructure/service-charge-mappings/close
 */
@Post("service-charge-mappings/close")
@Permissions(PERM.INFRA_SERVICE_MAPPING_UPDATE)
async closeCanonicalByServiceItem(@Req() req: any, @Body() dto: CloseCurrentServiceChargeMappingDto) {
  return this.svc.closeCurrentMappingForServiceItem(this.principal(req), dto);
}

}
