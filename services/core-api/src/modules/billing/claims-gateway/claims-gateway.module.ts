// ---------------------------------------------------------------------------
// Claims Gateway Module
// ---------------------------------------------------------------------------
import { Module } from "@nestjs/common";
import { InfraSharedModule } from "../../infrastructure/shared/infra-shared.module";
import { ClaimsGatewayService } from "./claims-gateway.service";
import { ClaimsGatewayController } from "./claims-gateway.controller";
import { ClaimsWebhookController } from "./webhook/claims-webhook.controller";
import { ClaimsGatewayPollerService } from "./claims-gateway-poller.service";

@Module({
  imports: [InfraSharedModule],
  controllers: [ClaimsGatewayController, ClaimsWebhookController],
  providers: [ClaimsGatewayService, ClaimsGatewayPollerService],
  exports: [ClaimsGatewayService],
})
export class ClaimsGatewayModule {}
