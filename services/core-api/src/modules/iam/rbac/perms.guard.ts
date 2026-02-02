import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RBAC_PERMS_MODE, RBAC_REQUIRED_PERMS, type PermsMode } from "./require-perms.decorator";

function getReq(ctx: ExecutionContext): any {
  const http = ctx.switchToHttp();
  return http.getRequest();
}

@Injectable()
export class PermsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(RBAC_REQUIRED_PERMS, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    if (!required.length) return true;

    const mode =
      this.reflector.getAllAndOverride<PermsMode>(RBAC_PERMS_MODE, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? "ANY";

    const req = getReq(ctx);

    // Expect your auth middleware/guard to attach principal here.
    // Common patterns: req.user, req.principal
    const principal = req.user ?? req.principal;

    // IMPORTANT: do NOT change case (some perms are dot-form like ot.suite.create)
    const perms: string[] = Array.isArray(principal?.permissions)
      ? principal.permissions.map((x: any) => String(x).trim())
      : [];

    const ok =
      mode === "ALL"
        ? required.every((p) => perms.includes(p))
        : required.some((p) => perms.includes(p));

    if (!ok) {
      throw new ForbiddenException({
        message: "Insufficient permissions",
        required,
        mode,
      });
    }

    return true;
  }
}
