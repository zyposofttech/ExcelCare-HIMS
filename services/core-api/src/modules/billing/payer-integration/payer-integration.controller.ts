import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreatePayerIntegrationDto, UpdatePayerIntegrationDto } from "./dto";
import { PayerIntegrationService } from "./payer-integration.service";

@ApiTags("billing/payer-integrations")
@Controller("billing")
export class PayerIntegrationController {
  constructor(private readonly svc: PayerIntegrationService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Post("payer-integrations")
  @Permissions(PERM.BILLING_INTEGRATION_CREATE)
  async create(
    @Req() req: any,
    @Body() dto: CreatePayerIntegrationDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.create(this.principal(req), dto, branchId ?? null);
  }

  @Get("payer-integrations")
  @Permissions(PERM.BILLING_INTEGRATION_READ)
  async list(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("payerId") payerId?: string,
    @Query("integrationMode") integrationMode?: string,
    @Query("isActive") isActive?: string,
  ) {
    return this.svc.list(this.principal(req), {
      branchId: branchId ?? null,
      payerId,
      integrationMode,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
    });
  }

  @Get("payer-integrations/:id")
  @Permissions(PERM.BILLING_INTEGRATION_READ)
  async get(@Req() req: any, @Param("id") id: string) {
    return this.svc.get(this.principal(req), id);
  }

  @Patch("payer-integrations/:id")
  @Permissions(PERM.BILLING_INTEGRATION_UPDATE)
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdatePayerIntegrationDto,
  ) {
    return this.svc.update(this.principal(req), id, dto);
  }

  @Post("payer-integrations/:id/test")
  @Permissions(PERM.BILLING_INTEGRATION_UPDATE)
  async testConnectivity(@Req() req: any, @Param("id") id: string) {
    return this.svc.testConnectivity(this.principal(req), id);
  }
}
