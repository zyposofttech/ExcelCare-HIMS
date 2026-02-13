import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreateInsurancePolicyDto, UpdateInsurancePolicyDto } from "./dto";
import { InsurancePolicyService } from "./insurance-policy.service";

@ApiTags("billing/insurance-policies")
@Controller("billing")
export class InsurancePolicyController {
  constructor(private readonly svc: InsurancePolicyService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Post("insurance-policies")
  @Permissions(PERM.BILLING_POLICY_CREATE)
  async create(
    @Req() req: any,
    @Body() dto: CreateInsurancePolicyDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.create(this.principal(req), dto, branchId ?? null);
  }

  @Get("insurance-policies")
  @Permissions(PERM.BILLING_POLICY_READ)
  async list(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("patientId") patientId?: string,
    @Query("payerId") payerId?: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
  ) {
    return this.svc.list(this.principal(req), {
      branchId: branchId ?? null,
      patientId,
      payerId,
      status,
      q,
    });
  }

  @Get("insurance-policies/:id")
  @Permissions(PERM.BILLING_POLICY_READ)
  async get(@Req() req: any, @Param("id") id: string) {
    return this.svc.get(this.principal(req), id);
  }

  @Patch("insurance-policies/:id")
  @Permissions(PERM.BILLING_POLICY_UPDATE)
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateInsurancePolicyDto,
  ) {
    return this.svc.update(this.principal(req), id, dto);
  }

  @Post("insurance-policies/:id/verify")
  @Permissions(PERM.BILLING_POLICY_UPDATE)
  async verify(@Req() req: any, @Param("id") id: string) {
    return this.svc.verify(this.principal(req), id);
  }
}
