import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreateFormularyDto, FormularyItemDto } from "./dto";

@Injectable()
export class FormularyService {
  constructor(private readonly ctx: InfraContextService) {}

  // ----------------------------------------------------------------
  // List all formulary versions for a branch, newest version first
  // ----------------------------------------------------------------
  async listFormularies(principal: Principal, branchId?: string | null) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    return this.ctx.prisma.formulary.findMany({
      where: { branchId: bid },
      orderBy: [{ version: "desc" }],
      include: {
        _count: { select: { items: true } },
        publishedByUser: { select: { id: true, name: true } },
      },
    });
  }

  // ----------------------------------------------------------------
  // Create a new DRAFT formulary. Auto-increment version (max + 1).
  // Optionally accept an initial items array.
  // ----------------------------------------------------------------
  async createFormulary(
    principal: Principal,
    dto: CreateFormularyDto,
    branchId?: string | null,
  ) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    // Determine next version number
    const latest = await this.ctx.prisma.formulary.findFirst({
      where: { branchId: bid },
      orderBy: [{ version: "desc" }],
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const effectiveDate = dto.effectiveDate
      ? new Date(dto.effectiveDate)
      : null;

    const formulary = await this.ctx.prisma.$transaction(async (tx) => {
      const created = await tx.formulary.create({
        data: {
          branchId: bid,
          version: nextVersion,
          status: "DRAFT" as any,
          effectiveDate,
          notes: dto.notes?.trim() || null,
        },
      });

      // If items provided, bulk-create them
      if (dto.items?.length) {
        await this.upsertItems(tx as any, created.id, dto.items);
      }

      return tx.formulary.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          items: { include: { drugMaster: { select: { id: true, drugCode: true, genericName: true, brandName: true } } } },
          _count: { select: { items: true } },
        },
      });
    });

    await this.ctx.audit.log({
      branchId: bid,
      actorUserId: principal.userId,
      action: "PHARMACY_FORMULARY_CREATE",
      entity: "Formulary",
      entityId: formulary.id,
      meta: { version: nextVersion, itemCount: dto.items?.length ?? 0 },
    });

    return formulary;
  }

  // ----------------------------------------------------------------
  // Upsert items into a DRAFT formulary. Reject if already published.
  // ----------------------------------------------------------------
  async addFormularyItems(
    principal: Principal,
    formularyId: string,
    items: FormularyItemDto[],
  ) {
    const formulary = await this.ctx.prisma.formulary.findUnique({
      where: { id: formularyId },
      select: { id: true, branchId: true, status: true, version: true },
    });
    if (!formulary) throw new NotFoundException("Formulary not found");

    this.ctx.resolveBranchId(principal, formulary.branchId);

    if (String(formulary.status) !== "DRAFT") {
      throw new BadRequestException(
        "Cannot modify items on a non-DRAFT formulary. Only DRAFT formularies can accept item changes.",
      );
    }

    if (!items?.length) {
      throw new BadRequestException("At least one item is required");
    }

    const result = await this.ctx.prisma.$transaction(async (tx) => {
      await this.upsertItems(tx as any, formularyId, items);

      return tx.formulary.findUniqueOrThrow({
        where: { id: formularyId },
        include: {
          items: {
            include: {
              drugMaster: {
                select: { id: true, drugCode: true, genericName: true, brandName: true },
              },
            },
            orderBy: [{ createdAt: "asc" }],
          },
          _count: { select: { items: true } },
        },
      });
    });

    await this.ctx.audit.log({
      branchId: formulary.branchId,
      actorUserId: principal.userId,
      action: "PHARMACY_FORMULARY_ITEMS_UPSERT",
      entity: "Formulary",
      entityId: formularyId,
      meta: { version: formulary.version, upsertedCount: items.length },
    });

    return result;
  }

  // ----------------------------------------------------------------
  // Publish a DRAFT formulary.
  // Sets status=PUBLISHED, publishedAt, publishedByUserId.
  // Archives the previously PUBLISHED version of the same branch.
  // ----------------------------------------------------------------
  async publishFormulary(principal: Principal, formularyId: string) {
    const formulary = await this.ctx.prisma.formulary.findUnique({
      where: { id: formularyId },
      select: { id: true, branchId: true, status: true, version: true },
    });
    if (!formulary) throw new NotFoundException("Formulary not found");

    this.ctx.resolveBranchId(principal, formulary.branchId);

    if (String(formulary.status) !== "DRAFT") {
      throw new BadRequestException(
        "Only DRAFT formularies can be published.",
      );
    }

    // Verify formulary has at least one item
    const itemCount = await this.ctx.prisma.formularyItem.count({
      where: { formularyId },
    });
    if (itemCount === 0) {
      throw new BadRequestException(
        "Cannot publish a formulary with zero items. Add items first.",
      );
    }

    const now = new Date();

    const published = await this.ctx.prisma.$transaction(async (tx) => {
      // Archive the previously PUBLISHED version (if any) for this branch
      await tx.formulary.updateMany({
        where: {
          branchId: formulary.branchId,
          status: "PUBLISHED" as any,
          id: { not: formularyId },
        },
        data: { status: "ARCHIVED" as any },
      });

      // Publish this version
      return tx.formulary.update({
        where: { id: formularyId },
        data: {
          status: "PUBLISHED" as any,
          publishedAt: now,
          publishedByUserId: principal.userId,
        },
        include: {
          _count: { select: { items: true } },
          publishedByUser: { select: { id: true, name: true } },
        },
      });
    });

    await this.ctx.audit.log({
      branchId: formulary.branchId,
      actorUserId: principal.userId,
      action: "PHARMACY_FORMULARY_PUBLISH",
      entity: "Formulary",
      entityId: formularyId,
      meta: { version: formulary.version, itemCount, publishedAt: now.toISOString() },
    });

    return published;
  }

  // ----------------------------------------------------------------
  // Private: upsert formulary items (used by create and addItems)
  // ----------------------------------------------------------------
  private async upsertItems(
    tx: any, // Prisma transaction client
    formularyId: string,
    items: FormularyItemDto[],
  ) {
    for (const item of items) {
      if (!item.drugMasterId?.trim()) {
        throw new BadRequestException("drugMasterId is required for every formulary item");
      }

      // Validate drug exists
      const drug = await tx.drugMaster.findUnique({
        where: { id: item.drugMasterId },
        select: { id: true },
      });
      if (!drug) {
        throw new BadRequestException(
          `Drug master not found: ${item.drugMasterId}`,
        );
      }

      await tx.formularyItem.upsert({
        where: {
          formularyId_drugMasterId: {
            formularyId,
            drugMasterId: item.drugMasterId,
          },
        },
        create: {
          formularyId,
          drugMasterId: item.drugMasterId,
          tier: (item.tier ?? "APPROVED") as any,
          notes: item.notes?.trim() || null,
        },
        update: {
          tier: (item.tier ?? "APPROVED") as any,
          notes: item.notes?.trim() || null,
        },
      });
    }
  }
}
