import { Module } from "@nestjs/common";
import { StatutoryController } from "./statutory.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [StatutoryController],
})
export class StatutoryModule {}
