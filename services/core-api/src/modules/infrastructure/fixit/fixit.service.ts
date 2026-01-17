import { Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { UpdateFixItDto } from "./dto";

@Injectable()
export class FixItService {
  constructor(private readonly ctx: InfraContextService) {}

  async listFixIts(principal: Principal, q: { branchId?: string | null; status?: string }) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    const where: any = { branchId };
    if (q.status) where.status = q.status as any;

    return this.ctx.prisma.fixItTask.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: { serviceItem: true, assignedToUser: { select: { id: true, name: true, email: true } } },
    });
  }

  async updateFixIt(principal: Principal, id: string, dto: UpdateFixItDto) {
    const existing = await this.ctx.prisma.fixItTask.findUnique({ where: { id }, select: { id: true, branchId: true } });
    if (!existing) throw new NotFoundException("FixIt task not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.fixItTask.update({
      where: { id },
      data: {
        status: dto.status as any,
        assignedToUserId: dto.assignedToUserId ?? undefined,
        resolvedAt: dto.status === "RESOLVED" ? new Date() : undefined,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_FIXIT_UPDATE",
      entity: "FixItTask",
      entityId: id,
      meta: dto,
    });

    return updated;
  }
}
