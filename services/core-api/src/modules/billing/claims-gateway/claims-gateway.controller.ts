// ---------------------------------------------------------------------------
// Claims Gateway Controller — manual status refresh endpoints
// ---------------------------------------------------------------------------
import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { RbacGuard } from "../../iam/rbac/rbac.guard";
import { Permissions } from "../../iam/rbac/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CurrentPrincipal } from "../../auth/current-principal.decorator";
import type { Principal } from "../../auth/access-policy.service";
import { ClaimsGatewayService } from "./claims-gateway.service";

@ApiTags("billing/claims-gateway")
@Controller("billing/claims-gateway")
@UseGuards(JwtAuthGuard, RbacGuard)
export class ClaimsGatewayController {
  constructor(private readonly gateway: ClaimsGatewayService) {}

  /**
   * Manually refresh a preauth's status from the payer/gateway.
   * Polls the adapter, updates PreauthRequest status + financials in DB.
   */
  @Post("preauth/:preauthId/refresh-status")
  @Permissions(PERM.BILLING_PREAUTH_UPDATE)
  async refreshPreauthStatus(
    @CurrentPrincipal() principal: Principal,
    @Param("preauthId") preauthId: string,
  ) {
    return this.gateway.refreshPreauthStatus(principal, preauthId);
  }

  /**
   * Manually refresh a claim's status from the payer/gateway.
   * Polls the adapter, updates Claim status + financials in DB.
   */
  @Post("claims/:claimId/refresh-status")
  @Permissions(PERM.BILLING_CLAIM_UPDATE)
  async refreshClaimStatus(
    @CurrentPrincipal() principal: Principal,
    @Param("claimId") claimId: string,
  ) {
    return this.gateway.refreshClaimStatus(principal, claimId);
  }
}
