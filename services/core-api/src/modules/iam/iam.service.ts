import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";
import { AuditService } from "../audit/audit.service";
import type { Principal } from "../auth/access-policy.service";
import { resolveBranchId } from "../../common/branch-scope.util";
import { PERM, ROLE } from "./iam.constants";
import { CreateUserDto, UpdateUserDto, CreateRoleDto, UpdateRoleDto, CreatePermissionDto} from "./iam.dto";
import { generateTempPassword, hashPassword } from "./password.util";

function lowerEmail(e: string) {
  return (e || "").trim().toLowerCase();
}

@Injectable()
export class IamService {
  constructor(
    @Inject("PRISMA") private prisma: PrismaClient,
    private audit: AuditService,
  ) {}

  private ensureBranchScope(principal: Principal, branchId: string | null | undefined) {
    if (principal.roleScope === "BRANCH") {
      if (!principal.branchId) throw new ForbiddenException("Branch-scoped user missing branchId");
      if (!branchId) throw new BadRequestException("branchId is required for branch-scoped operations");
      if (branchId !== principal.branchId) throw new ForbiddenException("Cross-branch access is not allowed");
    }
  }

  private assertRoleTemplateScopeManageable(principal: Principal, templateScope: "GLOBAL" | "BRANCH") {
    // No behavior change for GLOBAL principals. Only prevent BRANCH principals from touching GLOBAL templates.
    if (principal.roleScope === "BRANCH" && templateScope === "GLOBAL") {
      throw new ForbiddenException("Branch-scoped principals cannot manage GLOBAL role templates");
    }
  }

  private normalizeRoleScope(input: any): "GLOBAL" | "BRANCH" {
    const scope = String(input ?? "").trim().toUpperCase();
    if (scope !== "GLOBAL" && scope !== "BRANCH") throw new BadRequestException("Invalid role scope");
    return scope as "GLOBAL" | "BRANCH";
  }


  async listRoles(principal: Principal) {
    // Read roles/templates that are ACTIVE; branch users will only see BRANCH roles.
    const where =
  principal.roleScope === "BRANCH"
    ? ({ roleTemplate: { scope: "BRANCH" }, status: "ACTIVE" } as const)
    : ({ status: "ACTIVE" } as const);


    const versions = await this.prisma.roleTemplateVersion.findMany({
      where,
      include: {
        roleTemplate: true,
        permissions: { include: { permission: true } },
      },
      orderBy: [{ roleTemplate: { code: "asc" } }, { version: "desc" }],
    });

    return versions.map((v: any) => ({
      roleCode: v.roleTemplate.code,
      roleName: v.roleTemplate.name,
      scope: v.roleTemplate.scope,
      version: v.version,
       permissions: v.permissions.map((p: any) => p.permission.code),
    }));
  }

