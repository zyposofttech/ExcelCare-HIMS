import { Body, Controller, Delete, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { SetInventoryConfigDto, CreateIndentMappingDto } from "./dto";
import { InventoryConfigService } from "./inventory-config.service";
import { PharmacyGoLiveService } from "./pharmacy-golive.service";

@ApiTags("infrastructure/pharmacy/inventory")
@Controller(["infrastructure", "infra"])
export class InventoryConfigController {
  constructor(
    private readonly svc: InventoryConfigService,
    private readonly goLiveSvc: PharmacyGoLiveService,
  ) {}

  private principal(req: any) {
    return req.principal;
  }

  // ---- Inventory Config ----

  @Get("pharmacy/inventory-config")
  @Permissions(PERM.INFRA_PHARMACY_INVENTORY_READ)
  async listInventoryConfigs(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("storeId") storeId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.svc.listInventoryConfigs(this.principal(req), { branchId, storeId, page, pageSize });
  }

  @Post("pharmacy/inventory-config")
  @Permissions(PERM.INFRA_PHARMACY_INVENTORY_UPDATE)
  async setInventoryConfigs(
    @Req() req: any,
    @Body() body: { configs: SetInventoryConfigDto[] },
  ) {
    return this.svc.setInventoryConfigs(this.principal(req), body.configs ?? []);
  }

  // ---- Indent Mapping ----

  @Get("pharmacy/indent-mappings")
  @Permissions(PERM.INFRA_PHARMACY_STORE_READ)
  async listIndentMappings(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.svc.listIndentMappings(this.principal(req), branchId);
  }

  @Post("pharmacy/indent-mappings")
  @Permissions(PERM.INFRA_PHARMACY_STORE_UPDATE)
  async createIndentMapping(@Req() req: any, @Body() dto: CreateIndentMappingDto) {
    return this.svc.createIndentMapping(this.principal(req), dto);
  }

  @Delete("pharmacy/indent-mappings/:id")
  @Permissions(PERM.INFRA_PHARMACY_STORE_UPDATE)
  async deleteIndentMapping(@Req() req: any, @Param("id") id: string) {
    return this.svc.deleteIndentMapping(this.principal(req), id);
  }

  // ---- Narcotics Register ----

  @Get("pharmacy/narcotics-register")
  @Permissions(PERM.INFRA_PHARMACY_NARCOTICS_READ)
  async listNarcoticsRegister(
    @Req() req: any,
    @Query("storeId") storeId?: string,
    @Query("drugId") drugId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.svc.listNarcoticsRegister(this.principal(req), { storeId, drugId, from, to, page, pageSize });
  }

  @Post("pharmacy/narcotics-register")
  @Permissions(PERM.INFRA_PHARMACY_NARCOTICS_UPDATE)
  async addNarcoticsEntry(@Req() req: any, @Body() entry: any) {
    return this.svc.addNarcoticsEntry(this.principal(req), entry);
  }

  // ---- Go-Live Checks ----

  @Get("pharmacy/go-live-checks")
  @Permissions(PERM.INFRA_PHARMACY_STORE_READ)
  async goLiveChecks(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.goLiveSvc.runGoLiveChecks(this.principal(req), branchId);
  }
}
