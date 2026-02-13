import { Controller, Get, Param, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { PriceHistoryService } from "./price-history.service";

@ApiTags("infrastructure/price-history")
@Controller(["infrastructure", "infra"])
export class PriceHistoryController {
  constructor(private readonly svc: PriceHistoryService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("price-history")
  @Permissions(PERM.INFRA_PRICE_HISTORY_READ)
  async listHistory(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("serviceItemId") serviceItemId?: string,
    @Query("chargeMasterItemId") chargeMasterItemId?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("take") take?: string,
  ) {
    return this.svc.listHistory(this.principal(req), {
      branchId: branchId ?? null,
      serviceItemId,
      chargeMasterItemId,
      dateFrom,
      dateTo,
      take: take ? Number(take) : undefined,
    });
  }

  @Get("price-history/service/:id")
  @Permissions(PERM.INFRA_PRICE_HISTORY_READ)
  async getServiceHistory(@Req() req: any, @Param("id") id: string) {
    return this.svc.getServiceHistory(this.principal(req), id);
  }

  @Get("price-history/charge/:id")
  @Permissions(PERM.INFRA_PRICE_HISTORY_READ)
  async getChargeHistory(@Req() req: any, @Param("id") id: string) {
    return this.svc.getChargeHistory(this.principal(req), id);
  }
}
