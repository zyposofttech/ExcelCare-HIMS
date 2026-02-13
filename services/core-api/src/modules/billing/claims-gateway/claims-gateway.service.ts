// ---------------------------------------------------------------------------
// Claims Gateway Service — orchestrates adapter selection & gateway transactions
// ---------------------------------------------------------------------------
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InfraContextService } from "../../infrastructure/shared/infra-context.service";
import type { Principal } from "../../auth/access-policy.service";
import type {
  IClaimsGatewayAdapter,
  PreauthSubmission,
  ClaimSubmission,
  GatewayResponse,
  StatusResponse,
} from "./claims-gateway.interface";
import { HcxAdapter } from "./adapters/hcx.adapter";
import { DirectApiAdapter } from "./adapters/direct-api.adapter";
import { SftpAdapter } from "./adapters/sftp.adapter";
import { PortalAssistedAdapter } from "./adapters/portal-assisted.adapter";

@Injectable()
export class ClaimsGatewayService {
  private readonly logger = new Logger(ClaimsGatewayService.name);

  constructor(private readonly ctx: InfraContextService) {}

  // ---- Adapter registry ----

  private getAdapter(integrationConfig: {
    integrationMode: string;
    // HCX / NHCX
    hcxParticipantCode?: string | null;
    hcxEndpointUrl?: string | null;
    hcxAuthConfig?: any;
    // Direct API
    apiBaseUrl?: string | null;
    apiAuthMethod?: string | null;
    apiAuthConfig?: any;
    // SFTP
    sftpHost?: string | null;
    sftpPort?: number | null;
    sftpPath?: string | null;
    sftpAuthConfig?: any;
    // Portal-assisted
    portalUrl?: string | null;
    portalNotes?: string | null;
  }): IClaimsGatewayAdapter {
    switch (integrationConfig.integrationMode) {
      case "HCX":
      case "NHCX":
        return new HcxAdapter({
          participantCode: integrationConfig.hcxParticipantCode ?? '',
          endpointUrl: integrationConfig.hcxEndpointUrl ?? '',
          authConfig: integrationConfig.hcxAuthConfig,
          senderCode: integrationConfig.hcxParticipantCode ?? '',
        });
      case "DIRECT_API":
        return new DirectApiAdapter({
          apiBaseUrl: integrationConfig.apiBaseUrl ?? '',
          apiAuthMethod: integrationConfig.apiAuthMethod,
          apiAuthConfig: integrationConfig.apiAuthConfig,
        });
      case "SFTP_BATCH":
        return new SftpAdapter({
          sftpHost: integrationConfig.sftpHost,
          sftpPort: integrationConfig.sftpPort,
          sftpPath: integrationConfig.sftpPath,
          sftpAuthConfig: integrationConfig.sftpAuthConfig,
        });
      case "PORTAL_ASSISTED":
      case "MANUAL":
        return new PortalAssistedAdapter({
          portalUrl: integrationConfig.portalUrl,
          portalNotes: integrationConfig.portalNotes,
        });
      default:
        throw new BadRequestException(
          `Unsupported integration mode "${integrationConfig.integrationMode}". Configure a PayerIntegrationConfig for this payer.`,
        );
    }
  }

  // ---- Submit Pre-auth ----

