import { Module } from "@nestjs/common";
import { InfraSharedModule } from "../shared/infra-shared.module";
import { StaffController } from "./staff.controller";
import { StaffService } from "./staff.service";
import { StaffWorkforceController } from "./staff-workforce.controller";
import { StaffWorkforceService } from "./staff-workforce.service";
import { StaffPrivilegePolicyService } from "./staff-privilege-policy.service";

@Module({
  imports: [InfraSharedModule],
  controllers: [StaffController, StaffWorkforceController],
  providers: [StaffService, StaffWorkforceService, StaffPrivilegePolicyService],
  // Exporting policy is useful for Billing/Scheduling modules to enforce privileges cleanly.
  exports: [StaffPrivilegePolicyService],
})
export class StaffModule {}
