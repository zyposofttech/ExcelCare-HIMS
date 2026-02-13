import { Module } from "@nestjs/common";
import { InfraSharedModule } from "../../infrastructure/shared/infra-shared.module";
import { ClaimsGatewayModule } from "../claims-gateway/claims-gateway.module";
import { ClaimController } from "./claim.controller";
import { ClaimService } from "./claim.service";

@Module({
  imports: [InfraSharedModule, ClaimsGatewayModule],
  controllers: [ClaimController],
  providers: [ClaimService],
  exports: [ClaimService],
})
export class ClaimModule {}
