import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PolicyEngineModule } from "../policy-engine/policy-engine.module";
import { InfrastructureSeedService } from "./infrastructure.seed";

import { InfraContextService } from "./shared/infra-context.service";

import { LocationController } from "./location/location.controller";
import { LocationService } from "./location/location.service";

import { UnitTypesController } from "./unit-types/unit-types.controller";
import { UnitTypesService } from "./unit-types/unit-types.service";

import { UnitsController } from "./units/units.controller";
import { UnitsService } from "./units/units.service";

import { RoomsController } from "./rooms/rooms.controller";
import { RoomsService } from "./rooms/rooms.service";

import { ResourcesController } from "./resources/resources.controller";
import { ResourcesService } from "./resources/resources.service";

import { BranchConfigController } from "./branch-config/branch-config.controller";
import { BranchConfigService } from "./branch-config/branch-config.service";

import { EquipmentController } from "./equipment/equipment.controller";
import { EquipmentService } from "./equipment/equipment.service";

import { ChargeMasterController } from "./charge-master/charge-master.controller";
import { ChargeMasterService } from "./charge-master/charge-master.service";

import { ServiceItemsController } from "./service-items/service-items.controller";
import { ServiceItemsService } from "./service-items/service-items.service";
import { ServiceChargeMappingController } from "./service-items/service-charge-mapping.controller";
import { ServiceChargeMappingService } from "./service-items/service-charge-mapping.service";

import { FixItController } from "./fixit/fixit.controller";
import { FixItService } from "./fixit/fixit.service";

import { SchedulingController } from "./scheduling/scheduling.controller";
import { SchedulingService } from "./scheduling/scheduling.service";

import { ImportController } from "./import/import.controller";
import { ImportService } from "./import/import.service";

import { GoLiveController } from "./golive/golive.controller";
import { GoLiveService } from "./golive/golive.service";

import { DiagnosticsConfigController } from "./diagnostics-config/diagnostics-config.controller";
import { DiagnosticsConfigService } from "./diagnostics-config/diagnostics-config.service";

@Module({
  imports: [AuditModule, AuthModule, PolicyEngineModule],
  controllers: [
    LocationController,
    UnitTypesController,
    UnitsController,
    RoomsController,
    ResourcesController,
    BranchConfigController,
    EquipmentController,
    ChargeMasterController,
    ServiceItemsController,
    ServiceChargeMappingController,
    FixItController,
    SchedulingController,
    ImportController,
    GoLiveController,
    DiagnosticsConfigController,
  ],
  providers: [
    InfraContextService,
    LocationService,
    UnitTypesService,
    UnitsService,
    RoomsService,
    ResourcesService,
    BranchConfigService,
    EquipmentService,
    ChargeMasterService,
    ServiceChargeMappingService,
    DiagnosticsConfigService,
    ServiceItemsService,
    FixItService,
    SchedulingService,
    ImportService,
    GoLiveService,
    InfrastructureSeedService,
  ],
})
export class InfrastructureModule {}
