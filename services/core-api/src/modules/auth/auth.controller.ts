import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { Public } from "./public.decorator";
import { hashPassword } from "../iam/password.util";

@ApiTags("Auth/Login")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(@Body() dto: Record<string, any>) {
    return this.authService.login(dto);
  }

  // ✅ change password (requires Bearer token)
  @HttpCode(HttpStatus.OK)
  @Post("change-password")
  async changePassword(
    @Req() req: any,
    @Body() body: { currentPassword: string; newPassword: string }
  ) {
    // Support both JwtAuthGuard (req.user.sub) and PrincipalGuard (req.principal.userId)
    const userId = req.user?.sub ?? req.principal?.userId;
    return this.authService.changePassword(
      userId,
      body.currentPassword,
      body.newPassword
    );
  }

  // ✅ Optional: server-side logout (hard token revoke via jti blacklist)
  // Works only when AUTH_JTI_ENFORCE=true and Redis is configured.
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(@Req() req: any) {
    const jti = req.user?.jti;
    const exp = req.user?.exp;
    await this.authService.revokeJti(
      String(jti || ""),
      typeof exp === "number" ? exp : undefined
    );
    return { ok: true };
  }

  // -------------------------------
  // Force seed helpers (DEV ONLY)
  // -------------------------------

  private prisma() {
    // Access prisma from AuthService (as in your original code)
    return (this.authService as any).prisma;
  }

  private assertForceSeedAllowed() {
    const nodeEnv = String(process.env.NODE_ENV || "").toLowerCase();
    const allow =
      process.env.AUTH_FORCE_SEED_ENABLED === "true" || nodeEnv !== "production";

    if (!allow) {
      throw new ForbiddenException(
        "force-seed is disabled in production (set AUTH_FORCE_SEED_ENABLED=true to allow)"
      );
    }
  }

  private async ensureActiveRoleVersion(args: {
    code: string;
    name: string;
    scope: "GLOBAL" | "BRANCH";
    description?: string;
  }) {
    const prisma = this.prisma();

    let tpl = await prisma.roleTemplate.findUnique({
      where: { code: args.code },
    });

    if (!tpl) {
      tpl = await prisma.roleTemplate.create({
        data: {
          code: args.code,
          name: args.name,
          scope: args.scope,
          description: args.description ?? null,
          isSystem: true,
        },
      });
    }

    // Prefer ACTIVE version
    let roleVersion = await prisma.roleTemplateVersion.findFirst({
      where: {
        roleTemplateId: tpl.id,
        status: "ACTIVE",
      },
      orderBy: { version: "desc" },
    });

    if (!roleVersion) {
      // Create v1 ACTIVE if none exists
      roleVersion = await prisma.roleTemplateVersion.create({
        data: {
          roleTemplateId: tpl.id,
          version: 1,
          status: "ACTIVE",
          notes: "Force seed",
        },
      });
    }

    return roleVersion;
  }

  private async nextAvailableEmpCode(base: string) {
    const prisma = this.prisma();
    let code = base.trim().toUpperCase();
    if (!code) code = "SYS-ADMIN";

    // If base is available, use it. Else suffix -2, -3, ...
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const exists = await prisma.staff.findUnique({
        where: { empCode: code },
        select: { id: true },
      });
      if (!exists) return code;
      n += 1;
      code = `${base.trim().toUpperCase()}-${n}`;
    }
  }

  /**
   * ✅ Critical gap fix:
   * Ensure any seeded admin user also exists in Staff table,
   * then link via user.staffId so the system can:
   * - show "createdBy staff" consistently
   * - allow workflow chains (approvals, leave routing, etc.)
   * - support future clinical privileging UX (autofill grantedBy)
   */
  private async ensureStaffLinkedToUser(args: {
    userId: string;
    email: string;
    name: string;
    designation: string;
    empCodeBase: string;
  }) {
    const prisma = this.prisma();

    const u = await prisma.user.findUnique({
      where: { id: args.userId },
      select: { id: true, staffId: true, email: true },
    });
    if (!u) return null;

    // Already linked
    if (u.staffId) return u.staffId;

    // Reuse staff if it already exists by officialEmail/email
    const existingStaff = await prisma.staff.findFirst({
      where: {
        OR: [{ officialEmail: args.email }, { email: args.email }],
      },
      select: { id: true },
    });

    let staffId: string;

    if (existingStaff?.id) {
      staffId = existingStaff.id;
    } else {
      const empCode = await this.nextAvailableEmpCode(args.empCodeBase);

      const staff = await prisma.staff.create({
        data: {
          empCode,
          name: args.name,
          designation: args.designation,

          // keep it simple + safe: system admins are NON_CLINICAL
          category: "NON_CLINICAL",

          // mark as system-access ready
          hasSystemAccess: true,
          onboardingStatus: "ACTIVE",

          officialEmail: args.email,
          email: args.email,
          status: "ACTIVE",
          isActive: true,

          // No branch assignment for GLOBAL admins (allowed by schema)
          primaryBranchId: null,
          homeBranchId: null,
        },
        select: { id: true },
      });

      staffId = staff.id;
    }

    // Link user -> staff
    await prisma.user.update({
      where: { id: args.userId },
      data: { staffId },
      select: { id: true },
    });

    return staffId;
  }

  // ✅ Keeps your original endpoint but makes it deterministic (always SUPER_ADMIN)
  @Public()
  @Get("force-seed")
  async forceSeed() {
    this.assertForceSeedAllowed();

    const prisma = this.prisma();

    const email = "superadmin@zypocare.com";
    const password = "ChangeMe@123";
    const hash = hashPassword(password);

    const roleVersion = await this.ensureActiveRoleVersion({
      code: "SUPER_ADMIN",
      name: "Super Admin",
      scope: "GLOBAL",
      description: "Emergency Seed",
    });

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: hash,
        mustChangePassword: false,
        isActive: true,
        role: "SUPER_ADMIN",
        roleVersionId: roleVersion.id,
        branchId: null,
      },
      create: {
        email,
        name: "ZypoCare Super Admin",
        role: "SUPER_ADMIN",
        roleVersionId: roleVersion.id,
        passwordHash: hash,
        mustChangePassword: false,
        isActive: true,
        branchId: null,
      },
    });

    // ✅ Ensure SUPER_ADMIN also exists in Staff + link user.staffId
    const staffId = await this.ensureStaffLinkedToUser({
      userId: user.id,
      email: user.email,
      name: user.name,
      designation: "Super Admin",
      empCodeBase: "SYS-SUPERADMIN",
    });

    return {
      message: "✅ SUCCESS: Super Admin seeded (User + Staff linked)!",
      user: { email: user.email, password, staffId },
    };
  }

  // ✅ NEW: seed a Corporate Admin (GLOBAL) to manage branches
  @Public()
  @Get("force-seed-corporate")
  async forceSeedCorporate() {
    this.assertForceSeedAllowed();

    const prisma = this.prisma();

    const email = "corporateadmin@zypocare.com";
    const password = "ChangeMe@123";
    const hash = hashPassword(password);

    const roleVersion = await this.ensureActiveRoleVersion({
      code: "CORPORATE_ADMIN",
      name: "Corporate Admin",
      scope: "GLOBAL",
      description: "Enterprise-level admin (multi-branch)",
    });

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash: hash,
        mustChangePassword: false,
        isActive: true,
        role: "CORPORATE_ADMIN",
        roleVersionId: roleVersion.id,
        branchId: null,
      },
      create: {
        email,
        name: "ZypoCare Corporate Admin",
        role: "CORPORATE_ADMIN",
        roleVersionId: roleVersion.id,
        passwordHash: hash,
        mustChangePassword: false,
        isActive: true,
        branchId: null,
      },
    });

    // ✅ Ensure CORPORATE_ADMIN also exists in Staff + link user.staffId
    const staffId = await this.ensureStaffLinkedToUser({
      userId: user.id,
      email: user.email,
      name: user.name,
      designation: "Corporate Admin",
      empCodeBase: "SYS-CORPORATEADMIN",
    });

    return {
      message: "✅ SUCCESS: Corporate Admin seeded (User + Staff linked)!",
      user: { email: user.email, password, staffId },
    };
  }
}
