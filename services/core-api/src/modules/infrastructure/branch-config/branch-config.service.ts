import { Injectable } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { UpdateBranchInfraConfigDto } from "./dto";

@Injectable()
export class BranchConfigService {
  constructor(private readonly ctx: InfraContextService) {}

  async ensureBranchInfraConfig(branchId: string) {
    const cfg = await this.ctx.prisma.branchInfraConfig.findUnique({
      where: { branchId },
      select: { id: true, branchId: true, housekeepingGateEnabled: true },
    });
    if (cfg) return cfg;
    return this.ctx.prisma.branchInfraConfig.create({
      data: { branchId, housekeepingGateEnabled: true },
      select: { id: true, branchId: true, housekeepingGateEnabled: true },
    });
  }

  async getBranchInfraConfig(principal: Principal, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    return this.ensureBranchInfraConfig(branchId);
  }

  async updateBranchInfraConfig(principal: Principal, branchIdParam: string | null, dto: UpdateBranchInfraConfigDto) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);

    const saved = await this.ctx.prisma.branchInfraConfig.upsert({
      where: { branchId },
      update: { housekeepingGateEnabled: dto.housekeepingGateEnabled },
      create: { branchId, housekeepingGateEnabled: dto.housekeepingGateEnabled },
      select: { id: true, branchId: true, housekeepingGateEnabled: true },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_CONFIG_UPDATE",
      entity: "BranchInfraConfig",
      entityId: saved.id,
      meta: dto,
    });

    return saved;
  }
}
