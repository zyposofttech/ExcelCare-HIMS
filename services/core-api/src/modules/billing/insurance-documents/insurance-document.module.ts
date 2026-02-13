import { Module } from "@nestjs/common";
import { InfraSharedModule } from "../../infrastructure/shared/infra-shared.module";
import { InsuranceDocumentController } from "./insurance-document.controller";
import { InsuranceDocumentService } from "./insurance-document.service";

@Module({
  imports: [InfraSharedModule],
  controllers: [InsuranceDocumentController],
  providers: [InsuranceDocumentService],
  exports: [InsuranceDocumentService],
})
export class InsuranceDocumentModule {}
