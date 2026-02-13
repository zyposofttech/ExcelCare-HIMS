// ---------------------------------------------------------------------------
// SFTP Batch adapter — generates EDI/CSV batch files and uploads via SFTP
// Config: sftpHost, sftpPort, sftpPath, sftpAuthConfig (from PayerIntegrationConfig)
// Uses ssh2-sftp-client if available, otherwise falls back to file generation only.
// ---------------------------------------------------------------------------
import { Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type {
  IClaimsGatewayAdapter,
  PreauthSubmission,
  ClaimSubmission,
  GatewayResponse,
  StatusResponse,
  CoverageCheckRequest,
  CoverageCheckResponse,
} from "../claims-gateway.interface";

export interface SftpConfig {
  sftpHost?: string | null;
  sftpPort?: number | null;
  sftpPath?: string | null;
  sftpAuthConfig?: any; // { username, password, privateKey }
}

export class SftpAdapter implements IClaimsGatewayAdapter {
  readonly mode = "SFTP_BATCH";
  private readonly logger = new Logger(SftpAdapter.name);

  constructor(private readonly config: SftpConfig = {}) {}

  // ---------------------------------------------------------------------------
  // Batch File Generators
  // ---------------------------------------------------------------------------

  /**
   * Build a pipe-delimited batch record for a preauth submission.
   * Format: PREAUTH|<preauthId>|<policyNumber>|<memberId>|<payerCode>|<patientName>|<amount>|<packageCode>|<procedure>|<notes>
   */
  private buildPreauthBatchRecord(req: PreauthSubmission): string {
    const header = [
      "BATCH_TYPE",
      "PREAUTH_ID",
      "POLICY_NUMBER",
      "MEMBER_ID",
      "PAYER_CODE",
      "PATIENT_NAME",
      "REQUESTED_AMOUNT",
      "PACKAGE_CODE",
      "PROCEDURE_SUMMARY",
      "CLINICAL_NOTES",
    ].join("|");

    const record = [
      "PREAUTH",
      req.preauthId,
      req.policyNumber,
      req.memberId,
      req.payerCode,
      this.sanitize(req.patientName),
      req.requestedAmount.toFixed(2),
      req.packageCode ?? "",
      this.sanitize(req.procedureSummary ?? ""),
      this.sanitize(req.clinicalNotes ?? ""),
    ].join("|");

    return `${header}\n${record}\n`;
  }

  /**
   * Build a pipe-delimited batch file for a claim submission.
   * Contains a header record followed by line item records.
   */
  private buildClaimBatchRecord(req: ClaimSubmission): string {
    const lines: string[] = [];

    // Header record
    const headerFields = [
      "BATCH_TYPE",
      "CLAIM_ID",
      "CLAIM_NUMBER",
      "CLAIM_TYPE",
      "POLICY_NUMBER",
      "MEMBER_ID",
      "PAYER_CODE",
      "PATIENT_NAME",
      "TOTAL_AMOUNT",
      "LINE_COUNT",
    ];
    lines.push(headerFields.join("|"));

    const headerRecord = [
      "CLAIM_HEADER",
      req.claimId,
      req.claimNumber,
      req.claimType,
      req.policyNumber,
      req.memberId,
      req.payerCode,
      this.sanitize(req.patientName),
      req.totalAmount.toFixed(2),
      req.lineItems.length.toString(),
    ];
    lines.push(headerRecord.join("|"));

    // Line item records
    if (req.lineItems.length > 0) {
      const liHeader = [
        "BATCH_TYPE",
        "CLAIM_ID",
        "LINE_SEQ",
        "DESCRIPTION",
        "QUANTITY",
        "UNIT_PRICE",
        "TOTAL_PRICE",
        "HSN_SAC",
      ];
      lines.push(liHeader.join("|"));

      for (let i = 0; i < req.lineItems.length; i++) {
        const li = req.lineItems[i];
        const liRecord = [
          "CLAIM_LINE",
          req.claimId,
          (i + 1).toString(),
          this.sanitize(li.description),
          li.quantity.toString(),
          li.unitPrice.toFixed(2),
          li.totalPrice.toFixed(2),
          li.hsnSac ?? "",
        ];
        lines.push(liRecord.join("|"));
      }
    }

    return lines.join("\n") + "\n";
  }

  /** Sanitize pipe-delimited fields: remove pipes and newlines */
  private sanitize(value: string): string {
    return value.replace(/[|\n\r]/g, " ").trim();
  }

  // ---------------------------------------------------------------------------
  // SFTP Upload
  // ---------------------------------------------------------------------------

  /**
   * Attempt to upload a file via SFTP using ssh2-sftp-client.
   * Falls back gracefully if the library is not installed.
   */
  private async uploadViaSftp(
    localPath: string,
    remotePath: string,
  ): Promise<{ uploaded: boolean; error?: string }> {
    if (!this.config.sftpHost) {
      return { uploaded: false, error: "SFTP host not configured" };
    }

    try {
      // Dynamically require ssh2-sftp-client (optional dependency)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const SftpClient = require("ssh2-sftp-client") as any;
      const sftp = new SftpClient();

      const authCfg = this.config.sftpAuthConfig ?? {};

      await sftp.connect({
        host: this.config.sftpHost,
        port: this.config.sftpPort ?? 22,
        username: authCfg.username ?? "sftp",
        password: authCfg.password ?? undefined,
        privateKey: authCfg.privateKey
          ? Buffer.from(authCfg.privateKey, "utf-8")
          : undefined,
      });

      await sftp.put(localPath, remotePath);
      await sftp.end();

      this.logger.log(`SFTP upload successful: ${remotePath}`);
      return { uploaded: true };
    } catch (err: any) {
      // If ssh2-sftp-client is not installed, fall back to file-only mode
      if (
        err.code === "MODULE_NOT_FOUND" ||
        err.message?.includes("Cannot find module")
      ) {
        this.logger.warn(
          "ssh2-sftp-client not installed. Batch file generated locally only. Install with: pnpm add ssh2-sftp-client",
        );
        return {
          uploaded: false,
          error:
            "ssh2-sftp-client not installed. File generated locally — upload manually or install the package.",
        };
      }
      this.logger.error(`SFTP upload failed: ${err.message}`);
      return { uploaded: false, error: err.message };
    }
  }

  /**
   * Write batch content to a temp file and optionally upload via SFTP.
   */
  private async writeBatchAndUpload(
    content: string,
    filePrefix: string,
  ): Promise<{
    localPath: string;
    remotePath: string;
    uploaded: boolean;
    uploadError?: string;
  }> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    const fileName = `${filePrefix}_${timestamp}.txt`;

    // Write to temp directory
    const tmpDir = path.join(os.tmpdir(), "zypocare-sftp-batches");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const localPath = path.join(tmpDir, fileName);
    fs.writeFileSync(localPath, content, "utf-8");

    // Attempt SFTP upload
    const remotePath = `${this.config.sftpPath ?? "/uploads"}/${fileName}`;
    const uploadResult = await this.uploadViaSftp(localPath, remotePath);

    return {
      localPath,
      remotePath,
      uploaded: uploadResult.uploaded,
      uploadError: uploadResult.error,
    };
  }

  // ---------------------------------------------------------------------------
  // submitPreauth
  // ---------------------------------------------------------------------------

  async submitPreauth(req: PreauthSubmission): Promise<GatewayResponse> {
    try {
      const batchContent = this.buildPreauthBatchRecord(req);
      const result = await this.writeBatchAndUpload(
        batchContent,
        `PREAUTH_${req.preauthId}`,
      );

      const trackingRef = `PA-SFTP-${Date.now().toString(36).toUpperCase()}`;

      this.logger.log(
        `SFTP preauth batch generated for preauthId=${req.preauthId}, localPath=${result.localPath}, uploaded=${result.uploaded}`,
      );

      return {
        success: true,
        externalRefId: trackingRef,
        message: result.uploaded
          ? `Preauth batch file uploaded to SFTP: ${result.remotePath}`
          : `Preauth batch file generated at: ${result.localPath}. ${result.uploadError ?? ""}`,
        rawResponse: {
          trackingRef,
          localPath: result.localPath,
          remotePath: result.remotePath,
          uploaded: result.uploaded,
          uploadError: result.uploadError,
        },
      };
    } catch (err: any) {
      this.logger.error(`SFTP preauth batch generation failed: ${err.message}`);
      return {
        success: false,
        message: `SFTP batch generation failed: ${err.message}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // submitClaim
  // ---------------------------------------------------------------------------

  async submitClaim(req: ClaimSubmission): Promise<GatewayResponse> {
    try {
      const batchContent = this.buildClaimBatchRecord(req);
      const result = await this.writeBatchAndUpload(
        batchContent,
        `CLAIM_${req.claimId}`,
      );

      const trackingRef = `CL-SFTP-${Date.now().toString(36).toUpperCase()}`;

      this.logger.log(
        `SFTP claim batch generated for claimId=${req.claimId}, localPath=${result.localPath}, uploaded=${result.uploaded}`,
      );

      return {
        success: true,
        externalRefId: trackingRef,
        message: result.uploaded
          ? `Claim batch file uploaded to SFTP: ${result.remotePath}`
          : `Claim batch file generated at: ${result.localPath}. ${result.uploadError ?? ""}`,
        rawResponse: {
          trackingRef,
          localPath: result.localPath,
          remotePath: result.remotePath,
          uploaded: result.uploaded,
          uploadError: result.uploadError,
        },
      };
    } catch (err: any) {
      this.logger.error(`SFTP claim batch generation failed: ${err.message}`);
      return {
        success: false,
        message: `SFTP batch generation failed: ${err.message}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // getPreauthStatus — SFTP batch responses are typically polled from a response dir
  // ---------------------------------------------------------------------------

  async getPreauthStatus(refId: string): Promise<StatusResponse> {
    if (!this.config.sftpHost) {
      return {
        status: "UNKNOWN",
        message: `SFTP host not configured. Check batch response files manually. Reference: ${refId}`,
      };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const SftpClient = require("ssh2-sftp-client") as any;
      const sftp = new SftpClient();
      const authCfg = this.config.sftpAuthConfig ?? {};

      await sftp.connect({
        host: this.config.sftpHost,
        port: this.config.sftpPort ?? 22,
        username: authCfg.username ?? "sftp",
        password: authCfg.password ?? undefined,
        privateKey: authCfg.privateKey
          ? Buffer.from(authCfg.privateKey, "utf-8")
          : undefined,
      });

      // Look for response files matching the reference
      const responsePath = `${this.config.sftpPath ?? "/responses"}`;
      const listing = await sftp.list(responsePath);
      const matchingFiles = listing.filter(
        (f: any) =>
          f.name.includes(refId) ||
          f.name.includes("RESPONSE") ||
          f.name.includes("ACK"),
      );

      await sftp.end();

      if (matchingFiles.length === 0) {
        return {
          status: "PENDING",
          message: `No response file found yet for reference: ${refId}. Awaiting payer batch response.`,
        };
      }

      return {
        status: "RESPONSE_AVAILABLE",
        message: `Found ${matchingFiles.length} response file(s) for reference: ${refId}. Parse the response file to update status.`,
        rawResponse: {
          responseFiles: matchingFiles.map((f: any) => f.name),
        },
      };
    } catch (err: any) {
      if (
        err.code === "MODULE_NOT_FOUND" ||
        err.message?.includes("Cannot find module")
      ) {
        return {
          status: "UNKNOWN",
          message: `ssh2-sftp-client not installed. Check SFTP server manually for response to: ${refId}`,
        };
      }
      this.logger.error(`SFTP status poll failed for refId=${refId}: ${err.message}`);
      return {
        status: "PENDING",
        message: `SFTP status check failed: ${err.message}`,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // getClaimStatus — same pattern as preauth
  // ---------------------------------------------------------------------------

  async getClaimStatus(refId: string): Promise<StatusResponse> {
    // Re-use the same SFTP polling logic
    return this.getPreauthStatus(refId);
  }

  // ---------------------------------------------------------------------------
  // checkCoverage — not supported in batch SFTP mode
  // ---------------------------------------------------------------------------

  async checkCoverage(req: CoverageCheckRequest): Promise<CoverageCheckResponse> {
    return {
      isEligible: false,
      message: `SFTP batch mode does not support real-time coverage checks. Verify coverage for policy ${req.policyNumber} (member ${req.memberId}) through alternate channels.`,
    };
  }
}
