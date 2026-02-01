import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";
import type { Principal } from "../../auth/access-policy.service";
import { resolveBranchId as resolveBranchIdCommon } from "../../../common/branch-scope.util";
import { AuditService } from "../../audit/audit.service";
import { PolicyEngineService } from "../../policy-engine/policy-engine.service";

@Injectable()
export class InfraContextService {
  constructor(
    @Inject("PRISMA") public prisma: PrismaClient,
    public audit: AuditService,
    public policyEngine: PolicyEngineService,
  ) {}

  resolveBranchId(principal: Principal, requestedBranchId?: string | null): string {
    // Standardized branch resolution for infrastructure: GLOBAL must provide branchId
    return resolveBranchIdCommon(principal, requestedBranchId ?? null, { requiredForGlobal: true });
  }

  uniq(ids: string[]) {
    return Array.from(new Set((ids || []).map((x) => String(x)).filter(Boolean)));
  }
}
