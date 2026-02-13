// ---------------------------------------------------------------------------
// Direct API adapter — generic payer REST API integration
// Each payer's integration config provides: apiBaseUrl, apiAuthMethod, apiAuthConfig
// Supported auth methods: BEARER, BASIC, API_KEY, OAUTH2
// The adapter sends JSON payloads to payer-specific REST endpoints.
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

export interface DirectApiConfig {
  apiBaseUrl: string;
  apiAuthMethod?: string | null; // "BEARER" | "BASIC" | "API_KEY" | "OAUTH2"
  apiAuthConfig?: any; // { token, username, password, apiKey, headerName, clientId, clientSecret, tokenUrl }
}

export class DirectApiAdapter implements IClaimsGatewayAdapter {
  readonly mode = "DIRECT_API";
  private readonly logger = new Logger(DirectApiAdapter.name);
  private oauthToken: string | null = null;
  private oauthExpiresAt = 0;

  constructor(private readonly config: DirectApiConfig = { apiBaseUrl: "" }) {}

  // ---------------------------------------------------------------------------
  // Auth — builds authorization headers based on configured method
  // ---------------------------------------------------------------------------

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const method = (this.config.apiAuthMethod ?? "").toUpperCase();
    const cfg = this.config.apiAuthConfig ?? {};

