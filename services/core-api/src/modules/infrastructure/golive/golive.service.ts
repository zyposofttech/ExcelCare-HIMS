import { Injectable } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { RunGoLiveDto } from "./dto";

@Injectable()
export class GoLiveService {
  constructor(private readonly ctx: InfraContextService) {}

  async runGoLive(principal: Principal, dto: RunGoLiveDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);

    const [
      enabledUnitTypes,
      units,
      rooms,
      resources,
      beds,
      schedulableOts,
      equipmentCount,
      fixItsOpen,
    ] = await Promise.all([
      this.ctx.prisma.branchUnitType.count({ where: { branchId, isEnabled: true } }),
      this.ctx.prisma.unit.count({ where: { branchId, isActive: true } }),
      this.ctx.prisma.unitRoom.count({ where: { branchId, isActive: true } }),
      this.ctx.prisma.unitResource.count({ where: { branchId, isActive: true } }),
      this.ctx.prisma.unitResource.count({ where: { branchId, isActive: true, resourceType: "BED" as any } }),
      this.ctx.prisma.unitResource.count({ where: { branchId, isActive: true, resourceType: "OT_TABLE" as any, isSchedulable: true } }),
      this.ctx.prisma.equipmentAsset.count({ where: { branchId } }),
      this.ctx.prisma.fixItTask.count({ where: { branchId, status: { in: ["OPEN", "IN_PROGRESS"] as any } } }),
    ]);

    const blockers: string[] = [];
    const warnings: string[] = [];

    if (enabledUnitTypes === 0) blockers.push("No unit types enabled for this branch.");
    if (units === 0) blockers.push("No units created.");
    if (beds === 0) blockers.push("No beds (UnitResourceType=BED) created.");
    if (schedulableOts === 0) blockers.push("No schedulable OT tables configured (required for OT scheduling).");

    if (rooms === 0) warnings.push("No rooms configured. If your branch uses open bays only, you can ignore this warning.");
    if (equipmentCount === 0) warnings.push("No equipment assets registered yet.");
    if (fixItsOpen > 0) warnings.push(`${fixItsOpen} Fix-It tasks are pending (service-to-charge mapping).`);

    const score =
      (enabledUnitTypes > 0 ? 15 : 0) +
      (units > 0 ? 20 : 0) +
      (beds > 0 ? 20 : 0) +
      (schedulableOts > 0 ? 20 : 0) +
      (equipmentCount > 0 ? 10 : 0) +
      (fixItsOpen === 0 ? 15 : 0);

    const snapshot = {
      enabledUnitTypes,
      units,
      rooms,
      resources,
      beds,
      schedulableOts,
      equipmentCount,
      fixItsOpen,
      generatedAt: new Date().toISOString(),
    };

    const out = { branchId, score, blockers, warnings, snapshot };

    if (dto?.persist !== false) {
      const report = await this.ctx.prisma.goLiveReport.create({
        data: {
          branchId,
          score,
          blockers,
          warnings,
          snapshot,
          createdByUserId: principal.userId,
        },
      });

      await this.ctx.audit.log({
        branchId,
        actorUserId: principal.userId,
        action: "INFRA_GOLIVE_RUN",
        entity: "GoLiveReport",
        entityId: report.id,
        meta: out,
      });

      return { ...out, reportId: report.id };
    }

    return out;
  }
}
