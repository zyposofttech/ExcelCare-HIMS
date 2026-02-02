import { SetMetadata } from "@nestjs/common";

export const RBAC_REQUIRED_PERMS = "rbac:required_perms";
export const RBAC_PERMS_MODE = "rbac:perms_mode";

export type PermsMode = "ANY" | "ALL";

/**
 * RequirePerms("IAM_USER_CREATE") => ANY mode
 * RequirePerms(["A","B"], "ALL")  => ALL mode
 */
export function RequirePerms(perms: string[] | string, mode: PermsMode = "ANY") {
  const list = Array.isArray(perms) ? perms : [perms];
  // IMPORTANT: do NOT change case. Some permission codes are dot-form (e.g., ot.suite.create)
  // and must match exactly.
  const normalized = list.map((p) => String(p).trim()).filter(Boolean);
  return (target: any, key?: any, desc?: any) => {
    SetMetadata(RBAC_REQUIRED_PERMS, normalized)(target, key, desc);
    SetMetadata(RBAC_PERMS_MODE, mode)(target, key, desc);
  };
}