    switch (method) {
      case "BEARER":
        return { Authorization: `Bearer ${cfg.token ?? ""}` };

      case "BASIC": {
        const creds = Buffer.from(`${cfg.username ?? ""}:${cfg.password ?? ""}`).toString("base64");
        return { Authorization: `Basic ${creds}` };
      }

      case "API_KEY": {
        const headerName = cfg.headerName ?? "X-API-Key";
        return { [headerName]: cfg.apiKey ?? "" };
      }

      case "OAUTH2": {
        const token = await this.ensureOAuthToken(cfg);
        return { Authorization: `Bearer ${token}` };
      }

      default:
        return {};
    }
  }

  private async ensureOAuthToken(cfg: any): Promise<string> {
    if (this.oauthToken && Date.now() < this.oauthExpiresAt) {
      return this.oauthToken;
    }

    const tokenUrl = cfg.tokenUrl ?? `${this.config.apiBaseUrl}/oauth/token`;
    const body = new URLSearchParams();
    body.append("grant_type", "client_credentials");
    body.append("client_id", cfg.clientId ?? "");
    body.append("client_secret", cfg.clientSecret ?? "");

    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OAuth2 token request failed (${resp.status}): ${text}`);
    }

    const json = await resp.json();
    this.oauthToken = json.access_token ?? json.token;
    const expiresIn = (json.expires_in ?? 3000) * 1000;
    this.oauthExpiresAt = Date.now() + expiresIn - 60_000;
    return this.oauthToken!;
  }

  // ---------------------------------------------------------------------------
  // HTTP helper
  // ---------------------------------------------------------------------------

  private async apiPost(path: string, payload: any): Promise<any> {
    const authHeaders = await this.getAuthHeaders();
    const url = `${this.config.apiBaseUrl}${path}`;

    this.logger.debug(`Direct API POST ${url}`);

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
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
        `Direct API request failed (${resp.status}): ${parsed?.error?.message ?? parsed?.message ?? responseBody}`,
      );
    }

    return parsed;
  }

  private async apiGet(path: string): Promise<any> {
    const authHeaders = await this.getAuthHeaders();
    const url = `${this.config.apiBaseUrl}${path}`;

    this.logger.debug(`Direct API GET ${url}`);

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...authHeaders,
      },
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
        `Direct API request failed (${resp.status}): ${parsed?.error?.message ?? parsed?.message ?? responseBody}`,
      );
    }

    return parsed;
  }

  // ---------------------------------------------------------------------------
  // submitPreauth
  // ---------------------------------------------------------------------------

  async submitPreauth(req: PreauthSubmission): Promise<GatewayResponse> {
    if (!this.config.apiBaseUrl) {
      return {
        success: false,
        message: "Direct API adapter: apiBaseUrl not configured in PayerIntegrationConfig",
      };
    }

    try {
      const payload = {
        preauth_id: req.preauthId,
        insurance_case_id: req.insuranceCaseId,
        patient_name: req.patientName,
        policy_number: req.policyNumber,
        member_id: req.memberId,
        payer_code: req.payerCode,
        requested_amount: req.requestedAmount,
        package_code: req.packageCode ?? null,
        procedure_summary: req.procedureSummary ?? null,
        clinical_notes: req.clinicalNotes ?? null,
        documents: req.documents ?? [],
      };

      const response = await this.apiPost("/preauth/submit", payload);

      const externalRefId =
        response.reference_id ??
        response.referenceId ??
        response.tracking_id ??
        response.trackingId ??
        response.preauth_ref ??
        response.id;

      this.logger.log(
        `Direct API preauth submitted for preauthId=${req.preauthId}, externalRefId=${externalRefId}`,
      );

      return {
        success: true,
        externalRefId: externalRefId ?? undefined,
        message: response.message ?? "Preauth submitted via direct API",
        rawResponse: response,
      };
    } catch (err: any) {
      this.logger.error(`Direct API preauth submission failed: ${err.message}`);
      return {
        success: false,
        message: err.message,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // submitClaim
  // ---------------------------------------------------------------------------

  async submitClaim(req: ClaimSubmission): Promise<GatewayResponse> {
    if (!this.config.apiBaseUrl) {
      return {
        success: false,
        message: "Direct API adapter: apiBaseUrl not configured in PayerIntegrationConfig",
      };
    }

    try {
      const payload = {
        claim_id: req.claimId,
        claim_number: req.claimNumber,
        claim_type: req.claimType,
        insurance_case_id: req.insuranceCaseId,
        patient_name: req.patientName,
        policy_number: req.policyNumber,
        member_id: req.memberId,
        payer_code: req.payerCode,
        total_amount: req.totalAmount,
        line_items: req.lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unitPrice,
          total_price: li.totalPrice,
          hsn_sac: li.hsnSac ?? null,
        })),
        documents: req.documents ?? [],
      };

      const response = await this.apiPost("/claims/submit", payload);

      const externalRefId =
        response.reference_id ??
        response.referenceId ??
        response.tracking_id ??
        response.trackingId ??
        response.claim_ref ??
        response.id;

      this.logger.log(
        `Direct API claim submitted for claimId=${req.claimId}, externalRefId=${externalRefId}`,
      );

      return {
        success: true,
        externalRefId: externalRefId ?? undefined,
        message: response.message ?? "Claim submitted via direct API",
        rawResponse: response,
      };
    } catch (err: any) {
      this.logger.error(`Direct API claim submission failed: ${err.message}`);
      return {
        success: false,
        message: err.message,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // getPreauthStatus
  // ---------------------------------------------------------------------------

  async getPreauthStatus(refId: string): Promise<StatusResponse> {
    if (!this.config.apiBaseUrl) {
      return {
        status: "UNKNOWN",
        message: "Direct API adapter: apiBaseUrl not configured",
      };
    }

    try {
      const response = await this.apiGet(`/preauth/status/${encodeURIComponent(refId)}`);

      return {
        status: this.normalizeStatus(response.status ?? response.outcome ?? "PENDING"),
        message: response.message ?? response.disposition ?? undefined,
        approvedAmount: response.approved_amount ?? response.approvedAmount ?? undefined,
        rejectionReason: response.rejection_reason ?? response.rejectionReason ?? undefined,
        rawResponse: response,
      };
    } catch (err: any) {
      this.logger.error(`Direct API preauth status check failed for refId=${refId}: ${err.message}`);
      return {
        status: "PENDING",
        message: `Direct API status check failed: ${err.message}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // getClaimStatus
  // ---------------------------------------------------------------------------

  async getClaimStatus(refId: string): Promise<StatusResponse> {
    if (!this.config.apiBaseUrl) {
      return {
        status: "UNKNOWN",
        message: "Direct API adapter: apiBaseUrl not configured",
      };
    }

    try {
      const response = await this.apiGet(`/claims/status/${encodeURIComponent(refId)}`);

      // Parse deductions if present
      let deductions: Array<{ code: string; amount: number; reason: string }> | undefined;
      if (Array.isArray(response.deductions)) {
        deductions = response.deductions.map((d: any) => ({
          code: d.code ?? d.category ?? "DEDUCTION",
          amount: Number(d.amount ?? 0),
          reason: d.reason ?? d.description ?? "",
        }));
      }

      return {
        status: this.normalizeStatus(response.status ?? response.outcome ?? "PENDING"),
        message: response.message ?? response.disposition ?? undefined,
        approvedAmount: response.approved_amount ?? response.approvedAmount ?? undefined,
        rejectionReason: response.rejection_reason ?? response.rejectionReason ?? undefined,
        deductions,
        rawResponse: response,
      };
    } catch (err: any) {
      this.logger.error(`Direct API claim status check failed for refId=${refId}: ${err.message}`);
      return {
        status: "PENDING",
        message: `Direct API status check failed: ${err.message}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // checkCoverage
  // ---------------------------------------------------------------------------

  async checkCoverage(req: CoverageCheckRequest): Promise<CoverageCheckResponse> {
    if (!this.config.apiBaseUrl) {
      return {
        isEligible: false,
        message: "Direct API adapter: apiBaseUrl not configured",
      };
    }

    try {
      const payload = {
        policy_number: req.policyNumber,
        member_id: req.memberId,
        payer_code: req.payerCode,
        service_code: req.serviceCode ?? null,
      };

      const response = await this.apiPost("/coverage/check", payload);

      return {
        isEligible:
          response.is_eligible ?? response.isEligible ?? response.eligible ?? false,
        remainingBalance:
          response.remaining_balance ?? response.remainingBalance ?? undefined,
        message: response.message ?? (response.is_eligible ? "Coverage is active" : "Coverage not eligible"),
        rawResponse: response,
      };
    } catch (err: any) {
      this.logger.error(`Direct API coverage check failed: ${err.message}`);
      return {
        isEligible: false,
        message: `Direct API coverage check failed: ${err.message}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private normalizeStatus(raw: string): string {
    const s = raw.toUpperCase().replace(/[\s-]+/g, "_");
    // Map common variations to standard values
    const map: Record<string, string> = {
      APPROVED: "APPROVED",
      COMPLETE: "APPROVED",
      REJECTED: "REJECTED",
      DENIED: "REJECTED",
      ERROR: "REJECTED",
      PARTIAL: "PARTIALLY_APPROVED",
      PARTIALLY_APPROVED: "PARTIALLY_APPROVED",
      QUEUED: "PENDING",
      PENDING: "PENDING",
      IN_PROGRESS: "PENDING",
      UNDER_REVIEW: "PENDING",
      PAID: "PAID",
      SETTLED: "PAID",
      QUERY: "QUERY_RAISED",
      QUERY_RAISED: "QUERY_RAISED",
      ACKNOWLEDGED: "ACKNOWLEDGED",
    };
    return map[s] ?? s;
  }
}
