import { Module } from "@nestjs/common";
import { InfraSharedModule } from "../../infrastructure/shared/infra-shared.module";
import { DocumentChecklistController } from "./document-checklist.controller";
import { DocumentChecklistService } from "./document-checklist.service";

@Module({
  imports: [InfraSharedModule],
  controllers: [DocumentChecklistController],
  providers: [DocumentChecklistService],
  exports: [DocumentChecklistService],
})
export class DocumentChecklistModule {}
