import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreateSupplierDto, UpdateSupplierDto } from "./dto";
import { SupplierService } from "./supplier.service";

@ApiTags("infrastructure/pharmacy/suppliers")
@Controller(["infrastructure", "infra"])
export class SupplierController {
  constructor(private readonly svc: SupplierService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("pharmacy/suppliers")
  @Permissions(PERM.INFRA_PHARMACY_SUPPLIER_READ)
  async listSuppliers(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.svc.listSuppliers(this.principal(req), { branchId, status, q, page, pageSize });
  }

  @Get("pharmacy/suppliers/:id")
  @Permissions(PERM.INFRA_PHARMACY_SUPPLIER_READ)
  async getSupplier(@Req() req: any, @Param("id") id: string) {
    return this.svc.getSupplier(this.principal(req), id);
  }

  @Post("pharmacy/suppliers")
  @Permissions(PERM.INFRA_PHARMACY_SUPPLIER_CREATE)
  async createSupplier(
    @Req() req: any,
    @Body() dto: CreateSupplierDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.createSupplier(this.principal(req), dto, branchId ?? null);
  }

  @Patch("pharmacy/suppliers/:id")
  @Permissions(PERM.INFRA_PHARMACY_SUPPLIER_UPDATE)
  async updateSupplier(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.svc.updateSupplier(this.principal(req), id, dto);
  }

  @Post("pharmacy/suppliers/:id/store-mappings")
  @Permissions(PERM.INFRA_PHARMACY_SUPPLIER_UPDATE)
  async mapSupplierToStores(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { storeIds: string[] },
  ) {
    return this.svc.mapSupplierToStores(this.principal(req), id, body.storeIds ?? []);
  }
}
