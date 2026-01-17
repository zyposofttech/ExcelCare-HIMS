import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { Principal } from "../modules/auth/access-policy.service";

/**
 * If client sends branchId in both query & body, they must match.
 * Returns a single chosen branchId (or null).
 */
export function pickBranchId(queryBranchId?: string | null, bodyBranchId?: string | null): string | null {
  const q = queryBranchId ? String(queryBranchId).trim() : null;
  const b = bodyBranchId ? String(bodyBranchId).trim() : null;

  if (q && b && q !== b) {
    throw new BadRequestException("branchId provided in both query and body must match");
  }

  return q ?? b ?? null;
}

/**
 * Standard branch scope resolution:
 * - BRANCH principals: always return principal.branchId; if requestedBranchId provided and differs -> 403
 * - GLOBAL principals: return requestedBranchId when provided; if requiredForGlobal and missing -> 400; else null (meaning "all branches")
 */
export function resolveBranchId(
  principal: Principal,
  requestedBranchId?: string | null,
  opts?: { requiredForGlobal?: boolean },
): string | null {
  const requiredForGlobal = opts?.requiredForGlobal ?? false;

  if (principal.roleScope === "BRANCH") {
    if (!principal.branchId) throw new ForbiddenException("Branch-scoped principal missing branchId");
    if (requestedBranchId && requestedBranchId !== principal.branchId) {
      throw new ForbiddenException("Cannot access another branch");
    }
    return principal.branchId;
  }

  // GLOBAL
  if (!requestedBranchId) {
    if (requiredForGlobal) throw new BadRequestException("branchId is required for this operation");
    return null;
  }
  return requestedBranchId;
}

/** Convenience: actor user id extraction for audit */
export function actorUserIdFromReq(req: any): string | null {
  return req?.principal?.userId ?? req?.user?.sub ?? null;
}
