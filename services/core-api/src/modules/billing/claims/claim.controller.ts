import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { ClaimService } from "./claim.service";
import { CreateClaimDto, UpdateClaimDto, ClaimLineItemDto, ClaimDeductionDto } from "./dto";

@ApiTags("billing/claims")
@Controller("billing/claims")
export class ClaimController {
  constructor(private readonly svc: ClaimService) {}

  private principal(req: any) {
    return req.principal;
  }

  // ------------------------------------------------------------------ POST /
  @Post()
  @Permissions(PERM.BILLING_CLAIM_CREATE)
  async create(
    @Req() req: any,
    @Body() dto: CreateClaimDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.create(this.principal(req), dto, branchId ?? null);
  }

  // ------------------------------------------------------------------ GET /
  @Get()
  @Permissions(PERM.BILLING_CLAIM_READ)
  async list(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("insuranceCaseId") insuranceCaseId?: string,
    @Query("status") status?: string,
    @Query("claimType") claimType?: string,
    @Query("q") q?: string,
  ) {
    return this.svc.list(this.principal(req), {
      branchId: branchId ?? null,
      insuranceCaseId,
      status,
      claimType,
      q,
    });
  }

  // ------------------------------------------------------------------ GET /:id
  @Get(":id")
  @Permissions(PERM.BILLING_CLAIM_READ)
  async get(@Req() req: any, @Param("id") id: string) {
    return this.svc.get(this.principal(req), id);
  }

  // ------------------------------------------------------------------ PATCH /:id
  @Patch(":id")
  @Permissions(PERM.BILLING_CLAIM_UPDATE)
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateClaimDto,
  ) {
    return this.svc.update(this.principal(req), id, dto);
  }

  // ------------------------------------------------------------------ POST /:id/submit
  @Post(":id/submit")
  @Permissions(PERM.BILLING_CLAIM_UPDATE)
  async submit(@Req() req: any, @Param("id") id: string) {
    return this.svc.submit(this.principal(req), id);
  }

  // ------------------------------------------------------------------ POST /:id/line-items
  @Post(":id/line-items")
  @Permissions(PERM.BILLING_CLAIM_CREATE)
  async addLineItem(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: ClaimLineItemDto,
  ) {
    return this.svc.addLineItem(this.principal(req), id, dto);
  }

  // ------------------------------------------------------------------ DELETE /:id/line-items/:lineId
  @Delete(":id/line-items/:lineId")
  @Permissions(PERM.BILLING_CLAIM_UPDATE)
  async removeLineItem(
    @Req() req: any,
    @Param("id") id: string,
    @Param("lineId") lineId: string,
  ) {
    return this.svc.removeLineItem(this.principal(req), id, lineId);
  }

  // ------------------------------------------------------------------ POST /:id/deductions
  @Post(":id/deductions")
  @Permissions(PERM.BILLING_CLAIM_UPDATE)
  async addDeduction(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: ClaimDeductionDto,
  ) {
    return this.svc.addDeduction(this.principal(req), id, dto);
  }

  // ------------------------------------------------------------------ POST /:id/snapshot
  @Post(":id/snapshot")
  @Permissions(PERM.BILLING_CLAIM_UPDATE)
  async createSnapshot(@Req() req: any, @Param("id") id: string) {
    return this.svc.createSnapshot(this.principal(req), id);
  }

  // ------------------------------------------------------------------ POST /:id/resubmit
  @Post(":id/resubmit")
  @Permissions(PERM.BILLING_CLAIM_CREATE)
  async resubmit(@Req() req: any, @Param("id") id: string) {
    return this.svc.resubmit(this.principal(req), id);
  }
}
