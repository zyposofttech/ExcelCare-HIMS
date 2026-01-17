import { Module } from "@nestjs/common";

import { OtController } from "./ot.controller";
import { OtService } from "./ot.service";

// ✅ Provides AccessPolicyService + PrincipalGuard + PermissionsGuard
import { AuthModule } from "../../auth/auth.module";

// ✅ Provides the "PRISMA" token (safe even if PrismaModule is @Global)
import { PrismaModule } from "../../database/prisma.module";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [OtController],
  providers: [OtService],
  exports: [OtService],
})
export class OtModule {}