  async submitPreauth(principal: Principal, preauthId: string): Promise<GatewayResponse> {
    // 1. Load PreauthRequest with related entities
    const preauth = await this.ctx.prisma.preauthRequest.findUnique({
      where: { id: preauthId },
      include: {
        insuranceCase: {
          include: {
            patient: true,
            policy: true,
            payer: true,
          },
        },
      },
    });
    if (!preauth) throw new NotFoundException("PreauthRequest not found");

    const branchId = this.ctx.resolveBranchId(principal, preauth.branchId);

    const ic = preauth.insuranceCase;
    const patient = ic.patient;
    const policy = ic.policy;
    const payer = ic.payer;

    // 2. Get PayerIntegrationConfig for this payer + branch
    const integrationConfig = await this.ctx.prisma.payerIntegrationConfig.findFirst({
      where: { branchId, payerId: payer.id, isActive: true },
    });
    if (!integrationConfig) {
      throw new BadRequestException(
        `No active PayerIntegrationConfig found for payer "${payer.name}" in this branch`,
      );
    }

    // 3. Select adapter
    const adapter = this.getAdapter(integrationConfig);

    // 4. Create GatewayTransaction (GATEWAY_QUEUED)
    const gatewayTx = await this.ctx.prisma.gatewayTransaction.create({
      data: {
        branchId,
        payerIntegrationConfigId: integrationConfig.id,
        txType: "PREAUTH_SUBMIT" as any,
        txStatus: "GATEWAY_QUEUED" as any,
        entityType: "PREAUTH",
        entityId: preauthId,
        requestPayload: {
          preauthId,
          insuranceCaseId: ic.id,
          payerCode: payer.code,
          integrationMode: integrationConfig.integrationMode,
        },
      },
    });

    // 5. Call adapter
    const submission: PreauthSubmission = {
      preauthId: preauth.id,
      insuranceCaseId: ic.id,
      patientName: patient.name,
      policyNumber: policy.policyNumber,
      memberId: policy.memberId ?? policy.policyNumber,
      payerCode: payer.code,
      requestedAmount: preauth.requestedAmount ? Number(preauth.requestedAmount) : 0,
      packageCode: preauth.packageCode ?? undefined,
      procedureSummary: preauth.procedureSummary ?? undefined,
      clinicalNotes: preauth.clinicalNotes ?? undefined,
    };

    let result: GatewayResponse;
    try {
      result = await adapter.submitPreauth(submission);
    } catch (err: any) {
      // 6a. Update GatewayTransaction as GATEWAY_FAILED
      await this.ctx.prisma.gatewayTransaction.update({
        where: { id: gatewayTx.id },
        data: {
          txStatus: "GATEWAY_FAILED" as any,
          lastError: err?.message ?? "Unknown adapter error",
          attempts: { increment: 1 },
          respondedAt: new Date(),
        },
      });
      this.logger.error(`Preauth submission failed for ${preauthId}: ${err?.message}`);
      return { success: false, message: err?.message ?? "Adapter error" };
    }

    // 6b. Update GatewayTransaction status
    await this.ctx.prisma.gatewayTransaction.update({
      where: { id: gatewayTx.id },
      data: {
        txStatus: result.success ? ("GATEWAY_SENT" as any) : ("GATEWAY_FAILED" as any),
        externalRefId: result.externalRefId ?? null,
        responsePayload: result.rawResponse ?? null,
        sentAt: result.success ? new Date() : undefined,
        respondedAt: new Date(),
        attempts: { increment: 1 },
        lastError: result.success ? null : (result.message ?? null),
      },
    });

    // 7. If success, update PreauthRequest.gatewayRefId
    if (result.success && result.externalRefId) {
      await this.ctx.prisma.preauthRequest.update({
        where: { id: preauthId },
        data: { gatewayRefId: result.externalRefId },
      });
    }

    // 8. Audit log
    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_GATEWAY_PREAUTH_SUBMIT",
      entity: "PreauthRequest",
      entityId: preauthId,
      meta: {
        gatewayTxId: gatewayTx.id,
        adapter: adapter.mode,
        success: result.success,
        externalRefId: result.externalRefId,
      },
    });

    return result;
  }

  // ---- Submit Claim ----

  async submitClaim(principal: Principal, claimId: string): Promise<GatewayResponse> {
    // 1. Load Claim with related entities
    const claim = await this.ctx.prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        insuranceCase: {
          include: {
            patient: true,
            policy: true,
            payer: true,
          },
        },
        lineItems: true,
      },
    });
    if (!claim) throw new NotFoundException("Claim not found");

    const branchId = this.ctx.resolveBranchId(principal, claim.branchId);

    const ic = claim.insuranceCase;
    const patient = ic.patient;
    const policy = ic.policy;
    const payer = ic.payer;

    // 2. Get PayerIntegrationConfig
    const integrationConfig = await this.ctx.prisma.payerIntegrationConfig.findFirst({
      where: { branchId, payerId: payer.id, isActive: true },
    });
    if (!integrationConfig) {
      throw new BadRequestException(
        `No active PayerIntegrationConfig found for payer "${payer.name}" in this branch`,
      );
    }

    // 3. Select adapter
    const adapter = this.getAdapter(integrationConfig);

    // 4. Create GatewayTransaction (GATEWAY_QUEUED)
    const gatewayTx = await this.ctx.prisma.gatewayTransaction.create({
      data: {
        branchId,
        payerIntegrationConfigId: integrationConfig.id,
        txType: "CLAIM_SUBMIT" as any,
        txStatus: "GATEWAY_QUEUED" as any,
        entityType: "CLAIM",
        entityId: claimId,
        requestPayload: {
          claimId,
          insuranceCaseId: ic.id,
          payerCode: payer.code,
          integrationMode: integrationConfig.integrationMode,
        },
      },
    });

    // 5. Call adapter
    const submission: ClaimSubmission = {
      claimId: claim.id,
      insuranceCaseId: ic.id,
      claimNumber: claim.claimNumber,
      claimType: claim.claimType,
      patientName: patient.name,
      policyNumber: policy.policyNumber,
      memberId: policy.memberId ?? policy.policyNumber,
      payerCode: payer.code,
      totalAmount: claim.totalAmount ? Number(claim.totalAmount) : 0,
      lineItems: (claim.lineItems ?? []).map((li: any) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: Number(li.unitPrice),
        totalPrice: Number(li.totalPrice),
        hsnSac: li.hsnSac ?? undefined,
      })),
    };

    let result: GatewayResponse;
    try {
      result = await adapter.submitClaim(submission);
    } catch (err: any) {
      await this.ctx.prisma.gatewayTransaction.update({
        where: { id: gatewayTx.id },
        data: {
          txStatus: "GATEWAY_FAILED" as any,
          lastError: err?.message ?? "Unknown adapter error",
          attempts: { increment: 1 },
          respondedAt: new Date(),
        },
      });
      this.logger.error(`Claim submission failed for ${claimId}: ${err?.message}`);
      return { success: false, message: err?.message ?? "Adapter error" };
    }

    // 6. Update GatewayTransaction
    await this.ctx.prisma.gatewayTransaction.update({
      where: { id: gatewayTx.id },
      data: {
        txStatus: result.success ? ("GATEWAY_SENT" as any) : ("GATEWAY_FAILED" as any),
        externalRefId: result.externalRefId ?? null,
        responsePayload: result.rawResponse ?? null,
        sentAt: result.success ? new Date() : undefined,
        respondedAt: new Date(),
        attempts: { increment: 1 },
        lastError: result.success ? null : (result.message ?? null),
      },
    });

    // 7. If success, update Claim.gatewayRefId
    if (result.success && result.externalRefId) {
      await this.ctx.prisma.claim.update({
        where: { id: claimId },
        data: { gatewayRefId: result.externalRefId },
      });
    }

    // 8. Audit log
    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_GATEWAY_CLAIM_SUBMIT",
      entity: "Claim",
      entityId: claimId,
      meta: {
        gatewayTxId: gatewayTx.id,
        adapter: adapter.mode,
        success: result.success,
        externalRefId: result.externalRefId,
      },
    });

    return result;
  }

  // ---- Get Preauth Status ----

  async getPreauthStatus(principal: Principal, preauthId: string): Promise<StatusResponse> {
    const preauth = await this.ctx.prisma.preauthRequest.findUnique({
      where: { id: preauthId },
      select: {
        id: true,
        branchId: true,
        gatewayRefId: true,
        insuranceCase: {
          select: { payerId: true },
        },
      },
    });
    if (!preauth) throw new NotFoundException("PreauthRequest not found");

    const branchId = this.ctx.resolveBranchId(principal, preauth.branchId);

    if (!preauth.gatewayRefId) {
      return { status: "NOT_SUBMITTED", message: "No gateway reference found. Submit preauth first." };
    }

    const integrationConfig = await this.ctx.prisma.payerIntegrationConfig.findFirst({
      where: { branchId, payerId: preauth.insuranceCase.payerId, isActive: true },
    });
    if (!integrationConfig) {
      return { status: "UNKNOWN", message: "No active integration config found for this payer" };
    }

    const adapter = this.getAdapter(integrationConfig);

    // Log the status check
    await this.ctx.prisma.gatewayTransaction.create({
      data: {
        branchId,
        payerIntegrationConfigId: integrationConfig.id,
        txType: "PREAUTH_STATUS" as any,
        txStatus: "GATEWAY_SENT" as any,
        entityType: "PREAUTH",
        entityId: preauthId,
        externalRefId: preauth.gatewayRefId,
        sentAt: new Date(),
      },
    });

    return adapter.getPreauthStatus(preauth.gatewayRefId);
  }

  // ---- Get Claim Status ----

  async getClaimStatus(principal: Principal, claimId: string): Promise<StatusResponse> {
    const claim = await this.ctx.prisma.claim.findUnique({
      where: { id: claimId },
      select: {
        id: true,
        branchId: true,
        gatewayRefId: true,
        insuranceCase: {
          select: { payerId: true },
        },
      },
    });
    if (!claim) throw new NotFoundException("Claim not found");

    const branchId = this.ctx.resolveBranchId(principal, claim.branchId);

    if (!claim.gatewayRefId) {
      return { status: "NOT_SUBMITTED", message: "No gateway reference found. Submit claim first." };
    }

    const integrationConfig = await this.ctx.prisma.payerIntegrationConfig.findFirst({
      where: { branchId, payerId: claim.insuranceCase.payerId, isActive: true },
    });
    if (!integrationConfig) {
      return { status: "UNKNOWN", message: "No active integration config found for this payer" };
    }

    const adapter = this.getAdapter(integrationConfig);

    // Log the status check
    await this.ctx.prisma.gatewayTransaction.create({
      data: {
        branchId,
        payerIntegrationConfigId: integrationConfig.id,
        txType: "CLAIM_STATUS" as any,
        txStatus: "GATEWAY_SENT" as any,
        entityType: "CLAIM",
        entityId: claimId,
        externalRefId: claim.gatewayRefId,
        sentAt: new Date(),
      },
    });

    return adapter.getClaimStatus(claim.gatewayRefId);
  }

  // ---- Refresh Preauth Status (poll adapter + update DB) ----

  async refreshPreauthStatus(principal: Principal, preauthId: string) {
    const statusResponse = await this.getPreauthStatus(principal, preauthId);

    // Map adapter status to internal PreauthStatus
    const statusMap: Record<string, string> = {
      APPROVED: "PREAUTH_APPROVED",
      REJECTED: "PREAUTH_REJECTED",
      QUERY_RAISED: "PREAUTH_QUERY_RAISED",
      EXPIRED: "PREAUTH_EXPIRED",
    };

    const internalStatus = statusMap[statusResponse.status];
    if (!internalStatus) {
      return { updated: false, currentStatus: statusResponse.status, message: statusResponse.message };
    }

    const updateData: any = { status: internalStatus };
    if (statusResponse.approvedAmount != null) {
      updateData.approvedAmount = statusResponse.approvedAmount;
      updateData.approvedAt = new Date();
    }
    if (statusResponse.rejectionReason) {
      updateData.rejectionReason = statusResponse.rejectionReason;
    }
    if (internalStatus === "PREAUTH_REJECTED") {
      updateData.rejectedAt = new Date();
    }

    await this.ctx.prisma.preauthRequest.update({
      where: { id: preauthId },
      data: updateData,
    });

    this.logger.log(`PreauthRequest ${preauthId} refreshed to status=${internalStatus}`);

    return { updated: true, newStatus: internalStatus, ...statusResponse };
  }

  // ---- Refresh Claim Status (poll adapter + update DB) ----

  async refreshClaimStatus(principal: Principal, claimId: string) {
    const statusResponse = await this.getClaimStatus(principal, claimId);

    // Map adapter status to internal ClaimStatus
    const statusMap: Record<string, string> = {
      APPROVED: "CLAIM_APPROVED",
      PARTIALLY_APPROVED: "CLAIM_PARTIALLY_APPROVED",
      REJECTED: "CLAIM_REJECTED",
      PAID: "CLAIM_PAID",
      ACKNOWLEDGED: "CLAIM_ACKNOWLEDGED",
      QUERY_RAISED: "CLAIM_QUERY_RAISED",
    };

    const internalStatus = statusMap[statusResponse.status];
    if (!internalStatus) {
      return { updated: false, currentStatus: statusResponse.status, message: statusResponse.message };
    }

    const updateData: any = { status: internalStatus };
    if (statusResponse.approvedAmount != null) {
      updateData.approvedAmount = statusResponse.approvedAmount;
      updateData.approvedAt = new Date();
    }
    if (statusResponse.rejectionReason) {
      updateData.rejectionReason = statusResponse.rejectionReason;
    }
    if (internalStatus === "CLAIM_REJECTED") {
      updateData.rejectedAt = new Date();
    }
    if (internalStatus === "CLAIM_PAID") {
      updateData.paidAt = new Date();
      if (statusResponse.approvedAmount != null) {
        updateData.paidAmount = statusResponse.approvedAmount;
      }
    }
    if (internalStatus === "CLAIM_ACKNOWLEDGED") {
      updateData.acknowledgedAt = new Date();
    }

    // Store deductions
    if (statusResponse.deductions && statusResponse.deductions.length > 0) {
      const totalDeducted = statusResponse.deductions.reduce((sum, d) => sum + d.amount, 0);
      updateData.deductedAmount = totalDeducted;
    }

    await this.ctx.prisma.claim.update({
      where: { id: claimId },
      data: updateData,
    });

    this.logger.log(`Claim ${claimId} refreshed to status=${internalStatus}`);

    return { updated: true, newStatus: internalStatus, ...statusResponse };
  }

  // ---- Batch poll — called by cron worker for all pending submissions ----

  async pollPendingSubmissions(): Promise<{ preauths: number; claims: number }> {
    let preauthCount = 0;
    let claimCount = 0;

    // Find all preauths in SUBMITTED state with a gatewayRefId
    const pendingPreauths = await this.ctx.prisma.preauthRequest.findMany({
      where: {
        status: "PREAUTH_SUBMITTED" as any,
        gatewayRefId: { not: null },
      },
      select: {
        id: true,
        branchId: true,
        gatewayRefId: true,
        insuranceCase: { select: { payerId: true } },
      },
      take: 50,
    });

    for (const preauth of pendingPreauths) {
      try {
        const integrationConfig = await this.ctx.prisma.payerIntegrationConfig.findFirst({
          where: { branchId: preauth.branchId, payerId: preauth.insuranceCase.payerId, isActive: true },
        });
        if (!integrationConfig || !preauth.gatewayRefId) continue;

        // Skip polling for PORTAL_ASSISTED and MANUAL (status is updated via webhook/UI)
        if (
          integrationConfig.integrationMode === "PORTAL_ASSISTED" ||
          integrationConfig.integrationMode === "MANUAL"
        ) continue;

        const adapter = this.getAdapter(integrationConfig);
        const statusResponse = await adapter.getPreauthStatus(preauth.gatewayRefId);

        const statusMap: Record<string, string> = {
          APPROVED: "PREAUTH_APPROVED",
          REJECTED: "PREAUTH_REJECTED",
          QUERY_RAISED: "PREAUTH_QUERY_RAISED",
          EXPIRED: "PREAUTH_EXPIRED",
        };

        const internalStatus = statusMap[statusResponse.status];
        if (!internalStatus) continue;

        const updateData: any = { status: internalStatus };
        if (statusResponse.approvedAmount != null) {
          updateData.approvedAmount = statusResponse.approvedAmount;
          updateData.approvedAt = new Date();
        }
        if (statusResponse.rejectionReason) {
          updateData.rejectionReason = statusResponse.rejectionReason;
        }
        if (internalStatus === "PREAUTH_REJECTED") {
          updateData.rejectedAt = new Date();
        }

        await this.ctx.prisma.preauthRequest.update({
          where: { id: preauth.id },
          data: updateData,
        });

        this.logger.log(`[Poller] PreauthRequest ${preauth.id} → ${internalStatus}`);
        preauthCount++;
      } catch (err: any) {
        this.logger.warn(`[Poller] Failed to poll preauth ${preauth.id}: ${err.message}`);
      }
    }

    // Find all claims in SUBMITTED state with a gatewayRefId
    const pendingClaims = await this.ctx.prisma.claim.findMany({
      where: {
        status: "CLAIM_SUBMITTED" as any,
        gatewayRefId: { not: null },
      },
      select: {
        id: true,
        branchId: true,
        gatewayRefId: true,
        insuranceCase: { select: { payerId: true } },
      },
      take: 50,
    });

    for (const claim of pendingClaims) {
      try {
        const integrationConfig = await this.ctx.prisma.payerIntegrationConfig.findFirst({
          where: { branchId: claim.branchId, payerId: claim.insuranceCase.payerId, isActive: true },
        });
        if (!integrationConfig || !claim.gatewayRefId) continue;

        if (
          integrationConfig.integrationMode === "PORTAL_ASSISTED" ||
          integrationConfig.integrationMode === "MANUAL"
        ) continue;

        const adapter = this.getAdapter(integrationConfig);
        const statusResponse = await adapter.getClaimStatus(claim.gatewayRefId);

        const statusMap: Record<string, string> = {
          APPROVED: "CLAIM_APPROVED",
          PARTIALLY_APPROVED: "CLAIM_PARTIALLY_APPROVED",
          REJECTED: "CLAIM_REJECTED",
          PAID: "CLAIM_PAID",
          ACKNOWLEDGED: "CLAIM_ACKNOWLEDGED",
          QUERY_RAISED: "CLAIM_QUERY_RAISED",
        };

        const internalStatus = statusMap[statusResponse.status];
        if (!internalStatus) continue;

        const updateData: any = { status: internalStatus };
        if (statusResponse.approvedAmount != null) {
          updateData.approvedAmount = statusResponse.approvedAmount;
          updateData.approvedAt = new Date();
        }
        if (statusResponse.rejectionReason) {
          updateData.rejectionReason = statusResponse.rejectionReason;
        }
        if (internalStatus === "CLAIM_REJECTED") {
          updateData.rejectedAt = new Date();
        }
        if (internalStatus === "CLAIM_PAID") {
          updateData.paidAt = new Date();
          if (statusResponse.approvedAmount != null) {
            updateData.paidAmount = statusResponse.approvedAmount;
          }
        }

        await this.ctx.prisma.claim.update({
          where: { id: claim.id },
          data: updateData,
        });

        this.logger.log(`[Poller] Claim ${claim.id} → ${internalStatus}`);
        claimCount++;
      } catch (err: any) {
        this.logger.warn(`[Poller] Failed to poll claim ${claim.id}: ${err.message}`);
      }
    }

    return { preauths: preauthCount, claims: claimCount };
  }
}
