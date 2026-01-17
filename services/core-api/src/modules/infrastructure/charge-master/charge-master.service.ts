import { Injectable } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreateChargeMasterItemDto } from "./dto";
import { canonicalizeCode } from "../../../common/naming.util";

@Injectable()
export class ChargeMasterService {
  constructor(private readonly ctx: InfraContextService) {}

  async createChargeMasterItem(principal: Principal, dto: CreateChargeMasterItemDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const code = canonicalizeCode(dto.code);

    const created = await this.ctx.prisma.chargeMasterItem.create({
      data: {
        branchId,
        code,
        name: dto.name.trim(),
        category: dto.category ?? null,
        unit: dto.unit ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_CHARGE_MASTER_CREATE",
      entity: "ChargeMasterItem",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  async listChargeMasterItems(principal: Principal, q: { branchId?: string | null; q?: string }) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    const where: any = { branchId, isActive: true };
    if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { code: { contains: q.q, mode: "insensitive" } }];

    return this.ctx.prisma.chargeMasterItem.findMany({ where, orderBy: [{ name: "asc" }] });
  }
}
