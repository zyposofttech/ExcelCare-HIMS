import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";
import type { Principal } from "../../auth/access-policy.service";
import { AuditService } from "../../audit/audit.service";
import { PolicyEngineService } from "../../policy-engine/policy-engine.service";

@Injectable()
export class InfraContextService {
  constructor(
    @Inject("PRISMA") public prisma: PrismaClient,
    public audit: AuditService,
    public policyEngine: PolicyEngineService,
  ) {}

  resolveBranchId(principal: Principal, requestedBranchId?: string | null) {
    if (principal.roleScope === "BRANCH") {
      if (!principal.branchId) throw new ForbiddenException("Branch-scoped principal missing branchId");
      if (requestedBranchId && requestedBranchId !== principal.branchId) {
        throw new ForbiddenException("Cannot access another branch");
      }
      return principal.branchId;
    }
    if (!requestedBranchId) throw new BadRequestException("branchId is required for global operations");
    return requestedBranchId;
  }

  uniq(ids: string[]) {
    return Array.from(new Set((ids || []).map((x) => String(x)).filter(Boolean)));
  }
}
