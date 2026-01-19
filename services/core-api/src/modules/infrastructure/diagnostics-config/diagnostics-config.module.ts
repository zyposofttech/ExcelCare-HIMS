import { Module } from "@nestjs/common";
import { DiagnosticsConfigController } from "./diagnostics-config.controller";
import { DiagnosticsConfigService } from "./diagnostics-config.service";

@Module({
  controllers: [DiagnosticsConfigController],
  providers: [DiagnosticsConfigService],
  exports: [DiagnosticsConfigService],
})
export class DiagnosticsConfigModule {}
