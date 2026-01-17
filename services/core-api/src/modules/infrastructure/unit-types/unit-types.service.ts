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
      select: { id: true, code: true, name: true, usesRoomsDefault: true, schedulableByDefault: true },
    });
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
