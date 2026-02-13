// ---------------------------------------------------------------------------
// Claims Webhook Controller — receives inbound webhooks from payers / HCX
// ---------------------------------------------------------------------------
import { Body, Controller, HttpCode, Logger, Param, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import * as crypto from "crypto";
import { InfraContextService } from "../../../infrastructure/shared/infra-context.service";

@ApiTags("billing/claims-gateway/webhook")
@Controller("billing/claims-gateway/webhook")
export class ClaimsWebhookController {
  private readonly logger = new Logger(ClaimsWebhookController.name);

  constructor(private readonly ctx: InfraContextService) {}

  // ---------------------------------------------------------------------------
  // Signature Verification
  // ---------------------------------------------------------------------------

  private verifySignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    try {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      // Use timingSafeEqual to prevent timing attacks
      if (signature.length !== expected.length) return false;
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Payload Parsing Helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract the entity type from a webhook body.
   * Handles HCX FHIR payloads, direct payer payloads, and generic structures.
   */
  private resolveEntityType(body: any): "PREAUTH" | "CLAIM" | null {
    // Explicit entity_type field
    const explicit = body.entity_type ?? body.entityType;
    if (explicit) {
      const upper = String(explicit).toUpperCase();
      if (upper.includes("PREAUTH") || upper === "PRE_AUTH") return "PREAUTH";
      if (upper.includes("CLAIM")) return "CLAIM";
    }

    // HCX: check the FHIR Bundle for Claim resource use field
    const bundle = body.payload ?? body;
    if (bundle?.resourceType === "Bundle" && Array.isArray(bundle.entry)) {
      for (const entry of bundle.entry) {
        const res = entry?.resource;
        if (res?.resourceType === "ClaimResponse" || res?.resourceType === "Claim") {
          if (res.use === "preauthorization") return "PREAUTH";
          if (res.use === "claim") return "CLAIM";
        }
      }
    }

    // Direct ClaimResponse at top level
    if (body.resourceType === "ClaimResponse") {
      if (body.use === "preauthorization") return "PREAUTH";
      if (body.use === "claim") return "CLAIM";
    }

    // Check HCX API path hint
    const apiPath = body["x-hcx-api_call_id"] ?? "";
    if (typeof apiPath === "string") {
      if (apiPath.includes("preauth")) return "PREAUTH";
      if (apiPath.includes("claim")) return "CLAIM";
    }

    // Check type field
    if (body.type) {
      const t = String(body.type).toUpperCase();
      if (t.includes("PREAUTH")) return "PREAUTH";
      if (t.includes("CLAIM")) return "CLAIM";
    }

    return null;
  }

  /**
   * Extract the external reference ID from the webhook body.
   */
  private resolveExternalRefId(body: any): string | null {
    return (
      body["x-hcx-correlation_id"] ??
      body.correlation_id ??
      body.externalRefId ??
      body.external_ref_id ??
      body.gateway_ref_id ??
      body.gatewayRefId ??
      body.entityId ??
      body.entity_id ??
      null
    );
  }

  /**
   * Extract the payer-reported status from the webhook body.
   */
  private resolvePayerStatus(body: any): string | null {
    // Direct status field
    if (body.status) return String(body.status).toLowerCase();

    // HCX: dig into ClaimResponse.outcome
    const bundle = body.payload ?? body;
    if (bundle?.resourceType === "Bundle" && Array.isArray(bundle.entry)) {
      for (const entry of bundle.entry) {
        const res = entry?.resource;
        if (res?.resourceType === "ClaimResponse") {
          return res.outcome ?? null;
        }
      }
    }

    if (body.resourceType === "ClaimResponse") {
      return body.outcome ?? null;
    }

    return body.outcome ?? body.decision ?? null;
  }

  /**
   * Extract financial details from the webhook body.
   */
  private resolveFinancials(body: any): {
    approvedAmount?: number;
    rejectionReason?: string;
    deductions?: Array<{ code: string; amount: number; reason: string }>;
  } {
    const result: {
      approvedAmount?: number;
      rejectionReason?: string;
      deductions?: Array<{ code: string; amount: number; reason: string }>;
    } = {};

    // Direct fields
    if (body.approvedAmount != null || body.approved_amount != null) {
      result.approvedAmount = Number(body.approvedAmount ?? body.approved_amount);
    }

    if (body.rejectionReason ?? body.rejection_reason ?? body.reason) {
      result.rejectionReason = body.rejectionReason ?? body.rejection_reason ?? body.reason;
    }

    // Deductions array
    if (Array.isArray(body.deductions)) {
      result.deductions = body.deductions.map((d: any) => ({
        code: d.code ?? d.category ?? "DEDUCTION",
        amount: Number(d.amount ?? 0),
        reason: d.reason ?? d.description ?? "",
      }));
    }

    // Parse from FHIR ClaimResponse
    const bundle = body.payload ?? body;
    const entries = bundle?.entry ?? (bundle?.resourceType === "ClaimResponse" ? [{ resource: bundle }] : []);
    for (const entry of entries) {
      const res = entry?.resource;
      if (res?.resourceType !== "ClaimResponse") continue;

      // ClaimResponse.total
      if (res.total && !result.approvedAmount) {
        for (const totalItem of res.total) {
          if (totalItem.category?.coding?.[0]?.code === "benefit") {
            result.approvedAmount = totalItem.amount?.value;
          }
        }
      }

      // ClaimResponse.disposition as rejection reason
      if (res.disposition && !result.rejectionReason) {
        result.rejectionReason = res.disposition;
      }

      // ClaimResponse.processNote for additional context
      if (res.processNote && !result.rejectionReason) {
        for (const note of res.processNote) {
          if (note.text) {
            result.rejectionReason = note.text;
            break;
          }
        }
      }

      // Adjudication deductions
      if (res.item && !result.deductions) {
        const deductions: Array<{ code: string; amount: number; reason: string }> = [];
        for (const item of res.item) {
          if (item.adjudication) {
            for (const adj of item.adjudication) {
              const adjCode = adj.category?.coding?.[0]?.code;
              if (
                adjCode === "deductible" ||
                adjCode === "copay" ||
                adjCode === "non-payable"
              ) {
                deductions.push({
                  code: adjCode,
                  amount: adj.amount?.value ?? 0,
                  reason:
                    adj.reason?.text ??
                    adj.category?.coding?.[0]?.display ??
                    adjCode,
                });
              }
            }
          }
        }
        if (deductions.length > 0) {
          result.deductions = deductions;
        }
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Status Mapping
  // ---------------------------------------------------------------------------

  /**
   * Map payer-reported status to internal PreauthStatus enum values.
   */
  private mapToPreauthStatus(payerStatus: string): string | null {
    const s = payerStatus.toLowerCase();
    if (s === "approved" || s === "complete") return "PREAUTH_APPROVED";
    if (s === "rejected" || s === "error" || s === "denied") return "PREAUTH_REJECTED";
    if (s === "query" || s === "query_raised" || s === "partial") return "PREAUTH_QUERY_RAISED";
    if (s === "expired") return "PREAUTH_EXPIRED";
    return null;
  }

  /**
   * Map payer-reported status to internal ClaimStatus enum values.
   */
  private mapToClaimStatus(payerStatus: string): string | null {
    const s = payerStatus.toLowerCase();
    if (s === "approved" || s === "complete") return "CLAIM_APPROVED";
    if (s === "partially_approved" || s === "partial") return "CLAIM_PARTIALLY_APPROVED";
    if (s === "rejected" || s === "error" || s === "denied") return "CLAIM_REJECTED";
    if (s === "paid" || s === "settled") return "CLAIM_PAID";
    if (s === "acknowledged" || s === "queued") return "CLAIM_ACKNOWLEDGED";
    if (s === "query" || s === "query_raised") return "CLAIM_QUERY_RAISED";
    if (s === "under_review" || s === "review") return "CLAIM_UNDER_REVIEW";
    if (s === "deducted") return "CLAIM_DEDUCTED";
    return null;
  }

  /**
   * Map to InsuranceCaseStatus when appropriate.
   */
  private mapToInsuranceCaseStatus(
    entityType: "PREAUTH" | "CLAIM",
    internalStatus: string,
  ): string | null {
    if (entityType === "PREAUTH") {
      if (internalStatus === "PREAUTH_APPROVED") return "PREAUTH_APPROVED";
    }
    if (entityType === "CLAIM") {
      if (internalStatus === "CLAIM_APPROVED") return "CLAIM_APPROVED";
      if (internalStatus === "CLAIM_PARTIALLY_APPROVED") return "CLAIM_APPROVED";
      if (internalStatus === "CLAIM_PAID") return "SETTLED";
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Main Webhook Endpoint
  // ---------------------------------------------------------------------------

  /**
   * Receives inbound webhooks from a payer or HCX gateway.
   * The payerId is used to look up the PayerIntegrationConfig for signature verification.
   *
   * Flow:
   * 1. Look up integration config
   * 2. Verify webhook signature (if secret is configured)
   * 3. Check for idempotency (duplicate webhook)
   * 4. Parse entity type, external ref ID, status, and financials
   * 5. Find and update the PreauthRequest or Claim
   * 6. Update InsuranceCase status if appropriate
   * 7. Store full webhook in GatewayTransaction for audit trail
   */
  @Post(":payerId")
  @HttpCode(200)
  async receiveWebhook(
    @Param("payerId") payerId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    this.logger.log(`Webhook received for payerId=${payerId}`);

    // 1. Look up integration config to determine branch context
    const integrationConfig = await this.ctx.prisma.payerIntegrationConfig.findFirst({
      where: { payerId, isActive: true },
      select: {
        id: true,
        branchId: true,
        webhookSecret: true,
        integrationMode: true,
      },
    });

    if (!integrationConfig) {
      this.logger.warn(
        `No active integration config for payerId=${payerId}. Ignoring webhook.`,
      );
      return { received: true, processed: false, reason: "No active integration config" };
    }

    // 2. Verify webhook signature (prefer raw body bytes to avoid JSON re-serialization issues)
    const signature =
      req.headers["x-webhook-signature"] ??
      req.headers["x-hcx-signature"];

    if (integrationConfig.webhookSecret && signature) {
      // Use raw body if available (captured via NestJS rawBody option), otherwise fall back
      const rawBody: string =
        req.rawBody
          ? req.rawBody.toString("utf-8")
          : typeof body === "string"
            ? body
            : JSON.stringify(body);

      const isValid = this.verifySignature(
        rawBody,
        signature,
        integrationConfig.webhookSecret,
      );

      if (!isValid) {
        this.logger.warn(
          `Webhook signature verification failed for payerId=${payerId}`,
        );
        return {
          received: true,
          processed: false,
          reason: "Signature verification failed",
          statusCode: 401,
        };
      }
    }

    // 3. Idempotency check (read both dash and underscore variants from headers)
    const idempotencyKey =
      req.headers["x-idempotency-key"] ??
      req.headers["x-hcx-correlation-id"] ??
      req.headers["x-hcx-correlation_id"] ??
      body["x-hcx-correlation_id"] ??
      body.correlation_id ??
      body.idempotency_key;

    if (idempotencyKey) {
      const existingTx = await this.ctx.prisma.gatewayTransaction.findFirst({
        where: {
          externalRefId: idempotencyKey,
          txType: "WEBHOOK_INBOUND" as any,
          txStatus: "GATEWAY_RESPONSE_RECEIVED" as any,
        },
      });

      if (existingTx) {
        this.logger.log(
          `Duplicate webhook detected for idempotencyKey=${idempotencyKey}. Skipping.`,
        );
        return { received: true, duplicate: true };
      }
    }

    // 4. Parse webhook payload
    const entityType = this.resolveEntityType(body);
    const externalRefId = this.resolveExternalRefId(body);
    const payerStatus = this.resolvePayerStatus(body);
    const financials = this.resolveFinancials(body);

    this.logger.log(
      `Webhook parsed: entityType=${entityType}, externalRefId=${externalRefId}, payerStatus=${payerStatus}`,
    );

    let processedEntityType: string | null = entityType;
    let processedEntityId: string | null = null;

    // 5. Find and update the PreauthRequest or Claim
    if (entityType && externalRefId && payerStatus) {
      try {
        if (entityType === "PREAUTH") {
          const result = await this.processPreauthWebhook(
            externalRefId,
            payerStatus,
            financials,
          );
          processedEntityId = result.entityId;
        } else if (entityType === "CLAIM") {
          const result = await this.processClaimWebhook(
            externalRefId,
            payerStatus,
            financials,
          );
          processedEntityId = result.entityId;
        }
      } catch (err: any) {
        this.logger.error(
          `Error processing webhook for entityType=${entityType}, externalRefId=${externalRefId}: ${err.message}`,
        );
      }
    } else {
      this.logger.warn(
        `Webhook missing required fields: entityType=${entityType}, externalRefId=${externalRefId}, payerStatus=${payerStatus}`,
      );
    }

    // 6. Store the full webhook in GatewayTransaction for audit trail
    await this.ctx.prisma.gatewayTransaction.create({
      data: {
        branchId: integrationConfig.branchId,
        payerIntegrationConfigId: integrationConfig.id,
        txType: "WEBHOOK_INBOUND" as any,
        txStatus: "GATEWAY_RESPONSE_RECEIVED" as any,
        entityType: processedEntityType ?? "WEBHOOK",
        entityId: processedEntityId ?? payerId,
        externalRefId: idempotencyKey ?? externalRefId ?? null,
        responsePayload: body,
        respondedAt: new Date(),
        attempts: 1,
      },
    });

    return {
      received: true,
      processed: !!processedEntityId,
      entityType: processedEntityType,
      entityId: processedEntityId,
    };
  }

  // ---------------------------------------------------------------------------
  // Entity-specific processing
  // ---------------------------------------------------------------------------

  /**
   * Find a PreauthRequest by gatewayRefId, update its status and financial fields.
   */
  private async processPreauthWebhook(
    externalRefId: string,
    payerStatus: string,
    financials: {
      approvedAmount?: number;
      rejectionReason?: string;
      deductions?: Array<{ code: string; amount: number; reason: string }>;
    },
  ): Promise<{ entityId: string | null }> {
    // Find PreauthRequest by gatewayRefId
    const preauth = await this.ctx.prisma.preauthRequest.findFirst({
      where: { gatewayRefId: externalRefId },
      select: { id: true, insuranceCaseId: true },
    });

    if (!preauth) {
      this.logger.warn(
        `No PreauthRequest found with gatewayRefId=${externalRefId}`,
      );
      return { entityId: null };
    }

    // Map payer status to internal status
    const internalStatus = this.mapToPreauthStatus(payerStatus);
    if (!internalStatus) {
      this.logger.warn(
        `Could not map payer status "${payerStatus}" to PreauthStatus for preauth ${preauth.id}`,
      );
      return { entityId: preauth.id };
    }

    // Build update data
    const updateData: any = {
      status: internalStatus,
    };

    if (financials.approvedAmount != null) {
      updateData.approvedAmount = financials.approvedAmount;
      updateData.approvedAt = new Date();
    }

    if (financials.rejectionReason) {
      updateData.rejectionReason = financials.rejectionReason;
    }

    if (internalStatus === "PREAUTH_REJECTED") {
      updateData.rejectedAt = new Date();
      if (financials.rejectionReason) {
        updateData.rejectionReason = financials.rejectionReason;
      }
    }

    if (internalStatus === "PREAUTH_APPROVED") {
      updateData.approvedAt = updateData.approvedAt ?? new Date();
    }

    // Update PreauthRequest
    await this.ctx.prisma.preauthRequest.update({
      where: { id: preauth.id },
      data: updateData,
    });

    this.logger.log(
      `PreauthRequest ${preauth.id} updated to status=${internalStatus}`,
    );

    // Update InsuranceCase status if appropriate
    const icStatus = this.mapToInsuranceCaseStatus("PREAUTH", internalStatus);
    if (icStatus) {
      await this.ctx.prisma.insuranceCase.update({
        where: { id: preauth.insuranceCaseId },
        data: {
          status: icStatus as any,
          ...(financials.approvedAmount != null
            ? { approvedAmount: financials.approvedAmount }
            : {}),
        },
      });

      this.logger.log(
        `InsuranceCase ${preauth.insuranceCaseId} updated to status=${icStatus}`,
      );
    }

    return { entityId: preauth.id };
  }

  /**
   * Find a Claim by gatewayRefId, update its status and financial fields.
   */
  private async processClaimWebhook(
    externalRefId: string,
    payerStatus: string,
    financials: {
      approvedAmount?: number;
      rejectionReason?: string;
      deductions?: Array<{ code: string; amount: number; reason: string }>;
    },
  ): Promise<{ entityId: string | null }> {
    // Find Claim by gatewayRefId
    const claim = await this.ctx.prisma.claim.findFirst({
      where: { gatewayRefId: externalRefId },
      select: { id: true, insuranceCaseId: true },
    });

    if (!claim) {
      this.logger.warn(
        `No Claim found with gatewayRefId=${externalRefId}`,
      );
      return { entityId: null };
    }

    // Map payer status to internal status
    const internalStatus = this.mapToClaimStatus(payerStatus);
    if (!internalStatus) {
      this.logger.warn(
        `Could not map payer status "${payerStatus}" to ClaimStatus for claim ${claim.id}`,
      );
      return { entityId: claim.id };
    }

    // Build update data
    const updateData: any = {
      status: internalStatus,
    };

    if (financials.approvedAmount != null) {
      updateData.approvedAmount = financials.approvedAmount;
      updateData.approvedAt = new Date();
    }

    if (financials.rejectionReason) {
      updateData.rejectionReason = financials.rejectionReason;
    }

    if (internalStatus === "CLAIM_REJECTED") {
      updateData.rejectedAt = new Date();
    }

    if (internalStatus === "CLAIM_APPROVED" || internalStatus === "CLAIM_PARTIALLY_APPROVED") {
      updateData.approvedAt = updateData.approvedAt ?? new Date();
    }

    if (internalStatus === "CLAIM_PAID") {
      updateData.paidAt = new Date();
      if (financials.approvedAmount != null) {
        updateData.paidAmount = financials.approvedAmount;
      }
    }

    if (internalStatus === "CLAIM_ACKNOWLEDGED") {
      updateData.acknowledgedAt = new Date();
    }

    // Calculate total deducted amount if deductions exist
    if (financials.deductions && financials.deductions.length > 0) {
      const totalDeducted = financials.deductions.reduce(
        (sum, d) => sum + d.amount,
        0,
      );
      updateData.deductedAmount = totalDeducted;
    }

    // Update Claim
    await this.ctx.prisma.claim.update({
      where: { id: claim.id },
      data: updateData,
    });

    this.logger.log(
      `Claim ${claim.id} updated to status=${internalStatus}`,
    );

    // Store individual deductions if provided
    if (financials.deductions && financials.deductions.length > 0) {
      for (const deduction of financials.deductions) {
        try {
          await this.ctx.prisma.claimDeduction.create({
            data: {
              claimId: claim.id,
              reasonCode: deduction.code,
              reasonCategory: this.mapDeductionCategory(deduction.code),
              description: deduction.reason || deduction.code,
              amount: deduction.amount,
            },
          });
        } catch (err: any) {
          this.logger.warn(
            `Failed to store deduction for claim ${claim.id}: ${err.message}`,
          );
        }
      }
    }

    // Update InsuranceCase status if appropriate
    const icStatus = this.mapToInsuranceCaseStatus("CLAIM", internalStatus);
    if (icStatus) {
      const icUpdateData: any = { status: icStatus as any };

      if (internalStatus === "CLAIM_APPROVED" || internalStatus === "CLAIM_PARTIALLY_APPROVED") {
        if (financials.approvedAmount != null) {
          icUpdateData.claimedAmount = financials.approvedAmount;
        }
      }

      if (internalStatus === "CLAIM_PAID") {
        if (financials.approvedAmount != null) {
          icUpdateData.settledAmount = financials.approvedAmount;
        }
      }

      await this.ctx.prisma.insuranceCase.update({
        where: { id: claim.insuranceCaseId },
        data: icUpdateData,
      });

      this.logger.log(
        `InsuranceCase ${claim.insuranceCaseId} updated to status=${icStatus}`,
      );
    }

    return { entityId: claim.id };
  }

  /**
   * Map a deduction code string to the DeductionCategory enum.
   */
  private mapDeductionCategory(code: string): any {
    const c = code.toUpperCase();
    if (c === "COPAY" || c.includes("COPAY")) return "COPAY";
    if (c === "DEDUCTIBLE" || c.includes("DEDUCTIBLE")) return "DEDUCTIBLE";
    if (c === "NON_PAYABLE" || c.includes("NON_PAYABLE") || c.includes("NON-PAYABLE")) return "NON_PAYABLE";
    if (c === "EXCESS" || c.includes("EXCESS")) return "EXCESS";
    if (c === "NON_MEDICAL" || c.includes("NON_MEDICAL")) return "NON_MEDICAL";
    if (c === "TARIFF_DIFF" || c.includes("TARIFF")) return "TARIFF_DIFF";
    // Default
    return "OTHER";
  }
}
