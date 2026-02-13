// ---------------------------------------------------------------------------
// Claims Gateway Poller — automated cron job to poll pending submissions
// Runs every 10 minutes to check status of SUBMITTED preauths/claims
// ---------------------------------------------------------------------------
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ClaimsGatewayService } from "./claims-gateway.service";

@Injectable()
export class ClaimsGatewayPollerService {
  private readonly logger = new Logger(ClaimsGatewayPollerService.name);
  private isRunning = false;

  constructor(private readonly gateway: ClaimsGatewayService) {}

  /**
   * Runs every 10 minutes to poll for status updates on pending submissions.
   * Skips if a previous poll cycle is still running (prevents overlap).
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async pollPendingSubmissions() {
    if (this.isRunning) {
      this.logger.debug("Poller already running, skipping this cycle");
      return;
    }

    this.isRunning = true;
    try {
      this.logger.debug("Starting gateway status poll cycle...");
      const result = await this.gateway.pollPendingSubmissions();

      if (result.preauths > 0 || result.claims > 0) {
        this.logger.log(
          `Poll cycle complete: ${result.preauths} preauth(s) updated, ${result.claims} claim(s) updated`,
        );
      } else {
        this.logger.debug("Poll cycle complete: no updates");
      }
    } catch (err: any) {
      this.logger.error(`Poll cycle failed: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
