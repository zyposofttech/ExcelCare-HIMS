// ---------------------------------------------------------------------------
// Portal-Assisted adapter — generates submission packets for manual payer-portal upload
// Hospitals use this TODAY: generates a structured packet (JSON summary + document
// checklist), stores it as a GatewayTransaction, and the operator manually uploads
// via the payer portal. Status is entered manually via webhook or UI.
// ---------------------------------------------------------------------------
import { Logger } from "@nestjs/common";
import type {
  IClaimsGatewayAdapter,
  PreauthSubmission,
  ClaimSubmission,
  GatewayResponse,
  StatusResponse,
  CoverageCheckRequest,
  CoverageCheckResponse,
} from "../claims-gateway.interface";

export interface PortalAssistedConfig {
  portalUrl?: string | null;
  portalNotes?: string | null;
}

export class PortalAssistedAdapter implements IClaimsGatewayAdapter {
  readonly mode = "PORTAL_ASSISTED";
  private readonly logger = new Logger(PortalAssistedAdapter.name);

  constructor(private readonly config: PortalAssistedConfig = {}) {}

  // ---------------------------------------------------------------------------
  // Packet Builders — generate structured JSON for operator download / print
  // ---------------------------------------------------------------------------

  private buildPreauthPacket(req: PreauthSubmission): Record<string, any> {
    return {
      packetType: "PREAUTH_SUBMISSION",
      generatedAt: new Date().toISOString(),
      portalUrl: this.config.portalUrl ?? null,
      instructions: this.config.portalNotes ?? "Upload this packet to the payer portal.",
      patientInfo: {
        name: req.patientName,
        policyNumber: req.policyNumber,
        memberId: req.memberId,
      },
      preauthDetails: {
        preauthId: req.preauthId,
        insuranceCaseId: req.insuranceCaseId,
        payerCode: req.payerCode,
        requestedAmount: req.requestedAmount,
        packageCode: req.packageCode ?? null,
        procedureSummary: req.procedureSummary ?? null,
        clinicalNotes: req.clinicalNotes ?? null,
      },
      documentChecklist: this.buildDocumentChecklist("PREAUTH", req.documents),
      operatorActions: [
        "1. Log into the payer portal using the URL above",
        "2. Navigate to Pre-Authorization submission section",
        "3. Enter patient details (name, policy number, member ID)",
        "4. Enter procedure/package details and requested amount",
        "5. Upload all documents listed in the checklist",
        "6. Submit and note the reference/tracking number",
        "7. Update ZypoCare with the external reference ID via the Claims Dashboard",
      ],
    };
  }

  private buildClaimPacket(req: ClaimSubmission): Record<string, any> {
    return {
      packetType: "CLAIM_SUBMISSION",
      generatedAt: new Date().toISOString(),
      portalUrl: this.config.portalUrl ?? null,
      instructions: this.config.portalNotes ?? "Upload this packet to the payer portal.",
      patientInfo: {
        name: req.patientName,
        policyNumber: req.policyNumber,
        memberId: req.memberId,
      },
      claimDetails: {
        claimId: req.claimId,
        claimNumber: req.claimNumber,
        claimType: req.claimType,
        insuranceCaseId: req.insuranceCaseId,
        payerCode: req.payerCode,
        totalAmount: req.totalAmount,
      },
      lineItems: req.lineItems.map((li, idx) => ({
        sNo: idx + 1,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        totalPrice: li.totalPrice,
        hsnSac: li.hsnSac ?? null,
      })),
      documentChecklist: this.buildDocumentChecklist("CLAIM", req.documents),
      operatorActions: [
        "1. Log into the payer portal using the URL above",
        "2. Navigate to Claims submission section",
        "3. Enter patient details (name, policy number, member ID)",
        "4. Enter claim number, type, and line items with amounts",
        "5. Upload all documents listed in the checklist",
        "6. Submit and note the reference/tracking number",
        "7. Update ZypoCare with the external reference ID via the Claims Dashboard",
      ],
    };
  }

