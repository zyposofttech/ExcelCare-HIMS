// ---------------------------------------------------------------------------
// Reconciliation Module
// ---------------------------------------------------------------------------
import { Module } from "@nestjs/common";
import { InfraSharedModule } from "../../infrastructure/shared/infra-shared.module";
import { ReconciliationService } from "./reconciliation.service";
import { ReconciliationController } from "./reconciliation.controller";

@Module({
  imports: [InfraSharedModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
