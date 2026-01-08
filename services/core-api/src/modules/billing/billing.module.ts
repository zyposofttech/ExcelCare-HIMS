import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [BillingController],
})
export class BillingModule {}