  private buildDocumentChecklist(
    entityType: "PREAUTH" | "CLAIM",
    documents?: Array<{ url: string; role: string }>,
  ): Array<{ role: string; url?: string; status: string }> {
    // Standard required documents per entity type
    const requiredRoles =
      entityType === "PREAUTH"
        ? [
            "PREAUTH_FORM",
            "ID_PROOF",
            "INSURANCE_CARD",
            "INVESTIGATION_REPORT",
            "PRESCRIPTION",
          ]
        : [
            "CLAIM_FORM",
            "DISCHARGE_SUMMARY",
            "BILL_SUMMARY",
            "INVESTIGATION_REPORT",
            "PRESCRIPTION",
            "ID_PROOF",
            "INSURANCE_CARD",
          ];

    const uploadedMap = new Map<string, string>();
    if (documents) {
      for (const doc of documents) {
        uploadedMap.set(doc.role, doc.url);
      }
    }

    return requiredRoles.map((role) => ({
      role,
      url: uploadedMap.get(role),
      status: uploadedMap.has(role) ? "UPLOADED" : "PENDING",
    }));
  }

  // ---------------------------------------------------------------------------
  // submitPreauth — generate packet, return success with a local tracking ref
  // ---------------------------------------------------------------------------

  async submitPreauth(req: PreauthSubmission): Promise<GatewayResponse> {
    const packet = this.buildPreauthPacket(req);
    const trackingRef = `PA-PORTAL-${Date.now().toString(36).toUpperCase()}`;

    this.logger.log(
      `Portal-assisted preauth packet generated for preauthId=${req.preauthId}, trackingRef=${trackingRef}`,
    );

    return {
      success: true,
      externalRefId: trackingRef,
      message: this.config.portalUrl
        ? `Preauth packet generated. Submit manually at: ${this.config.portalUrl}`
        : "Preauth packet generated. Submit manually via the payer portal.",
      rawResponse: {
        packet,
        trackingRef,
        requiresManualSubmission: true,
        portalUrl: this.config.portalUrl ?? null,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // submitClaim — generate packet, return success with a local tracking ref
  // ---------------------------------------------------------------------------

  async submitClaim(req: ClaimSubmission): Promise<GatewayResponse> {
    const packet = this.buildClaimPacket(req);
    const trackingRef = `CL-PORTAL-${Date.now().toString(36).toUpperCase()}`;

    this.logger.log(
      `Portal-assisted claim packet generated for claimId=${req.claimId}, trackingRef=${trackingRef}`,
    );

    return {
      success: true,
      externalRefId: trackingRef,
      message: this.config.portalUrl
        ? `Claim packet generated. Submit manually at: ${this.config.portalUrl}`
        : "Claim packet generated. Submit manually via the payer portal.",
      rawResponse: {
        packet,
        trackingRef,
        requiresManualSubmission: true,
        portalUrl: this.config.portalUrl ?? null,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // getPreauthStatus — portal-assisted mode always returns MANUAL_PENDING
  // The operator updates status via webhook endpoint or manual status update UI
  // ---------------------------------------------------------------------------

  async getPreauthStatus(refId: string): Promise<StatusResponse> {
    return {
      status: "MANUAL_PENDING",
      message: this.config.portalUrl
        ? `Check preauth status on the payer portal: ${this.config.portalUrl}. Reference: ${refId}`
        : `Portal-assisted mode: check the payer portal for preauth status. Reference: ${refId}`,
    };
  }

  // ---------------------------------------------------------------------------
  // getClaimStatus — same pattern as preauth status
  // ---------------------------------------------------------------------------

  async getClaimStatus(refId: string): Promise<StatusResponse> {
    return {
      status: "MANUAL_PENDING",
      message: this.config.portalUrl
        ? `Check claim status on the payer portal: ${this.config.portalUrl}. Reference: ${refId}`
        : `Portal-assisted mode: check the payer portal for claim status. Reference: ${refId}`,
    };
  }

  // ---------------------------------------------------------------------------
  // checkCoverage — returns instructions for manual verification
  // ---------------------------------------------------------------------------

  async checkCoverage(req: CoverageCheckRequest): Promise<CoverageCheckResponse> {
    return {
      isEligible: true, // Assume eligible; operator verifies manually
      message: this.config.portalUrl
        ? `Verify coverage on the payer portal: ${this.config.portalUrl}. Policy: ${req.policyNumber}, Member: ${req.memberId}`
        : `Portal-assisted mode: verify coverage for policy ${req.policyNumber} (member ${req.memberId}) directly on the payer portal.`,
      rawResponse: {
        requiresManualVerification: true,
        portalUrl: this.config.portalUrl ?? null,
      },
    };
  }
}
