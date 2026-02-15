import { Body, Controller, Delete, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";

import { AddNarcoticsEntryDto, CreateIndentMappingDto, SetInventoryConfigDto } from "./dto";
import { InventoryConfigService } from "./inventory-config.service";
import { PharmacyGoLiveService } from "./pharmacy-golive.service";

@ApiTags("infrastructure/pharmacy")
@Controller("infrastructure/pharmacy")
export class InventoryConfigController {
  constructor(
    private readonly svc: InventoryConfigService,
    private readonly goLiveSvc: PharmacyGoLiveService,
  ) {}

  private principal(req: any) {
    return req?.principal;
  }

  // ================================================================
  // Inventory Config
  // ================================================================

  @Get("inventory-config")
  @Permissions(PERM.INFRA_PHARMACY_INVENTORY_READ)
  async listInventoryConfigs(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("storeId") storeId?: string,
    @Query("drugId") drugId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.svc.listInventoryConfigs(this.principal(req), {
      branchId: branchId ?? null,
      storeId: storeId ?? null,
      drugId: drugId ?? null,
      page,
      pageSize,
    });
  }

  @Post("inventory-config")
  @Permissions(PERM.INFRA_PHARMACY_INVENTORY_UPDATE)
  async setInventoryConfigs(
    @Req() req: any,
    @Body() body: { configs: SetInventoryConfigDto[] },
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.setInventoryConfigs(this.principal(req), body?.configs ?? [], branchId ?? null);
  }

  @Delete("inventory-config/:id")
  @Permissions(PERM.INFRA_PHARMACY_INVENTORY_UPDATE)
  async deleteInventoryConfig(@Req() req: any, @Param("id") id: string) {
    return this.svc.deleteInventoryConfig(this.principal(req), id);
  }

  // ================================================================
  // Indent Mapping
  // ================================================================

  @Get("indent-mappings")
  @Permissions(PERM.INFRA_PHARMACY_INVENTORY_READ)
  async listIndentMappings(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.svc.listIndentMappings(this.principal(req), branchId ?? null);
  }

  @Post("indent-mappings")
  @Permissions(PERM.INFRA_PHARMACY_INVENTORY_UPDATE)
  async createIndentMapping(
    @Req() req: any,
    @Body() dto: CreateIndentMappingDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.createIndentMapping(this.principal(req), dto, branchId ?? null);
  }

  @Delete("indent-mappings/:id")
  @Permissions(PERM.INFRA_PHARMACY_INVENTORY_UPDATE)
  async deleteIndentMapping(@Req() req: any, @Param("id") id: string) {
    return this.svc.deleteIndentMapping(this.principal(req), id);
  }

  // ================================================================
  // Narcotics Register
  // ================================================================

  @Get("narcotics-register")
  @Permissions(PERM.INFRA_PHARMACY_INVENTORY_READ)
  async listNarcoticsRegister(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("storeId") storeId?: string,
    @Query("drugId") drugId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.svc.listNarcoticsRegister(this.principal(req), {
      branchId: branchId ?? null,
      storeId: storeId ?? null,
      drugId: drugId ?? null,
      from: from ?? null,
      to: to ?? null,
      page,
      pageSize,
    });
  }

  @Post("narcotics-register")
  @Permissions(PERM.INFRA_PHARMACY_INVENTORY_UPDATE)
  async addNarcoticsEntry(
    @Req() req: any,
    @Body() entry: AddNarcoticsEntryDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.addNarcoticsEntry(this.principal(req), entry, branchId ?? null);
  }

  // ================================================================
  // Go-Live Checks
  // ================================================================

  @Get("go-live-checks")
  @Permissions(PERM.INFRA_PHARMACY_INVENTORY_READ)
  async goLiveChecks(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.goLiveSvc.runGoLiveChecks(this.principal(req), branchId ?? null);
  }
}