  async listUsers(principal: Principal, q?: string, branchId?: string) {
    if (!principal.permissions.includes(PERM.IAM_USER_READ)) throw new ForbiddenException("Missing IAM_USER_READ");

    const query = (q || "").trim();
    const where: any = {};
    if (query) {
      where.OR = [
        { email: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ];
    }
    if (principal.roleScope === "BRANCH") {
      // Preserve legacy behavior: missing branchId -> empty result, not an exception.
      if (!principal.branchId) {
        where.branchId = "__none__";
      } else {
        // Optional filter for BRANCH scope: must match principal.branchId
        if (branchId) {
          // Use shared helper where safe (principal.branchId exists)
          resolveBranchId(principal, branchId);
        }
        where.branchId = principal.branchId;
      }
    } else {
      // GLOBAL scope: optional branchId filter
      const resolved = resolveBranchId(principal, branchId ?? null);
      if (resolved) where.branchId = resolved;
    }

    const rows = await this.prisma.user.findMany({
      where,
      include: {
        branch: true,
        roleVersion: { include: { roleTemplate: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });

    return rows.map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      roleCode: u.roleVersion?.roleTemplate?.code ?? u.role,
      branchId: u.branchId ?? null,
      branchName: u.branch?.name ?? null,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  async createUser(principal: Principal, dto: CreateUserDto) {
    if (!principal.permissions.includes(PERM.IAM_USER_CREATE)) throw new ForbiddenException("Missing IAM_USER_CREATE");

    const email = lowerEmail(dto.email);
    if (!email) throw new BadRequestException("Email required");

    // Find ACTIVE role version by template code
    const roleCode = (dto.roleCode || "").trim().toUpperCase();
    const roleV = await this.prisma.roleTemplateVersion.findFirst({
      where: { status: "ACTIVE", roleTemplate: { code: roleCode } },
      include: { roleTemplate: true },
    });
    if (!roleV) throw new BadRequestException(`Active role not found: ${roleCode}`);

    // Branch isolation: branch-scoped principals may only create users in their own branch
    const branchId = dto.branchId ?? principal.branchId ?? null;
    if (roleV.roleTemplate.scope === "BRANCH") {
      if (!branchId) throw new BadRequestException("branchId is required for BRANCH role users");
    }
    this.ensureBranchScope(principal, branchId);

    // Additional safety: BRANCH principals cannot assign GLOBAL roles (e.g., SUPER_ADMIN)
    if (principal.roleScope === "BRANCH" && roleV.roleTemplate.scope === "GLOBAL") {
      throw new ForbiddenException("Branch admins cannot assign global roles");
    }

    // Temp password + must-change-password
    const tempPassword = generateTempPassword();
    const passwordHash = hashPassword(tempPassword);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name,
          role: roleCode, // keep in sync
          branchId,
          staffId: dto.staffId ?? null,
          roleVersionId: roleV.id,
          passwordHash,
          mustChangePassword: true,
        },
      });

      await this.audit.log({
        branchId: branchId ?? principal.branchId ?? null,
        actorUserId: principal.userId,
        action: "IAM_USER_CREATED",
        entity: "User",
        entityId: user.id,
        meta: { email, roleCode, roleVersionId: roleV.id, branchId },
      });

      const returnTemp =
        process.env.IAM_RETURN_TEMP_PASSWORD === "true" || process.env.NODE_ENV !== "production";

      return {
        userId: user.id,
        email: user.email,
        tempPassword: returnTemp ? tempPassword : undefined,
      };
    } catch (e: any) {
      // Prisma unique constraint
      if (String(e?.code) === "P2002") throw new ConflictException("Email already exists");
      throw e;
    }
  }

  async updateUser(principal: Principal, id: string, dto: UpdateUserDto) {
    if (!principal.permissions.includes(PERM.IAM_USER_UPDATE)) throw new ForbiddenException("Missing IAM_USER_UPDATE");

    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { roleVersion: { include: { roleTemplate: true } } },
    });
    if (!existing) throw new NotFoundException("User not found");

    // Branch isolation
    if (principal.roleScope === "BRANCH") {
      if ((existing.branchId ?? null) !== (principal.branchId ?? null)) {
        throw new ForbiddenException("Cross-branch access is not allowed");
      }
    }

    let newRoleVersionId: string | undefined;
    let newRoleCode: string | undefined;

    if (dto.roleCode) {
      const roleCode = dto.roleCode.trim().toUpperCase();
      const roleV = await this.prisma.roleTemplateVersion.findFirst({
        where: { status: "ACTIVE", roleTemplate: { code: roleCode } },
        include: { roleTemplate: true },
      });
      if (!roleV) throw new BadRequestException(`Active role not found: ${roleCode}`);

      if (principal.roleScope === "BRANCH" && roleV.roleTemplate.scope === "GLOBAL") {
        throw new ForbiddenException("Branch admins cannot assign global roles");
      }

      newRoleVersionId = roleV.id;
      newRoleCode = roleCode;
    }

