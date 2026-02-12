import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { SetInventoryConfigDto, CreateIndentMappingDto } from "./dto";

@Injectable()
export class InventoryConfigService {
  constructor(private readonly ctx: InfraContextService) {}

  // ================================================================
  // INVENTORY CONFIG (per store + drug)
  // ================================================================

  // ----------------------------------------------------------------
  // List inventory configs for a store, include drug master name
  // ----------------------------------------------------------------
  async listInventoryConfigs(
    principal: Principal,
    query: {
      storeId?: string | null;
      branchId?: string | null;
      page?: string | number | null;
      pageSize?: string | number | null;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, query.branchId ?? null);

    const where: any = {};

    if (query.storeId) {
      // Validate store belongs to branch
      const store = await this.ctx.prisma.pharmacyStore.findFirst({
        where: { id: query.storeId, branchId },
        select: { id: true },
      });
      if (!store) {
        throw new BadRequestException("Invalid storeId for this branch");
      }
      where.pharmacyStoreId = query.storeId;
    } else {
      // If no storeId, find all configs for stores in this branch
      where.pharmacyStore = { branchId };
    }

    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(500, Math.max(1, Number(query.pageSize ?? 100)));
    const skip = (page - 1) * pageSize;

    const [rows, total] = await this.ctx.prisma.$transaction([
      this.ctx.prisma.inventoryConfig.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        skip,
        take: pageSize,
        include: {
          drugMaster: {
            select: {
              id: true,
              drugCode: true,
              genericName: true,
              brandName: true,
              category: true,
              isNarcotic: true,
            },
          },
          pharmacyStore: {
            select: { id: true, storeCode: true, storeName: true },
          },
        },
      }),
      this.ctx.prisma.inventoryConfig.count({ where }),
    ]);

    return { page, pageSize, total, rows };
  }

  // ----------------------------------------------------------------
  // Bulk upsert inventory configs (based on storeId + drugId unique)
  // ----------------------------------------------------------------
  async setInventoryConfigs(
    principal: Principal,
    configs: SetInventoryConfigDto[],
    branchId?: string | null,
  ) {
    if (!configs?.length) {
      throw new BadRequestException("At least one config entry is required");
    }

    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    // Collect unique store IDs and drug IDs for batch validation
    const storeIds = this.ctx.uniq(configs.map((c) => c.pharmacyStoreId));
    const drugIds = this.ctx.uniq(configs.map((c) => c.drugMasterId));

    // Validate all stores belong to this branch
    const stores = await this.ctx.prisma.pharmacyStore.findMany({
      where: { id: { in: storeIds }, branchId: bid },
      select: { id: true },
    });
    const validStoreIds = new Set(stores.map((s) => s.id));
    const invalidStores = storeIds.filter((sid) => !validStoreIds.has(sid));
    if (invalidStores.length) {
      throw new BadRequestException(
        `Invalid store IDs (not found or different branch): ${invalidStores.join(", ")}`,
      );
    }

    // Validate all drugs exist
    const drugs = await this.ctx.prisma.drugMaster.findMany({
      where: { id: { in: drugIds } },
      select: { id: true },
    });
    const validDrugIds = new Set(drugs.map((d) => d.id));
    const invalidDrugs = drugIds.filter((did) => !validDrugIds.has(did));
    if (invalidDrugs.length) {
      throw new BadRequestException(
        `Invalid drug master IDs: ${invalidDrugs.join(", ")}`,
      );
    }

    // Validate min/max stock logic per entry
    for (const cfg of configs) {
      if (
        cfg.minimumStock !== undefined && cfg.minimumStock !== null &&
        cfg.maximumStock !== undefined && cfg.maximumStock !== null &&
        cfg.minimumStock > cfg.maximumStock
      ) {
        throw new BadRequestException(
          `minimumStock (${cfg.minimumStock}) cannot exceed maximumStock (${cfg.maximumStock}) for drug ${cfg.drugMasterId} in store ${cfg.pharmacyStoreId}`,
        );
      }
    }

    const results = await this.ctx.prisma.$transaction(async (tx) => {
      const upserted = [];

      for (const cfg of configs) {
        const row = await tx.inventoryConfig.upsert({
          where: {
            pharmacyStoreId_drugMasterId: {
              pharmacyStoreId: cfg.pharmacyStoreId,
              drugMasterId: cfg.drugMasterId,
            },
          },
          create: {
            pharmacyStoreId: cfg.pharmacyStoreId,
            drugMasterId: cfg.drugMasterId,
            minimumStock: cfg.minimumStock ?? null,
            maximumStock: cfg.maximumStock ?? null,
            reorderLevel: cfg.reorderLevel ?? null,
            reorderQuantity: cfg.reorderQuantity ?? null,
            safetyStock: cfg.safetyStock ?? null,
            abcClass: cfg.abcClass ?? null,
            vedClass: cfg.vedClass ?? null,
          },
          update: {
            minimumStock: cfg.minimumStock ?? null,
            maximumStock: cfg.maximumStock ?? null,
            reorderLevel: cfg.reorderLevel ?? null,
            reorderQuantity: cfg.reorderQuantity ?? null,
            safetyStock: cfg.safetyStock ?? null,
            abcClass: cfg.abcClass ?? null,
            vedClass: cfg.vedClass ?? null,
          },
        });
        upserted.push(row);
      }

      return upserted;
    });

    await this.ctx.audit.log({
      branchId: bid,
      actorUserId: principal.userId,
      action: "PHARMACY_INVENTORY_CONFIG_SET",
      entity: "InventoryConfig",
      entityId: null,
      meta: { count: configs.length, storeIds, drugIds },
    });

    return { upserted: results.length, configs: results };
  }

  // ================================================================
  // INDENT MAPPING (store-to-store)
  // ================================================================

  // ----------------------------------------------------------------
  // List all indent mappings for a branch, include store names
  // ----------------------------------------------------------------
  async listIndentMappings(principal: Principal, branchId?: string | null) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    return this.ctx.prisma.storeIndentMapping.findMany({
      where: {
        requestingStore: { branchId: bid },
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        requestingStore: {
          select: { id: true, storeCode: true, storeName: true, storeType: true, status: true },
        },
        supplyingStore: {
          select: { id: true, storeCode: true, storeName: true, storeType: true, status: true },
        },
      },
    });
  }

  // ----------------------------------------------------------------
  // Create indent mapping. Validate stores exist, same branch,
  // no self-reference. Audit log.
  // ----------------------------------------------------------------
  async createIndentMapping(
    principal: Principal,
    dto: CreateIndentMappingDto,
    branchId?: string | null,
  ) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    // No self-reference
    if (dto.requestingStoreId === dto.supplyingStoreId) {
      throw new BadRequestException(
        "A store cannot indent from itself. requestingStoreId and supplyingStoreId must be different.",
      );
    }

    // Validate both stores exist in the same branch
    const [requestingStore, supplyingStore] = await Promise.all([
      this.ctx.prisma.pharmacyStore.findFirst({
        where: { id: dto.requestingStoreId, branchId: bid },
        select: { id: true, storeCode: true },
      }),
      this.ctx.prisma.pharmacyStore.findFirst({
        where: { id: dto.supplyingStoreId, branchId: bid },
        select: { id: true, storeCode: true },
      }),
    ]);

    if (!requestingStore) {
      throw new BadRequestException(
        "requestingStoreId is invalid or does not belong to this branch",
      );
    }
    if (!supplyingStore) {
      throw new BadRequestException(
        "supplyingStoreId is invalid or does not belong to this branch",
      );
    }

    // Check for duplicate
    const existing = await this.ctx.prisma.storeIndentMapping.findUnique({
      where: {
        requestingStoreId_supplyingStoreId: {
          requestingStoreId: dto.requestingStoreId,
          supplyingStoreId: dto.supplyingStoreId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        "An indent mapping already exists between these two stores",
      );
    }

    const mapping = await this.ctx.prisma.storeIndentMapping.create({
      data: {
        requestingStoreId: dto.requestingStoreId,
        supplyingStoreId: dto.supplyingStoreId,
        approvalRole: dto.approvalRole?.trim() || null,
        slaDurationMinutes: dto.slaDurationMinutes ?? null,
        isEmergencyOverride: dto.isEmergencyOverride ?? false,
      },
      include: {
        requestingStore: {
          select: { id: true, storeCode: true, storeName: true },
        },
        supplyingStore: {
          select: { id: true, storeCode: true, storeName: true },
        },
      },
    });

    await this.ctx.audit.log({
      branchId: bid,
      actorUserId: principal.userId,
      action: "PHARMACY_INDENT_MAPPING_CREATE",
      entity: "StoreIndentMapping",
      entityId: mapping.id,
      meta: {
        requestingStoreId: dto.requestingStoreId,
        supplyingStoreId: dto.supplyingStoreId,
      },
    });

    return mapping;
  }

  // ----------------------------------------------------------------
  // Delete indent mapping
  // ----------------------------------------------------------------
  async deleteIndentMapping(principal: Principal, id: string) {
    const mapping = await this.ctx.prisma.storeIndentMapping.findUnique({
      where: { id },
      include: {
        requestingStore: { select: { id: true, branchId: true, storeCode: true } },
        supplyingStore: { select: { id: true, storeCode: true } },
      },
    });
    if (!mapping) throw new NotFoundException("Indent mapping not found");

    this.ctx.resolveBranchId(principal, mapping.requestingStore.branchId);

    await this.ctx.prisma.storeIndentMapping.delete({ where: { id } });

    await this.ctx.audit.log({
      branchId: mapping.requestingStore.branchId,
      actorUserId: principal.userId,
      action: "PHARMACY_INDENT_MAPPING_DELETE",
      entity: "StoreIndentMapping",
      entityId: id,
      meta: {
        requestingStoreCode: mapping.requestingStore.storeCode,
        supplyingStoreCode: mapping.supplyingStore.storeCode,
      },
    });

    return { deleted: true, id };
  }

  // ================================================================
  // NARCOTICS REGISTER (immutable entries)
  // ================================================================

  // ----------------------------------------------------------------
  // List narcotics register entries (paginated, filterable)
  // ----------------------------------------------------------------
  async listNarcoticsRegister(
    principal: Principal,
    query: {
      storeId?: string | null;
      drugId?: string | null;
      from?: string | null;
      to?: string | null;
      branchId?: string | null;
      page?: string | number | null;
      pageSize?: string | number | null;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, query.branchId ?? null);

    const where: any = {
      pharmacyStore: { branchId },
    };

    if (query.storeId) {
      where.pharmacyStoreId = query.storeId;
    }

    if (query.drugId) {
      where.drugMasterId = query.drugId;
    }

    // Date range filter on createdAt
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.createdAt.lte = new Date(query.to);
      }
    }

    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 50)));
    const skip = (page - 1) * pageSize;

    const [rows, total] = await this.ctx.prisma.$transaction([
      this.ctx.prisma.narcoticsRegister.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: pageSize,
        include: {
          drugMaster: {
            select: {
              id: true,
              drugCode: true,
              genericName: true,
              brandName: true,
              scheduleClass: true,
            },
          },
          pharmacyStore: {
            select: { id: true, storeCode: true, storeName: true },
          },
          performedByUser: {
            select: { id: true, name: true },
          },
        },
      }),
      this.ctx.prisma.narcoticsRegister.count({ where }),
    ]);

    return { page, pageSize, total, rows };
  }

  // ----------------------------------------------------------------
  // Add an immutable narcotics register entry.
  // Validates store is NARCOTICS type or drug isNarcotic.
  // ----------------------------------------------------------------
  async addNarcoticsEntry(
    principal: Principal,
    entry: {
      pharmacyStoreId: string;
      drugMasterId: string;
      transactionType: string;
      quantity: number | string;
      batchNumber?: string | null;
      balanceBefore: number | string;
      balanceAfter: number | string;
      witnessName?: string | null;
      witnessSignature?: string | null;
      notes?: string | null;
    },
    branchId?: string | null,
  ) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    // Validate store exists in this branch
    const store = await this.ctx.prisma.pharmacyStore.findFirst({
      where: { id: entry.pharmacyStoreId, branchId: bid },
      select: { id: true, storeType: true, storeCode: true },
    });
    if (!store) {
      throw new BadRequestException("Invalid pharmacyStoreId for this branch");
    }

    // Validate drug exists
    const drug = await this.ctx.prisma.drugMaster.findUnique({
      where: { id: entry.drugMasterId },
      select: { id: true, drugCode: true, isNarcotic: true, scheduleClass: true },
    });
    if (!drug) {
      throw new BadRequestException("Invalid drugMasterId");
    }

    // Drug must be narcotic OR store must be NARCOTICS type
    const isNarcoticsStore = String(store.storeType) === "NARCOTICS_VAULT";
    if (!drug.isNarcotic && !isNarcoticsStore) {
      throw new BadRequestException(
        "Narcotics register entries require either a narcotic drug or a NARCOTICS_VAULT store type",
      );
    }

    // Validate quantity is positive
    const quantity = Number(entry.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException("quantity must be a positive number");
    }

    const record = await this.ctx.prisma.narcoticsRegister.create({
      data: {
        pharmacyStoreId: entry.pharmacyStoreId,
        drugMasterId: entry.drugMasterId,
        transactionType: entry.transactionType as any,
        quantity,
        batchNumber: entry.batchNumber?.trim() || null,
        balanceBefore: Number(entry.balanceBefore),
        balanceAfter: Number(entry.balanceAfter),
        witnessName: entry.witnessName?.trim() || null,
        witnessSignature: entry.witnessSignature?.trim() || null,
        notes: entry.notes?.trim() || null,
        performedByUserId: principal.userId,
      },
      include: {
        drugMaster: {
          select: { id: true, drugCode: true, genericName: true },
        },
        pharmacyStore: {
          select: { id: true, storeCode: true, storeName: true },
        },
      },
    });

    await this.ctx.audit.log({
      branchId: bid,
      actorUserId: principal.userId,
      action: "PHARMACY_NARCOTICS_ENTRY_ADD",
      entity: "NarcoticsRegister",
      entityId: record.id,
      meta: {
        storeCode: store.storeCode,
        drugCode: drug.drugCode,
        transactionType: entry.transactionType,
        quantity,
      },
    });

    return record;
  }
}
