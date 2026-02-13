import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { ClaimsGatewayModule } from "./claims-gateway/claims-gateway.module";
import { ReconciliationModule } from "./reconciliation/reconciliation.module";
import { InsurancePolicyModule } from "./insurance-policies/insurance-policy.module";
import { PayerIntegrationModule } from "./payer-integration/payer-integration.module";
import { InsuranceDocumentModule } from "./insurance-documents/insurance-document.module";
import { InsuranceCaseModule } from "./insurance-cases/insurance-case.module";
import { PreauthModule } from "./preauth/preauth.module";
import { ClaimModule } from "./claims/claim.module";
import { DocumentChecklistModule } from "./document-checklist/document-checklist.module";

@Module({
  imports: [
    AuditModule,
    AuthModule,
    ClaimsGatewayModule,
    ReconciliationModule,
    InsurancePolicyModule,
    PayerIntegrationModule,
    InsuranceDocumentModule,
    InsuranceCaseModule,
    PreauthModule,
    ClaimModule,
    DocumentChecklistModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
