// ---------------------------------------------------------------------------
// HCX / NHCX FHIR-based adapter — real implementation for HCX sandbox & production
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

export interface HcxAdapterConfig {
  participantCode: string;
  endpointUrl: string;
  authConfig: any; // JWT credentials: { username, password } or { clientId, clientSecret }
  senderCode?: string;
}

export class HcxAdapter implements IClaimsGatewayAdapter {
  readonly mode = "HCX";
  private readonly logger = new Logger(HcxAdapter.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: HcxAdapterConfig) {}

  // ---------------------------------------------------------------------------
  // Authentication — obtain a Bearer token from HCX auth endpoint
  // ---------------------------------------------------------------------------
  private async ensureAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const authCfg = this.config.authConfig ?? {};
    const tokenUrl = authCfg.tokenUrl
      ?? `${this.config.endpointUrl}/v0.7/auth/token`;

    try {
      const body = new URLSearchParams();
      body.append("grant_type", "client_credentials");
      if (authCfg.clientId) {
        body.append("client_id", authCfg.clientId);
        body.append("client_secret", authCfg.clientSecret ?? "");
      } else if (authCfg.username) {
        body.append("username", authCfg.username);
        body.append("password", authCfg.password ?? "");
      }

      const resp = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HCX auth failed (${resp.status}): ${text}`);
      }

      const json = await resp.json();
      this.accessToken = json.access_token ?? json.token;
      // Default to 50 min if no expires_in (tokens typically last 60 min)
      const expiresIn = (json.expires_in ?? 3000) * 1000;
      this.tokenExpiresAt = Date.now() + expiresIn - 60_000; // refresh 1 min early
      return this.accessToken!;
    } catch (err: any) {
      this.logger.error(`HCX auth token acquisition failed: ${err.message}`);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Common HTTP helper
  // ---------------------------------------------------------------------------
  private async hcxPost(path: string, payload: any): Promise<any> {
    const token = await this.ensureAccessToken();
    const url = `${this.config.endpointUrl}${path}`;

    this.logger.debug(`HCX POST ${url}`);

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-HCX-Sender": this.config.senderCode ?? this.config.participantCode,
        "X-HCX-Recipient": this.config.participantCode,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await resp.text();
    let parsed: any;
    try {
      parsed = JSON.parse(responseBody);
    } catch {
      parsed = { raw: responseBody };
    }

    if (!resp.ok) {
      throw new Error(
        `HCX request failed (${resp.status}): ${parsed?.error?.message ?? parsed?.error ?? responseBody}`,
      );
    }

    return parsed;
  }

  // ---------------------------------------------------------------------------
  // FHIR Resource Builders
  // ---------------------------------------------------------------------------

  private buildPatientResource(patientName: string): any {
    return {
      resource: {
        resourceType: "Patient",
        id: `patient-${Date.now()}`,
        name: [{ text: patientName }],
      },
    };
  }

  private buildCoverageResource(
    policyNumber: string,
    memberId: string,
    payerCode: string,
  ): any {
    return {
      resource: {
        resourceType: "Coverage",
        id: `coverage-${Date.now()}`,
        status: "active",
        subscriberId: memberId,
        identifier: [
          {
            system: "https://hcx.org/policy",
            value: policyNumber,
          },
        ],
        payor: [
          {
            identifier: {
              system: "https://hcx.org/participant",
              value: payerCode,
            },
          },
        ],
      },
    };
  }

  private buildDocumentReferences(
    documents?: Array<{ url: string; role: string }>,
  ): any[] {
    if (!documents || documents.length === 0) return [];
    return documents.map((doc, idx) => ({
      resource: {
        resourceType: "DocumentReference",
        id: `doc-${idx}-${Date.now()}`,
        status: "current",
        type: {
          coding: [
            {
              system: "https://hcx.org/document-type",
              code: doc.role,
              display: doc.role,
            },
          ],
        },
        content: [
          {
            attachment: {
              url: doc.url,
              contentType: "application/pdf",
            },
          },
        ],
      },
    }));
  }

  private buildHcxProtocolEnvelope(fhirBundle: any, recipientCode: string): any {
    const timestamp = new Date().toISOString();
    const correlationId = `hcx-corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const apiCallId = `hcx-api-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    return {
      payload: fhirBundle,
      "x-hcx-sender_code": this.config.senderCode ?? this.config.participantCode,
      "x-hcx-recipient_code": recipientCode,
      "x-hcx-api_call_id": apiCallId,
      "x-hcx-correlation_id": correlationId,
      "x-hcx-timestamp": timestamp,
      "x-hcx-status": "request.initiate",
    };
  }

  // ---------------------------------------------------------------------------
  // submitPreauth — Build FHIR Claim Bundle (use: preauthorization)
  // ---------------------------------------------------------------------------

  async submitPreauth(req: PreauthSubmission): Promise<GatewayResponse> {
    try {
      const patientEntry = this.buildPatientResource(req.patientName);
      const coverageEntry = this.buildCoverageResource(
        req.policyNumber,
        req.memberId,
        req.payerCode,
      );

      // Build Claim resource for preauthorization
      const claimItems: any[] = [];
      if (req.packageCode || req.procedureSummary) {
        claimItems.push({
          sequence: 1,
          productOrService: {
            coding: req.packageCode
              ? [
                  {
                    system: "https://hcx.org/pmjay-hbp",
                    code: req.packageCode,
                    display: req.procedureSummary ?? req.packageCode,
                  },
                ]
              : [],
            text: req.procedureSummary ?? req.packageCode ?? "Preauthorization request",
          },
          unitPrice: {
            value: req.requestedAmount,
            currency: "INR",
          },
          net: {
            value: req.requestedAmount,
            currency: "INR",
          },
        });
      }

      // Supporting info for clinical notes
      const supportingInfo: any[] = [];
      if (req.clinicalNotes) {
        supportingInfo.push({
          sequence: 1,
          category: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/claiminformationcategory",
                code: "info",
                display: "Information",
              },
            ],
          },
          valueString: req.clinicalNotes,
        });
      }

      const claimResource: any = {
        resource: {
          resourceType: "Claim",
          id: `claim-pa-${Date.now()}`,
          status: "active",
          type: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/claim-type",
                code: "institutional",
                display: "Institutional",
              },
            ],
          },
          use: "preauthorization",
          patient: {
            reference: `Patient/${patientEntry.resource.id}`,
            display: req.patientName,
          },
          created: new Date().toISOString(),
          provider: {
            identifier: {
              system: "https://hcx.org/participant",
              value: this.config.participantCode,
            },
          },
          priority: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/processpriority",
                code: "normal",
              },
            ],
          },
          insurance: [
            {
              sequence: 1,
              focal: true,
              coverage: {
                reference: `Coverage/${coverageEntry.resource.id}`,
              },
            },
          ],
          total: {
            value: req.requestedAmount,
            currency: "INR",
          },
          ...(claimItems.length > 0 ? { item: claimItems } : {}),
          ...(supportingInfo.length > 0 ? { supportingInfo } : {}),
        },
      };

      const documentEntries = this.buildDocumentReferences(req.documents);

      // Build FHIR Bundle
      const fhirBundle = {
        resourceType: "Bundle",
        id: `bundle-pa-${Date.now()}`,
        type: "collection",
        timestamp: new Date().toISOString(),
        entry: [
          patientEntry,
          coverageEntry,
          claimResource,
          ...documentEntries,
        ],
      };

      // Wrap in HCX protocol envelope
      const envelope = this.buildHcxProtocolEnvelope(fhirBundle, req.payerCode);

      // Submit to HCX gateway
      const response = await this.hcxPost("/v0.7/preauth/submit", envelope);

      const correlationId =
        response?.["x-hcx-correlation_id"] ??
        response?.correlation_id ??
        envelope["x-hcx-correlation_id"];

      this.logger.log(
        `HCX preauth submitted for preauthId=${req.preauthId}, correlationId=${correlationId}`,
      );

      return {
        success: true,
        externalRefId: correlationId,
        message: "HCX preauth submitted successfully",
        rawResponse: response,
      };
    } catch (err: any) {
      this.logger.error(`HCX preauth submission failed: ${err.message}`);
      return {
        success: false,
        message: err.message,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // getPreauthStatus — Poll HCX for ClaimResponse
  // ---------------------------------------------------------------------------

  async getPreauthStatus(refId: string): Promise<StatusResponse> {
    try {
      const payload = {
        "x-hcx-sender_code": this.config.senderCode ?? this.config.participantCode,
        "x-hcx-correlation_id": refId,
        "x-hcx-status": "request.status",
      };

      const response = await this.hcxPost("/v0.7/preauth/on_check", payload);

      return this.parseClaimResponse(response, "PREAUTH");
    } catch (err: any) {
      this.logger.error(`HCX preauth status check failed for refId=${refId}: ${err.message}`);
      return {
        status: "PENDING",
        message: `HCX preauth status check failed: ${err.message}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // submitClaim — Build FHIR Claim Bundle (use: claim)
  // ---------------------------------------------------------------------------

  async submitClaim(req: ClaimSubmission): Promise<GatewayResponse> {
    try {
      const patientEntry = this.buildPatientResource(req.patientName);
      const coverageEntry = this.buildCoverageResource(
        req.policyNumber,
        req.memberId,
        req.payerCode,
      );

      // Build Claim.item[] from line items
      const claimItems = req.lineItems.map((li, idx) => ({
        sequence: idx + 1,
        productOrService: {
          coding: li.hsnSac
            ? [
                {
                  system: "https://hcx.org/hsn-sac",
                  code: li.hsnSac,
                  display: li.description,
                },
              ]
            : [],
          text: li.description,
        },
        quantity: {
          value: li.quantity,
        },
        unitPrice: {
          value: li.unitPrice,
          currency: "INR",
        },
        net: {
          value: li.totalPrice,
          currency: "INR",
        },
      }));

      const claimResource: any = {
        resource: {
          resourceType: "Claim",
          id: `claim-cl-${Date.now()}`,
          status: "active",
          type: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/claim-type",
                code: "institutional",
                display: "Institutional",
              },
            ],
          },
          use: "claim",
          patient: {
            reference: `Patient/${patientEntry.resource.id}`,
            display: req.patientName,
          },
          created: new Date().toISOString(),
          provider: {
            identifier: {
              system: "https://hcx.org/participant",
              value: this.config.participantCode,
            },
          },
          priority: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/processpriority",
                code: "normal",
              },
            ],
          },
          insurance: [
            {
              sequence: 1,
              focal: true,
              coverage: {
                reference: `Coverage/${coverageEntry.resource.id}`,
              },
            },
          ],
          total: {
            value: req.totalAmount,
            currency: "INR",
          },
          item: claimItems,
        },
      };

      const documentEntries = this.buildDocumentReferences(req.documents);

      // Build FHIR Bundle
      const fhirBundle = {
        resourceType: "Bundle",
        id: `bundle-cl-${Date.now()}`,
        type: "collection",
        timestamp: new Date().toISOString(),
        entry: [
          patientEntry,
          coverageEntry,
          claimResource,
          ...documentEntries,
        ],
      };

      // Wrap in HCX protocol envelope
      const envelope = this.buildHcxProtocolEnvelope(fhirBundle, req.payerCode);

      // Submit to HCX gateway
      const response = await this.hcxPost("/v0.7/claim/submit", envelope);

      const correlationId =
        response?.["x-hcx-correlation_id"] ??
        response?.correlation_id ??
        envelope["x-hcx-correlation_id"];

      this.logger.log(
        `HCX claim submitted for claimId=${req.claimId}, correlationId=${correlationId}`,
      );

      return {
        success: true,
        externalRefId: correlationId,
        message: "HCX claim submitted successfully",
        rawResponse: response,
      };
    } catch (err: any) {
      this.logger.error(`HCX claim submission failed: ${err.message}`);
      return {
        success: false,
        message: err.message,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // getClaimStatus — Poll HCX for ClaimResponse
  // ---------------------------------------------------------------------------

  async getClaimStatus(refId: string): Promise<StatusResponse> {
    try {
      const payload = {
        "x-hcx-sender_code": this.config.senderCode ?? this.config.participantCode,
        "x-hcx-correlation_id": refId,
        "x-hcx-status": "request.status",
      };

      const response = await this.hcxPost("/v0.7/claim/on_check", payload);

      return this.parseClaimResponse(response, "CLAIM");
    } catch (err: any) {
      this.logger.error(`HCX claim status check failed for refId=${refId}: ${err.message}`);
      return {
        status: "PENDING",
        message: `HCX claim status check failed: ${err.message}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // checkCoverage — Build FHIR CoverageEligibilityRequest
  // ---------------------------------------------------------------------------

  async checkCoverage(req: CoverageCheckRequest): Promise<CoverageCheckResponse> {
    try {
      const patientEntry = this.buildPatientResource("Patient");
      const coverageEntry = this.buildCoverageResource(
        req.policyNumber,
        req.memberId,
        req.payerCode,
      );

      const eligibilityRequest: any = {
        resource: {
          resourceType: "CoverageEligibilityRequest",
          id: `cer-${Date.now()}`,
          status: "active",
          purpose: ["validation", "benefits"],
          patient: {
            reference: `Patient/${patientEntry.resource.id}`,
          },
          created: new Date().toISOString(),
          insurer: {
            identifier: {
              system: "https://hcx.org/participant",
              value: req.payerCode,
            },
          },
          insurance: [
            {
              coverage: {
                reference: `Coverage/${coverageEntry.resource.id}`,
              },
            },
          ],
          ...(req.serviceCode
            ? {
                item: [
                  {
                    category: {
                      coding: [
                        {
                          system: "https://hcx.org/service",
                          code: req.serviceCode,
                        },
                      ],
                    },
                  },
                ],
              }
            : {}),
        },
      };

      const fhirBundle = {
        resourceType: "Bundle",
        id: `bundle-cer-${Date.now()}`,
        type: "collection",
        timestamp: new Date().toISOString(),
        entry: [patientEntry, coverageEntry, eligibilityRequest],
      };

      const envelope = this.buildHcxProtocolEnvelope(fhirBundle, req.payerCode);

      const response = await this.hcxPost(
        "/v0.7/coverageeligibility/check",
        envelope,
      );

      // Parse CoverageEligibilityResponse from the response
      const eligibilityResponse = this.extractResourceFromResponse(
        response,
        "CoverageEligibilityResponse",
      );

      if (!eligibilityResponse) {
        // If we got a successful response but can't parse it, treat as eligible
        return {
          isEligible: true,
          message: "HCX coverage check returned a response (parsed as eligible)",
          rawResponse: response,
        };
      }

      // Check if any insurance item indicates inforce=true
      const isEligible =
        eligibilityResponse.insurance?.some((ins: any) => ins.inforce === true) ??
        true;

      // Try to extract remaining balance
      const benefit = eligibilityResponse.insurance?.[0]?.item?.[0]?.benefit?.[0];
      const remainingBalance = benefit?.allowedMoney?.value ?? undefined;

      return {
        isEligible,
        remainingBalance,
        message: isEligible
          ? "Coverage is active and eligible"
          : "Coverage is not eligible",
        rawResponse: response,
      };
    } catch (err: any) {
      this.logger.error(`HCX coverage check failed: ${err.message}`);
      return {
        isEligible: false,
        message: `HCX coverage check failed: ${err.message}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Response Parsers
  // ---------------------------------------------------------------------------

  /**
   * Extract a FHIR resource of a given type from an HCX response.
   * The response may contain a FHIR Bundle in `payload` or directly as JSON.
   */
  private extractResourceFromResponse(
    response: any,
    resourceType: string,
  ): any | null {
    // Direct resource
    if (response?.resourceType === resourceType) return response;

    // Inside payload Bundle
    const bundle = response?.payload ?? response;
    if (bundle?.resourceType === "Bundle" && Array.isArray(bundle.entry)) {
      const entry = bundle.entry.find(
        (e: any) => e?.resource?.resourceType === resourceType,
      );
      return entry?.resource ?? null;
    }

    return null;
  }

  /**
   * Parse a ClaimResponse from HCX to our StatusResponse format.
   * Handles both preauth and claim status responses.
   */
  private parseClaimResponse(
    response: any,
    entityType: "PREAUTH" | "CLAIM",
  ): StatusResponse {
    const claimResponse = this.extractResourceFromResponse(
      response,
      "ClaimResponse",
    );

    if (!claimResponse) {
      // No ClaimResponse yet — still pending
      const hcxStatus =
        response?.["x-hcx-status"] ?? response?.status ?? "response.pending";

      if (
        hcxStatus === "response.error" ||
        hcxStatus === "response.redirect"
      ) {
        return {
          status: "ERROR",
          message: response?.error?.message ?? `HCX returned status: ${hcxStatus}`,
          rawResponse: response,
        };
      }

      return {
        status: "PENDING",
        message: `Awaiting ${entityType.toLowerCase()} response from payer`,
        rawResponse: response,
      };
    }

    // Map FHIR ClaimResponse.outcome to our status
    const outcome = claimResponse.outcome; // "queued" | "complete" | "error" | "partial"
    const disposition = claimResponse.disposition; // human-readable reason

    // Extract approved amount from adjudication or total
    let approvedAmount: number | undefined;
    let rejectionReason: string | undefined;
    const deductions: Array<{ code: string; amount: number; reason: string }> = [];

    // Check ClaimResponse.total
    if (claimResponse.total) {
      for (const totalItem of claimResponse.total) {
        if (totalItem.category?.coding?.[0]?.code === "benefit") {
          approvedAmount = totalItem.amount?.value;
        }
      }
    }

    // Check adjudication items for deductions
    if (claimResponse.item) {
      for (const item of claimResponse.item) {
        if (item.adjudication) {
          for (const adj of item.adjudication) {
            const adjCode = adj.category?.coding?.[0]?.code;
            if (adjCode === "benefit" && !approvedAmount) {
              approvedAmount = adj.amount?.value;
            }
            if (adjCode === "deductible" || adjCode === "copay" || adjCode === "non-payable") {
              deductions.push({
                code: adjCode,
                amount: adj.amount?.value ?? 0,
                reason: adj.reason?.text ?? adj.category?.coding?.[0]?.display ?? adjCode,
              });
            }
          }
        }
      }
    }

    // Map outcome to status
    let status: string;
    switch (outcome) {
      case "complete":
        if (deductions.length > 0 && entityType === "CLAIM") {
          status = "PARTIALLY_APPROVED";
        } else {
          status = "APPROVED";
        }
        break;
      case "error":
        status = "REJECTED";
        rejectionReason = disposition ?? "Claim rejected by payer";
        break;
      case "partial":
        status = "PARTIALLY_APPROVED";
        break;
      case "queued":
        status = "PENDING";
        break;
      default:
        status = "PENDING";
    }

    // Check for explicit error codes in processNote
    if (claimResponse.processNote) {
      for (const note of claimResponse.processNote) {
        if (note.type === "display" && note.text) {
          if (!rejectionReason) {
            rejectionReason = note.text;
          }
        }
      }
    }

    return {
      status,
      approvedAmount,
      rejectionReason,
      deductions: deductions.length > 0 ? deductions : undefined,
      message: disposition ?? `HCX ${entityType.toLowerCase()} ${status.toLowerCase()}`,
      rawResponse: response,
    };
  }
}
