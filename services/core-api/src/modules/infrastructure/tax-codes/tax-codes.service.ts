import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { canonicalizeCode } from "../../../common/naming.util";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreateTaxCodeDto, UpdateTaxCodeDto } from "./dto";

@Injectable()
export class TaxCodesService {
  constructor(private readonly ctx: InfraContextService) {}

  async list(
    principal: Principal,
    q: { branchId?: string | null; q?: string; taxType?: string; includeInactive?: boolean; take?: number },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);

    const where: any = { branchId };
    if (!q.includeInactive) where.isActive = true;

    // ✅ taxType filter (UI had this, backend was ignoring it)
    const tt = (q.taxType ?? "").trim().toUpperCase();
    if (tt && ["GST", "TDS", "OTHER"].includes(tt)) {
      where.taxType = tt;
    }

    const query = (q.q ?? "").trim();
    if (query) {
      where.OR = [
        { code: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
        { hsnSac: { contains: query, mode: "insensitive" } },
      ];
    }

    return this.ctx.prisma.taxCode.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      take: q.take ? Math.min(Math.max(q.take, 1), 500) : 200,
    });
  }

  async create(principal: Principal, dto: CreateTaxCodeDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const code = canonicalizeCode(dto.code);

    if (!code) throw new BadRequestException("code is required");
    if (!dto.name?.trim()) throw new BadRequestException("name is required");

    const exists = await this.ctx.prisma.taxCode.findFirst({
      where: { branchId, code },
      select: { id: true },
    });
    if (exists) throw new ConflictException("Tax code already exists for this branch");

    const created = await this.ctx.prisma.taxCode.create({
      data: {
        branchId,
        code,
        name: dto.name.trim(),
        taxType: (dto.taxType as any) ?? "GST",
        ratePercent: dto.ratePercent as any,
        components: dto.components ?? undefined,
        hsnSac:
          dto.hsnSac === undefined
            ? undefined
            : dto.hsnSac === null || String(dto.hsnSac).trim() === ""
              ? null
              : String(dto.hsnSac).trim(),
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

    return created;
  }

  async get(principal: Principal, id: string) {
    const row = await this.ctx.prisma.taxCode.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Tax code not found");
    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  async update(principal: Principal, id: string, dto: UpdateTaxCodeDto) {
    const existing = await this.ctx.prisma.taxCode.findUnique({
      where: { id },
      select: { id: true, branchId: true, code: true },
    });
    if (!existing) throw new NotFoundException("Tax code not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const nextCode = dto.code ? canonicalizeCode(dto.code) : undefined;
    if (nextCode && nextCode !== existing.code) {
      const dup = await this.ctx.prisma.taxCode.findFirst({
        where: { branchId, code: nextCode },
        select: { id: true },
      });
      if (dup) throw new ConflictException("Tax code already exists for this branch");
    }

    const hsnNormalized =
      dto.hsnSac === undefined
        ? undefined
        : dto.hsnSac === null || String(dto.hsnSac).trim() === ""
          ? null
          : String(dto.hsnSac).trim();

    const updated = await this.ctx.prisma.taxCode.update({
      where: { id },
      data: {
        code: nextCode,
        name: dto.name?.trim(),
        taxType: dto.taxType as any,
        ratePercent: dto.ratePercent === undefined ? undefined : (dto.ratePercent as any),
        components: dto.components === undefined ? undefined : (dto.components as any),
        hsnSac: hsnNormalized,
        isActive: dto.isActive === undefined ? undefined : dto.isActive,
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

    return updated;
  }

  /**
   * Soft deactivate (keeps history + avoids FK breaks)
   */
  async deactivate(principal: Principal, id: string) {
    const existing = await this.ctx.prisma.taxCode.findUnique({
      where: { id },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!existing) throw new NotFoundException("Tax code not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);
    if (!existing.isActive) return existing;

    const updated = await this.ctx.prisma.taxCode.update({
      where: { id },
      data: { isActive: false },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_TAX_CODE_DEACTIVATE",
      entity: "TaxCode",
      entityId: id,
      meta: {},
    });

    return updated;
  }
}
