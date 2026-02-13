import { Module } from "@nestjs/common";
import { InfraSharedModule } from "../../infrastructure/shared/infra-shared.module";
import { PayerIntegrationController } from "./payer-integration.controller";
import { PayerIntegrationService } from "./payer-integration.service";

@Module({
  imports: [InfraSharedModule],
  controllers: [PayerIntegrationController],
  providers: [PayerIntegrationService],
  exports: [PayerIntegrationService],
})
export class PayerIntegrationModule {}
