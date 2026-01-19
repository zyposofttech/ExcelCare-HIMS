import { BadRequestException, Injectable } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";

@Injectable()
export class UnitTypesService {
  constructor(private readonly ctx: InfraContextService) {}

  async listUnitTypeCatalog(_principal: Principal) {
    return this.ctx.prisma.unitTypeCatalog.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        usesRoomsDefault: true,
        schedulableByDefault: true,
        isActive: true,
        sortOrder: true,
      },
    });
  }

  // ✅ FIX: create catalog item (matches your Prisma model fields; ignores extra fields like description)
  async createUnitTypeCatalog(principal: Principal, body: any) {
    const code = String(body?.code ?? "")
      .trim()
      .toUpperCase();
    const name = String(body?.name ?? "").trim();

    // Prisma constraints:
    // code: VarChar(32), unique
    // name: VarChar(120)
    if (!name) throw new BadRequestException("name is required");
    if (!code) throw new BadRequestException("code is required");

    if (code.length < 2 || code.length > 32) {
      throw new BadRequestException("code must be between 2 and 32 characters");
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      throw new BadRequestException("code can contain only A–Z, 0–9, underscore (_) and hyphen (-)");
    }
    if (name.length < 2 || name.length > 120) {
      throw new BadRequestException("name must be between 2 and 120 characters");
    }

    const usesRoomsDefault = body?.usesRoomsDefault ?? true;
    const schedulableByDefault = body?.schedulableByDefault ?? false;
    const isActive = body?.isActive ?? true;

    // sortOrder: if not provided, append near end (max + 10)
    let sortOrder: number;
    if (typeof body?.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
      sortOrder = Math.max(0, Math.floor(body.sortOrder));
    } else {
      const agg = await this.ctx.prisma.unitTypeCatalog.aggregate({ _max: { sortOrder: true } });
      sortOrder = Number(agg?._max?.sortOrder ?? 0) + 10;
    }

    // unique check
    const exists = await this.ctx.prisma.unitTypeCatalog.findFirst({
      where: { code },
      select: { id: true },
    });
    if (exists) throw new BadRequestException(`Catalog code "${code}" already exists`);

    try {
      const created = await this.ctx.prisma.unitTypeCatalog.create({
        data: {
          code,
          name,
          usesRoomsDefault: !!usesRoomsDefault,
          schedulableByDefault: !!schedulableByDefault,
          isActive: !!isActive,
          sortOrder,
        },
        select: {
          id: true,
          code: true,
          name: true,
          usesRoomsDefault: true,
          schedulableByDefault: true,
          isActive: true,
          sortOrder: true,
        },
      });

      // Audit (global catalog => branchId null)
      await this.ctx.audit.log({
        branchId: null,
        actorUserId: principal.userId,
        action: "INFRA_UNITTYPE_CATALOG_CREATE",
        entity: "UnitTypeCatalog",
        entityId: created.id,
        meta: {
          code: created.code,
          name: created.name,
          usesRoomsDefault: created.usesRoomsDefault,
          schedulableByDefault: created.schedulableByDefault,
          isActive: created.isActive,
          sortOrder: created.sortOrder,
        },
      });

      return created;
    } catch (e: any) {
      // Prisma unique error fallback (race condition)
      if (e?.code === "P2002") throw new BadRequestException(`Catalog code "${code}" already exists`);
      throw e;
    }
  }

  async getBranchUnitTypes(principal: Principal, branchIdParam?: string) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);

    const links = await this.ctx.prisma.branchUnitType.findMany({
      where: { branchId },
      include: { unitType: true },
      orderBy: [{ unitType: { sortOrder: "asc" } }, { unitType: { name: "asc" } }],
    });

    return links.map((l) => ({
      id: l.id,
      unitTypeId: l.unitTypeId,
      isEnabled: l.isEnabled,
      enabledAt: l.enabledAt,
      unitType: {
        id: l.unitType.id,
        code: l.unitType.code,
        name: l.unitType.name,
        usesRoomsDefault: l.unitType.usesRoomsDefault,
        schedulableByDefault: l.unitType.schedulableByDefault,
        isActive: l.unitType.isActive,
        sortOrder: l.unitType.sortOrder,
      },
    }));
  }

  async setBranchUnitTypes(principal: Principal, unitTypeIdsRaw: string[], branchIdParam?: string) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const unitTypeIds = this.ctx.uniq(unitTypeIdsRaw);

    if (!unitTypeIds.length) {
      throw new BadRequestException("unitTypeIds cannot be empty (you want all unit types day-1)");
    }

    const valid = await this.ctx.prisma.unitTypeCatalog.findMany({
      where: { id: { in: unitTypeIds }, isActive: true },
      select: { id: true },
    });
    const ok = new Set(valid.map((v) => v.id));
    const bad = unitTypeIds.filter((x) => !ok.has(x));
    if (bad.length) throw new BadRequestException(`Unknown/inactive unitTypeIds: ${bad.join(", ")}`);

    const current = await this.ctx.prisma.branchUnitType.findMany({
      where: { branchId },
      select: { unitTypeId: true, isEnabled: true },
    });

    const enabledNow = new Set(current.filter((x) => x.isEnabled).map((x) => x.unitTypeId));
    const desired = new Set(unitTypeIds);

    const toDisable = Array.from(enabledNow).filter((id) => !desired.has(id));
    const toEnable = unitTypeIds.filter((id) => !enabledNow.has(id));

    await this.ctx.prisma.$transaction(async (tx) => {
      if (toDisable.length) {
        await tx.branchUnitType.updateMany({
          where: { branchId, unitTypeId: { in: toDisable } },
          data: { isEnabled: false },
        });
      }

      for (const id of toEnable) {
        await tx.branchUnitType.upsert({
          where: { branchId_unitTypeId: { branchId, unitTypeId: id } },
          update: { isEnabled: true, enabledAt: new Date() },
          create: { branchId, unitTypeId: id, isEnabled: true, enabledAt: new Date() },
        });
      }
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_UNITTYPE_SET",
      entity: "Branch",
      entityId: branchId,
      meta: { enabled: unitTypeIds },
    });

    return this.getBranchUnitTypes(principal, branchId);
  }
}
