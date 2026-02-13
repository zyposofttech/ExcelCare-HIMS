// ---------------------------------------------------------------------------
// Reconciliation Controller
// ---------------------------------------------------------------------------
import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import type { Principal } from "../../auth/access-policy.service";
import { PERM } from "../../iam/iam.constants";
import { ReconciliationService } from "./reconciliation.service";
import { CreatePaymentAdviceDto, ReconcileDto } from "./dto";

@ApiTags("billing/reconciliation")
@Controller("billing/reconciliation")
export class ReconciliationController {
  constructor(private readonly svc: ReconciliationService) {}

  private principal(req: any): Principal {
    return req.principal;
  }

  // ---- Payment Advice CRUD ----

  @Post("payment-advice")
  @Permissions(PERM.BILLING_RECONCILIATION_CREATE)
  createPaymentAdvice(
    @Req() req: any,
    @Body() dto: CreatePaymentAdviceDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.createPaymentAdvice(this.principal(req), dto, branchId ?? null);
  }

  @Get("payment-advice")
  @Permissions(PERM.BILLING_RECONCILIATION_READ)
  listPaymentAdvices(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("claimId") claimId?: string,
    @Query("status") status?: string,
  ) {
    return this.svc.listPaymentAdvices(this.principal(req), {
      branchId: branchId ?? null,
      claimId,
      status,
    });
  }

  @Post("payment-advice/:id/reconcile")
  @Permissions(PERM.BILLING_RECONCILIATION_UPDATE)
  reconcile(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: ReconcileDto,
  ) {
    return this.svc.reconcile(this.principal(req), id, dto);
  }

  // ---- Summary ----

  @Get("summary")
  @Permissions(PERM.BILLING_RECONCILIATION_READ)
  summary(
    @Req() req: any,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.summary(this.principal(req), branchId ?? null);
  }
}
