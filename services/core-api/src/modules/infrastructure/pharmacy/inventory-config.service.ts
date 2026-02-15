import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type {
  AddNarcoticsEntryDto,
  CreateIndentMappingDto,
  SetInventoryConfigDto,
} from "./dto";

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
      drugId?: string | null;
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

    if (query.drugId) {
      const drug = await this.ctx.prisma.drugMaster.findFirst({
        where: { id: query.drugId, branchId },
        select: { id: true },
      });
      if (!drug) {
        throw new BadRequestException("Invalid drugId for this branch");
      }
      where.drugMasterId = query.drugId;
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
              status: true,
            },
          },
          pharmacyStore: {
            select: { id: true, storeCode: true, storeName: true, status: true },
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

    // Validate all drugs exist in THIS branch
    const drugs = await this.ctx.prisma.drugMaster.findMany({
      where: { id: { in: drugIds }, branchId: bid },
      select: { id: true },
    });
    const validDrugIds = new Set(drugs.map((d) => d.id));
    const invalidDrugs = drugIds.filter((did) => !validDrugIds.has(did));
    if (invalidDrugs.length) {
      throw new BadRequestException(
        `Invalid drug master IDs (not found or different branch): ${invalidDrugs.join(", ")}`,
      );
    }

    // Validate min/max stock logic per entry
    for (const cfg of configs) {
      if (
        cfg.minimumStock !== undefined &&
        cfg.minimumStock !== null &&
        cfg.maximumStock !== undefined &&
        cfg.maximumStock !== null &&
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

  async deleteInventoryConfig(principal: Principal, id: string) {
    const row = await this.ctx.prisma.inventoryConfig.findUnique({
      where: { id },
      include: {
        pharmacyStore: { select: { id: true, branchId: true, storeCode: true } },
        drugMaster: { select: { id: true, drugCode: true } },
      },
    });
    if (!row) throw new NotFoundException("Inventory config not found");

    const bid = this.ctx.resolveBranchId(principal, row.pharmacyStore.branchId);

    await this.ctx.prisma.inventoryConfig.delete({ where: { id } });

    await this.ctx.audit.log({
      branchId: bid,
      actorUserId: principal.userId,
      action: "PHARMACY_INVENTORY_CONFIG_DELETE",
      entity: "InventoryConfig",
      entityId: id,
      meta: {
        storeCode: row.pharmacyStore.storeCode,
        drugCode: row.drugMaster.drugCode,
      },
    });

    return { deleted: true, id };
  }

  // ================================================================
  // INDENT MAPPING (store-to-store)
  // ================================================================

  async listIndentMappings(principal: Principal, branchId?: string | null) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    return this.ctx.prisma.storeIndentMapping.findMany({
      where: {
        requestingStore: { branchId: bid },
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        requestingStore: {
          select: {
            id: true,
            storeCode: true,
            storeName: true,
            storeType: true,
            status: true,
          },
        },
        supplyingStore: {
          select: {
            id: true,
            storeCode: true,
            storeName: true,
            storeType: true,
            status: true,
          },
        },
      },
    });
  }

  async createIndentMapping(
    principal: Principal,
    dto: CreateIndentMappingDto,
    branchId?: string | null,
  ) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    if (dto.requestingStoreId === dto.supplyingStoreId) {
      throw new BadRequestException(
        "A store cannot indent from itself. requestingStoreId and supplyingStoreId must be different.",
      );
    }

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

  async deleteIndentMapping(principal: Principal, id: string) {
    const mapping = await this.ctx.prisma.storeIndentMapping.findUnique({
      where: { id },
      include: {
        requestingStore: {
          select: { id: true, branchId: true, storeCode: true },
        },
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

    if (query.storeId) {
      const store = await this.ctx.prisma.pharmacyStore.findFirst({
        where: { id: query.storeId, branchId },
        select: { id: true },
      });
      if (!store) throw new BadRequestException("Invalid storeId for this branch");
    }

    if (query.drugId) {
      const drug = await this.ctx.prisma.drugMaster.findFirst({
        where: { id: query.drugId, branchId },
        select: { id: true },
      });
      if (!drug) throw new BadRequestException("Invalid drugId for this branch");
    }

    const where: any = { pharmacyStore: { branchId } };

    if (query.storeId) where.pharmacyStoreId = query.storeId;
    if (query.drugId) where.drugMasterId = query.drugId;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
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
              isNarcotic: true,
            },
          },
          pharmacyStore: {
            select: { id: true, storeCode: true, storeName: true, storeType: true },
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

  async addNarcoticsEntry(
    principal: Principal,
    entry: AddNarcoticsEntryDto,
    branchId?: string | null,
  ) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    const store = await this.ctx.prisma.pharmacyStore.findFirst({
      where: { id: entry.pharmacyStoreId, branchId: bid },
      select: { id: true, storeType: true, status: true, storeCode: true },
    });
    if (!store) {
      throw new BadRequestException("Invalid pharmacyStoreId for this branch");
    }
    if (String(store.storeType) !== "NARCOTICS") {
      throw new BadRequestException(
        "Narcotics register entries can only be recorded in a NARCOTICS store",
      );
    }
    if (String(store.status) !== "ACTIVE") {
      throw new BadRequestException(
        "Narcotics register store must be ACTIVE to add entries",
      );
    }

    const drug = await this.ctx.prisma.drugMaster.findFirst({
      where: { id: entry.drugMasterId, branchId: bid },
      select: {
        id: true,
        drugCode: true,
        isNarcotic: true,
        scheduleClass: true,
        status: true,
      },
    });
    if (!drug) {
      throw new BadRequestException("Invalid drugMasterId for this branch");
    }
    if (String(drug.status) !== "ACTIVE") {
      throw new BadRequestException(
        "Only ACTIVE drugs can be used for narcotics register entries",
      );
    }
    if (!drug.isNarcotic) {
      throw new BadRequestException(
        "Only narcotic/controlled drugs are allowed in the narcotics register",
      );
    }

    const txType = String(entry.transactionType);
    const allowed = new Set(["RECEIPT", "ISSUE", "WASTAGE", "ADJUSTMENT"]);
    if (!allowed.has(txType)) throw new BadRequestException("Invalid transactionType");

    const quantity = Number(entry.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException("quantity must be a positive number");
    }

    const balanceBefore = Number(entry.balanceBefore);
    const balanceAfter = Number(entry.balanceAfter);
    if (!Number.isFinite(balanceBefore) || balanceBefore < 0) {
      throw new BadRequestException("balanceBefore must be a non-negative number");
    }
    if (!Number.isFinite(balanceAfter) || balanceAfter < 0) {
      throw new BadRequestException("balanceAfter must be a non-negative number");
    }

    // Balance integrity (deterministic)
    if (txType === "RECEIPT") {
      const expected = balanceBefore + quantity;
      if (Math.abs(expected - balanceAfter) > 1e-9) {
        throw new BadRequestException(
          "For RECEIPT, balanceAfter must equal balanceBefore + quantity",
        );
      }
    } else if (txType === "ISSUE" || txType === "WASTAGE") {
      const expected = balanceBefore - quantity;
      if (expected < 0) {
        throw new BadRequestException("Insufficient balance for this transaction");
      }
      if (Math.abs(expected - balanceAfter) > 1e-9) {
        throw new BadRequestException(
          "For ISSUE/WASTAGE, balanceAfter must equal balanceBefore - quantity",
        );
      }
    } else if (txType === "ADJUSTMENT") {
      if (!entry.notes || !String(entry.notes).trim()) {
        throw new BadRequestException("notes is required for ADJUSTMENT entries");
      }
    }

    // Witness enforcement (minimum compliance gate)
    if (["WASTAGE", "ADJUSTMENT"].includes(txType)) {
      if (!entry.witnessName || !String(entry.witnessName).trim()) {
        throw new BadRequestException(
          "witnessName is required for WASTAGE/ADJUSTMENT entries",
        );
      }
    }

    const record = await this.ctx.prisma.narcoticsRegister.create({
      data: {
        pharmacyStoreId: entry.pharmacyStoreId,
        drugMasterId: entry.drugMasterId,
        transactionType: entry.transactionType as any,
        quantity,
        batchNumber: entry.batchNumber?.trim() || null,
        balanceBefore,
        balanceAfter,
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
