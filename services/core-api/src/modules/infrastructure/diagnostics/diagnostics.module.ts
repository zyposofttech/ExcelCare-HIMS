import { Module } from "@nestjs/common";

import { DiagnosticsConfigController } from "./diagnostics-config.controller";
import { DiagnosticsConfigService } from "./diagnostics-config.service";

import { DiagnosticsFacilitiesController } from "./diagnostics-facilities.controller";
import { DiagnosticsFacilitiesService } from "./diagnostics-facilities.service";

import { DiagnosticsTemplatesController } from "./diagnostics-templates.controller";
import { DiagnosticsTemplatesService } from "./diagnostics-templates.service";

import { DiagnosticsCapabilitiesController } from "./diagnostics-capabilities.controller";
import { DiagnosticsCapabilitiesService } from "./diagnostics-capabilities.service";
import { DiagnosticsPacksController } from "./diagnostics-packs.controller";
import { DiagnosticsPacksService } from "./diagnostics-packs.service";

/**
 * Infrastructure → Diagnostics
 *
 * Scope: configuration + facilities/resources + templates + capabilities.
 * No operational workflow, and no charge master mapping (charges are handled in Charge Master module).
 */
@Module({
  controllers: [
    DiagnosticsConfigController,
    DiagnosticsFacilitiesController,
    DiagnosticsTemplatesController,
    DiagnosticsCapabilitiesController,
    DiagnosticsPacksController,
  ],
  providers: [
    DiagnosticsConfigService,
    DiagnosticsFacilitiesService,
    DiagnosticsTemplatesService,
    DiagnosticsCapabilitiesService,
    DiagnosticsPacksService,
  ],
  exports: [
    DiagnosticsConfigService,
    DiagnosticsFacilitiesService,
    DiagnosticsTemplatesService,
    DiagnosticsCapabilitiesService,
    DiagnosticsPacksService,
  ],
})
export class DiagnosticsModule {}
