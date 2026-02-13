import { Module } from "@nestjs/common";
import { InfraSharedModule } from "../../infrastructure/shared/infra-shared.module";
import { InsuranceCaseController } from "./insurance-case.controller";
import { InsuranceCaseService } from "./insurance-case.service";

@Module({
  imports: [InfraSharedModule],
  controllers: [InsuranceCaseController],
  providers: [InsuranceCaseService],
  exports: [InsuranceCaseService],
})
export class InsuranceCaseModule {}
