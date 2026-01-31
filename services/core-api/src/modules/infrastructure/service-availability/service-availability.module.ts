import { Module } from "@nestjs/common";
import { InfraSharedModule } from "../shared/infra-shared.module";
import { ServiceAvailabilityController } from "./service-availability.controller";
import { ServiceAvailabilityService } from "./service-availability.service";

@Module({
  imports: [InfraSharedModule],
  controllers: [ServiceAvailabilityController],
  providers: [ServiceAvailabilityService],
  exports: [ServiceAvailabilityService],
})
export class ServiceAvailabilityModule {}
