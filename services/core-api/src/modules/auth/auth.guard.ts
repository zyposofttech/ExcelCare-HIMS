import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) throw new UnauthorizedException("Missing Bearer token");

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;

      // ✅ Enforce mustChangePassword
      const mustChangePassword = payload?.mustChangePassword === true;
      if (mustChangePassword) {
        const url = request.originalUrl || request.url || "";
        const allowed =
          url.includes("/auth/change-password"); // only allow password change endpoint

        if (!allowed) {
          throw new ForbiddenException("Password change required");
        }
      }
    } catch (e: any) {
      if (e instanceof ForbiddenException) throw e;
      throw new UnauthorizedException("Invalid or Expired Token");
    }

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