    const branchId = dto.branchId === undefined ? existing.branchId : dto.branchId;
    // if moving branches, enforce branch scope rules
    this.ensureBranchScope(principal, branchId ?? null);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        isActive: dto.isActive ?? undefined,
        staffId: dto.staffId === undefined ? undefined : dto.staffId,
        branchId: dto.branchId === undefined ? undefined : dto.branchId,
        roleVersionId: newRoleVersionId ?? undefined,
        role: newRoleCode ?? undefined,
      },
    });

    await this.audit.log({
      branchId: (updated.branchId ?? principal.branchId ?? null) as any,
      actorUserId: principal.userId,
      action: "IAM_USER_UPDATED",
      entity: "User",
      entityId: updated.id,
      meta: { changes: dto },
    });

    if (dto.roleCode) {
      await this.audit.log({
        branchId: (updated.branchId ?? principal.branchId ?? null) as any,
        actorUserId: principal.userId,
        action: "IAM_USER_ROLE_ASSIGNED",
        entity: "User",
        entityId: updated.id,
        meta: { roleCode: dto.roleCode },
      });
    }

    return { ok: true };
  }

  async resetPassword(principal: Principal, id: string) {
    if (!principal.permissions.includes(PERM.IAM_USER_RESET_PASSWORD)) {
      throw new ForbiddenException("Missing IAM_USER_RESET_PASSWORD");
    }

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("User not found");

    if (principal.roleScope === "BRANCH") {
      if ((existing.branchId ?? null) !== (principal.branchId ?? null)) {
        throw new ForbiddenException("Cross-branch access is not allowed");
      }
    }

    const tempPassword = generateTempPassword();
    const passwordHash = hashPassword(tempPassword);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });

    await this.audit.log({
      branchId: (existing.branchId ?? principal.branchId ?? null) as any,
      actorUserId: principal.userId,
      action: "IAM_USER_PASSWORD_RESET",
      entity: "User",
      entityId: id,
      meta: { email: existing.email },
    });
    
    const returnTemp =
      process.env.IAM_RETURN_TEMP_PASSWORD === "true" || process.env.NODE_ENV !== "production";

    return { ok: true, tempPassword: returnTemp ? tempPassword : undefined };
  }
  async listPermissions(principal: Principal) {
    // Fetches all available permissions from the database
    // "permission" model is implied by your listRoles relation
    return this.prisma.permission.findMany({
      orderBy: { code: "asc" },
    });
  }
  async getUser(principal: Principal, id: string) {
    if (!principal.permissions.includes(PERM.IAM_USER_READ)) {
      throw new ForbiddenException("Missing IAM_USER_READ");
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        branch: true,
        roleVersion: { include: { roleTemplate: true } },
      },
    });

    if (!user) throw new NotFoundException("User not found");

    // Enforce branch isolation
    if (principal.roleScope === "BRANCH") {
      if ((user.branchId ?? null) !== (principal.branchId ?? null)) {
        throw new ForbiddenException("Cross-branch access is not allowed");
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roleCode: user.roleVersion?.roleTemplate?.code ?? user.role,
      branchId: user.branchId ?? null,
      branchName: user.branch?.name ?? null,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
    async listBranches(principal: Principal) {
    const isSuperAdmin =
      principal.roleCode === ROLE.SUPER_ADMIN || principal.roleScope === "GLOBAL";

    const where =
      !isSuperAdmin && principal.branchId
        ? { id: principal.branchId }
        : !isSuperAdmin && !principal.branchId
          ? { id: "__none__" } // branch-scoped but missing branchId -> return empty
          : {};

    const rows = await this.prisma.branch.findMany({
      where,
      orderBy: [{ name: "asc" }],
      select: { id: true, code: true, name: true, city: true },
    });

    return rows.map((b) => ({
      id: b.id,
      code: String(b.code),
      name: b.name,
      city: b.city ?? undefined,
    }));
  }

  async getBranch(principal: Principal, id: string) {
    // Enforce branch isolation for branch-scoped users
    this.ensureBranchScope(principal, id);

    const b = await this.prisma.branch.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, city: true, createdAt: true, updatedAt: true },
    });
    if (!b) throw new NotFoundException("Branch not found");

    return {
      id: b.id,
      code: String(b.code),
      name: b.name,
      city: b.city ?? undefined,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }

  async listAudit(
    principal: Principal,
    params: { entity?: string; entityId?: string; actorUserId?: string; action?: string; branchId?: string; take?: number }
  ) {
    if (!principal.permissions.includes(PERM.IAM_AUDIT_READ)) {
       throw new ForbiddenException("Missing IAM_AUDIT_READ");
    }

    const where: any = {};
    
    // Branch isolation for audit logs
    if (principal.roleScope === "BRANCH") {
      // Preserve legacy behavior: missing branchId -> empty result, not an exception.
      if (!principal.branchId) {
        where.branchId = "__none__";
      } else {
        // Optional filter for BRANCH scope: must match principal.branchId
        if (params.branchId) {
          resolveBranchId(principal, params.branchId);
        }
        where.branchId = principal.branchId;
      }
    } else {
      // GLOBAL scope: optional branchId filter
      const resolved = resolveBranchId(principal, params.branchId ?? null);
      if (resolved) where.branchId = resolved;
    }

    if (params.entity) where.entity = params.entity;
    if (params.entityId) where.entityId = params.entityId;
    if (params.actorUserId) where.actorUserId = params.actorUserId;
    if (params.action) where.action = params.action;

    // Assuming your audit table is named 'auditLog' or similar in Prisma
    return this.prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.take || 50,
    });
  }
  async createRole(principal: Principal, dto: CreateRoleDto) {
    // 1. Permission Check
    // Ensure you add IAM_ROLE_CREATE to your PERM constants
    if (!principal.permissions.includes(PERM.IAM_ROLE_CREATE)) { 
      throw new ForbiddenException("Missing IAM_ROLE_CREATE");
    }

    const code = dto.roleCode.trim().toUpperCase();

    const scope = this.normalizeRoleScope(dto.scope);
    this.assertRoleTemplateScopeManageable(principal, scope);

    // 2. Check existence
    const existing = await this.prisma.roleTemplate.findUnique({
      where: { code },
    });
    if (existing) throw new ConflictException(`Role code ${code} already exists`);

    // 3. Resolve Permission IDs from Codes
    const perms = await this.prisma.permission.findMany({
      where: { code: { in: dto.permissions } },
    });
    if (perms.length !== dto.permissions.length) {
      throw new BadRequestException("One or more invalid permission codes");
    }

    // 4. Transaction: Create Template + Version 1 + Links
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.roleTemplate.create({
        data: {
          code,
          name: dto.roleName,
          scope,
        },
      });

      const version = await tx.roleTemplateVersion.create({
        data: {
          roleTemplateId: template.id,
          version: 1,
          status: "ACTIVE",
          permissions: {
            create: perms.map((p) => ({ permissionId: p.id })),
          },
        },
      });

      await this.audit.log({
        actorUserId: principal.userId,
        action: "IAM_ROLE_CREATED",
        entity: "RoleTemplate",
        entityId: template.id,
        meta: { code, version: 1, scope },
        branchId: principal.branchId ?? null,
      });

      return { roleCode: template.code };
    });
  }

  // ✅ ADD THIS METHOD
  async updateRole(principal: Principal, code: string, dto: UpdateRoleDto) {
    if (!principal.permissions.includes(PERM.IAM_ROLE_UPDATE)) {
      throw new ForbiddenException("Missing IAM_ROLE_UPDATE");
    }

    const roleCode = code.trim().toUpperCase();

    const current = await this.prisma.roleTemplateVersion.findFirst({
      where: { roleTemplate: { code: roleCode }, status: "ACTIVE" },
      include: {
        roleTemplate: true,
        permissions: { include: { permission: true } },
      },
    });

    if (!current) throw new NotFoundException("Role not found or no active version");

    // BRANCH principals must not manage GLOBAL templates (no behavior change for GLOBAL principals)
    this.assertRoleTemplateScopeManageable(principal, current.roleTemplate.scope as any);

    // Prepare permission IDs:
    // - if permissions provided: validate codes and use them
    // - else: carry forward current active permission set (prevents accidental wipe)
    let permIds: string[] = [];
    if (dto.permissions) {
      const perms = await this.prisma.permission.findMany({
        where: { code: { in: dto.permissions } },
      });
      if (perms.length !== dto.permissions.length) {
        throw new BadRequestException("One or more invalid permission codes");
      }
      permIds = perms.map((p) => p.id);
    } else {
      permIds =
        (current as any).permissions?.map((p: any) => p.permissionId ?? p.permission?.id).filter(Boolean) ?? [];
    }

    await this.prisma.$transaction(async (tx) => {
      // Retire current version
      await tx.roleTemplateVersion.update({
        where: { id: current.id },
        data: { status: "RETIRED" },
      });

      // Create new version
      const newVersion = await tx.roleTemplateVersion.create({
        data: {
          roleTemplateId: current.roleTemplateId,
          version: current.version + 1,
          status: "ACTIVE",
          permissions: {
            create: permIds.map((id) => ({ permissionId: id })),
          },
        },
      });

      // Update template name if requested
      if (dto.roleName && dto.roleName !== current.roleTemplate.name) {
        await tx.roleTemplate.update({
          where: { id: current.roleTemplateId },
          data: { name: dto.roleName },
        });
      }

      await this.audit.log({
        actorUserId: principal.userId,
        action: "IAM_ROLE_UPDATED",
        entity: "RoleTemplate",
        entityId: current.roleTemplateId,
        meta: { code: roleCode, oldVersion: current.version, newVersion: newVersion.version },
        branchId: principal.branchId ?? null,
      });
    });

    return { ok: true };
  }
  async createPermission(principal: Principal, dto: CreatePermissionDto) {
    if (!principal.permissions.includes(PERM.IAM_PERMISSION_CREATE)) {
       throw new ForbiddenException("Missing IAM_PERMISSION_CREATE");
    }

    const code = dto.code.trim().toUpperCase();
    
    // Check for duplicates
    const existing = await this.prisma.permission.findUnique({ where: { code } });
    if (existing) throw new ConflictException(`Permission ${code} already exists`);

    // Create
    const perm = await this.prisma.permission.create({
      data: {
        code,
        name: dto.name,
        category: dto.category,
        description: dto.description,
      },
    });

    // Audit
    await this.audit.log({
      actorUserId: principal.userId,
      action: "IAM_PERMISSION_CREATED",
      entity: "Permission",
      entityId: perm.id,
      meta: { code: perm.code, category: perm.category },
      branchId: principal.branchId ?? null,
    });

    return perm;
  }
}

