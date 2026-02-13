import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { InsuranceCaseService } from "./insurance-case.service";
import { CreateInsuranceCaseDto, UpdateInsuranceCaseDto, TransitionCaseDto } from "./dto";

@ApiTags("billing/insurance-cases")
@Controller("billing/insurance-cases")
export class InsuranceCaseController {
  constructor(private readonly svc: InsuranceCaseService) {}

  private principal(req: any) {
    return req.principal;
  }

  // ------------------------------------------------------------------ POST /
  @Post()
  @Permissions(PERM.BILLING_CASE_CREATE)
  async create(
    @Req() req: any,
    @Body() dto: CreateInsuranceCaseDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.create(this.principal(req), dto, branchId ?? null);
  }

  // ------------------------------------------------------------------ GET /
  @Get()
  @Permissions(PERM.BILLING_CASE_READ)
  async list(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("status") status?: string,
    @Query("patientId") patientId?: string,
    @Query("payerId") payerId?: string,
    @Query("encounterId") encounterId?: string,
    @Query("q") q?: string,
  ) {
    return this.svc.list(this.principal(req), {
      branchId: branchId ?? null,
      status,
      patientId,
      payerId,
      encounterId,
      q,
    });
  }

  // ------------------------------------------------------------------ GET /dashboard
  // IMPORTANT: This must be placed BEFORE /:id to avoid route conflicts
  @Get("dashboard")
  @Permissions(PERM.BILLING_DASHBOARD_READ)
  async dashboard(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.svc.dashboard(this.principal(req), branchId ?? null);
  }

  // ------------------------------------------------------------------ GET /:id
  @Get(":id")
  @Permissions(PERM.BILLING_CASE_READ)
  async get(@Req() req: any, @Param("id") id: string) {
    return this.svc.get(this.principal(req), id);
  }

  // ------------------------------------------------------------------ PATCH /:id
  @Patch(":id")
  @Permissions(PERM.BILLING_CASE_UPDATE)
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateInsuranceCaseDto,
  ) {
    return this.svc.update(this.principal(req), id, dto);
  }

  // ------------------------------------------------------------------ POST /:id/transition
  @Post(":id/transition")
  @Permissions(PERM.BILLING_CASE_UPDATE)
  async transition(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: TransitionCaseDto,
  ) {
    return this.svc.transition(this.principal(req), id, dto);
  }
}
