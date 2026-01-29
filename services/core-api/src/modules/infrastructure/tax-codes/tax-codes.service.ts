import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import { canonicalizeCode } from "../../../common/naming.util";
import type { CreateTaxCodeDto, UpdateTaxCodeDto } from "./dto";

@Injectable()
export class TaxCodesService {
  constructor(private readonly ctx: InfraContextService) { }

  private async openFixItOnce(branchId: string, input: {
    type: any;
    entityType?: any;
    entityId?: string | null;
    title: string;
    details?: any;
    severity?: any;
    serviceItemId?: string | null;
  }) {
    const exists = await this.ctx.prisma.fixItTask.findFirst({
      where: {
        branchId,
        type: input.type,
        status: { in: ["OPEN", "IN_PROGRESS"] as any },
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
      select: { id: true },
    });
    if (exists) return;

    await this.ctx.prisma.fixItTask.create({
      data: {
        branchId,
        type: input.type,
        status: "OPEN" as any,
        severity: (input.severity ?? "BLOCKER") as any,
        entityType: (input.entityType ?? null) as any,
        entityId: input.entityId ?? null,
        title: input.title,
        details: input.details ?? undefined,
        serviceItemId: input.serviceItemId ?? null,
      },
    });
  }

  private async resolveFixIts(branchId: string, where: any) {
    await this.ctx.prisma.fixItTask.updateMany({
      where: { branchId, status: { in: ["OPEN", "IN_PROGRESS"] as any }, ...where },
      data: { status: "RESOLVED" as any, resolvedAt: new Date() },
    });
  }

  async list(principal: Principal, q: { branchId?: string | null; includeInactive?: boolean; search?: string }) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);

    const where: any = { branchId };
    if (!q.includeInactive) where.isActive = true;
    if (q.search) {
      where.OR = [
        { code: { contains: q.search, mode: "insensitive" } },
        { name: { contains: q.search, mode: "insensitive" } },
      ];
    }

    return this.ctx.prisma.taxCode.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });
  }

  async get(principal: Principal, id: string) {
    const tc = await this.ctx.prisma.taxCode.findUnique({ where: { id } });
    if (!tc) throw new NotFoundException("TaxCode not found");
    this.ctx.resolveBranchId(principal, tc.branchId);
    return tc;
  }

  async create(principal: Principal, dto: CreateTaxCodeDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, dto.branchId ?? branchIdParam ?? null);

    const code = canonicalizeCode(dto.code);
    const name = dto.name.trim();

    const created = await this.ctx.prisma.taxCode.create({
      data: {
        branchId,
        code,
        name,
        taxType: (dto.taxType ?? "GST") as any,
        ratePercent: dto.ratePercent as any,
        components: dto.components ?? undefined,
        hsnSac: dto.hsnSac ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_TAX_CODE_CREATE",
      entity: "TaxCode",
      entityId: created.id,
      meta: dto,
    });

    // If created active, resolve any inactive fixits
    if (created.isActive) {
      await this.resolveFixIts(branchId, {
        type: "TAX_CODE_INACTIVE" as any,
        entityType: "TAX_CODE" as any,
        entityId: created.id,
      });
    }

    return created;
  }

  async update(principal: Principal, id: string, dto: UpdateTaxCodeDto) {
    const existing = await this.ctx.prisma.taxCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("TaxCode not found");
    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.taxCode.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        taxType: dto.taxType ? (dto.taxType as any) : undefined,
        ratePercent: dto.ratePercent !== undefined ? (dto.ratePercent as any) : undefined,
        components: dto.components !== undefined ? dto.components : undefined,
        hsnSac: dto.hsnSac !== undefined ? (dto.hsnSac ?? null) : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_TAX_CODE_UPDATE",
      entity: "TaxCode",
      entityId: id,
      meta: dto,
    });


    // Guardrail: do not allow deactivation if the tax code is currently used anywhere
    if (dto.isActive === false) {
      const used = await this.isTaxCodeUsed(branchId, id);
      if (used.isUsed) {
        throw new BadRequestException(
          `Cannot deactivate TaxCode because it is used (cm:${used.details.cmCount}, rates:${used.details.rateCount}, packages:${used.details.pkgCount}, services:${used.details.serviceItemCount}). Migrate usage first.`,
        );
      }
    }


    // When reactivated: auto-resolve TAX_CODE_INACTIVE FixIt
    if (dto.isActive === true) {
      await this.resolveFixIts(branchId, {
        type: "TAX_CODE_INACTIVE" as any,
        entityType: "TAX_CODE" as any,
        entityId: id,
      });
    }

    return updated;
  }

  private async isTaxCodeUsed(branchId: string, taxCodeId: string) {
    const [cmCount, rateCount, pkgCount, svcCount] = await Promise.all([
      this.ctx.prisma.chargeMasterItem.count({ where: { branchId, taxCodeId } }),
      this.ctx.prisma.tariffRate.count({
        where: { tariffPlan: { branchId }, taxCodeId },
      }),
      this.ctx.prisma.servicePackage.count({ where: { branchId, taxCodeId } }),
      this.ctx.prisma.serviceItem.count({ where: { branchId, taxCodeId } }),
    ]);

    const isUsed = cmCount + rateCount + pkgCount + svcCount > 0;

    return {
      isUsed,
      details: { cmCount, rateCount, pkgCount, serviceItemCount: svcCount },
    };
  }
}
