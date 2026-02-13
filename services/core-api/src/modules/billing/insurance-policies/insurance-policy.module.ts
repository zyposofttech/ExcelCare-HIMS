import { Module } from "@nestjs/common";
import { InfraSharedModule } from "../../infrastructure/shared/infra-shared.module";
import { InsurancePolicyController } from "./insurance-policy.controller";
import { InsurancePolicyService } from "./insurance-policy.service";

@Module({
  imports: [InfraSharedModule],
  controllers: [InsurancePolicyController],
  providers: [InsurancePolicyService],
  exports: [InsurancePolicyService],
})
export class InsurancePolicyModule {}
