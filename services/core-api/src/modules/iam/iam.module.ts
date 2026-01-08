import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AccessPolicyService } from "../auth/access-policy.service";
import { PrincipalGuard } from "../auth/principal.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { IamController } from "./iam.controller";
import { IamService } from "./iam.service";
import { IamSeedService } from "./iam.seed";

@Module({
  imports: [AuditModule],
  controllers: [IamController],
  providers: [IamService, AccessPolicyService, PrincipalGuard, PermissionsGuard, IamSeedService],
})
export class IamModule {}
