import { Module } from "@nestjs/common";
import { InfraSharedModule } from "../../infrastructure/shared/infra-shared.module";
import { ClaimsGatewayModule } from "../claims-gateway/claims-gateway.module";
import { PreauthController } from "./preauth.controller";
import { PreauthService } from "./preauth.service";

@Module({
  imports: [InfraSharedModule, ClaimsGatewayModule],
  controllers: [PreauthController],
  providers: [PreauthService],
  exports: [PreauthService],
})
export class PreauthModule {}
