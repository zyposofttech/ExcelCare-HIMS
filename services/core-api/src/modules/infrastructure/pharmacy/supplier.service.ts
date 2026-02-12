import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreateSupplierDto, UpdateSupplierDto } from "./dto";

/** GSTIN regex: 2-digit state code + 5 alpha + 4 digit + 1 alpha + 1 digit + Z + 1 alphanum */
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/i;

@Injectable()
export class SupplierService {
  constructor(private readonly ctx: InfraContextService) {}

  // ----------------------------------------------------------------
  // List suppliers (paginated, with search & status filter)
  // ----------------------------------------------------------------
  async listSuppliers(
    principal: Principal,
    query: {
      branchId?: string | null;
      q?: string | null;
      status?: string | null;
      page?: string | number | null;
      pageSize?: string | number | null;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, query.branchId ?? null);

    const where: any = { branchId };

    if (query.q) {
      const q = String(query.q).trim();
      where.OR = [
        { supplierCode: { contains: q, mode: "insensitive" } },
        { supplierName: { contains: q, mode: "insensitive" } },
        { gstin: { contains: q, mode: "insensitive" } },
        { contactPerson: { contains: q, mode: "insensitive" } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 50)));
    const skip = (page - 1) * pageSize;

    const [rows, total] = await this.ctx.prisma.$transaction([
      this.ctx.prisma.pharmSupplier.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: pageSize,
        include: {
          storeMappings: {
            include: {
              pharmacyStore: {
                select: { id: true, storeCode: true, storeName: true, storeType: true },
              },
            },
          },
        },
      }),
      this.ctx.prisma.pharmSupplier.count({ where }),
    ]);

    return { page, pageSize, total, rows };
  }

  // ----------------------------------------------------------------
  // Get a single supplier with store mappings
  // ----------------------------------------------------------------
  async getSupplier(principal: Principal, id: string) {
    const supplier = await this.ctx.prisma.pharmSupplier.findUnique({
      where: { id },
      include: {
        storeMappings: {
          include: {
            pharmacyStore: {
              select: { id: true, storeCode: true, storeName: true, storeType: true, status: true },
            },
          },
        },
      },
    });

    if (!supplier) throw new NotFoundException("Supplier not found");
    this.ctx.resolveBranchId(principal, supplier.branchId);

    return supplier;
  }

  // ----------------------------------------------------------------
  // Create a new supplier. Auto-generate supplierCode SUP-XXXX.
  // Validate GSTIN format if provided. Audit log.
  // ----------------------------------------------------------------
  async createSupplier(
    principal: Principal,
    dto: CreateSupplierDto,
    branchId?: string | null,
  ) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    // Validate supplier name
    const supplierName = dto.supplierName?.trim();
    if (!supplierName) {
      throw new BadRequestException("supplierName is required");
    }

    // Validate GSTIN format if provided
    if (dto.gstin) {
      const gstin = dto.gstin.trim().toUpperCase();
      if (!GSTIN_RE.test(gstin)) {
        throw new BadRequestException(
          "Invalid GSTIN format. Expected format: 2-digit state code + PAN + entity code + Z + check digit (e.g., 27AADCB2230M1ZT)",
        );
      }
    }

    // Auto-generate supplier code: SUP-XXXX (sequential)
    let supplierCode = dto.supplierCode?.trim();
    if (!supplierCode) {
      supplierCode = await this.generateSupplierCode(bid);
    }

    const drugLicenseExpiry = dto.drugLicenseExpiry
      ? new Date(dto.drugLicenseExpiry)
      : null;

    const supplier = await this.ctx.prisma.pharmSupplier.create({
      data: {
        branchId: bid,
        supplierCode,
        supplierName,
        gstin: dto.gstin ? dto.gstin.trim().toUpperCase() : null,
        drugLicenseNumber: dto.drugLicenseNumber?.trim() || null,
        drugLicenseExpiry,
        contactPerson: dto.contactPerson?.trim() || null,
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        address: dto.address?.trim() || null,
        paymentTermsDays: dto.paymentTermsDays ?? null,
        discountTerms: dto.discountTerms?.trim() || null,
        deliveryLeadTimeDays: dto.deliveryLeadTimeDays ?? null,
        productCategories: dto.productCategories ?? undefined,
        status: "ACTIVE" as any,
      },
      include: { storeMappings: true },
    });

    await this.ctx.audit.log({
      branchId: bid,
      actorUserId: principal.userId,
      action: "PHARMACY_SUPPLIER_CREATE",
      entity: "PharmSupplier",
      entityId: supplier.id,
      meta: { supplierCode, supplierName },
    });

    return supplier;
  }

  // ----------------------------------------------------------------
  // Update a supplier (PATCH semantics). Audit log.
  // ----------------------------------------------------------------
  async updateSupplier(
    principal: Principal,
    id: string,
    dto: UpdateSupplierDto,
  ) {
    const existing = await this.ctx.prisma.pharmSupplier.findUnique({
      where: { id },
      select: { id: true, branchId: true, supplierCode: true },
    });
    if (!existing) throw new NotFoundException("Supplier not found");

    this.ctx.resolveBranchId(principal, existing.branchId);

    // Validate GSTIN format if provided
    if (dto.gstin !== undefined && dto.gstin !== null) {
      const gstin = dto.gstin.trim().toUpperCase();
      if (gstin && !GSTIN_RE.test(gstin)) {
        throw new BadRequestException(
          "Invalid GSTIN format. Expected format: 2-digit state code + PAN + entity code + Z + check digit (e.g., 27AADCB2230M1ZT)",
        );
      }
    }

    const data: any = {};

    if (dto.supplierName !== undefined) data.supplierName = dto.supplierName.trim();
    if (dto.gstin !== undefined) data.gstin = dto.gstin ? dto.gstin.trim().toUpperCase() : null;
    if (dto.drugLicenseNumber !== undefined) data.drugLicenseNumber = dto.drugLicenseNumber?.trim() || null;
    if (dto.drugLicenseExpiry !== undefined) data.drugLicenseExpiry = dto.drugLicenseExpiry ? new Date(dto.drugLicenseExpiry) : null;
    if (dto.contactPerson !== undefined) data.contactPerson = dto.contactPerson?.trim() || null;
    if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
    if (dto.email !== undefined) data.email = dto.email?.trim() || null;
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.paymentTermsDays !== undefined) data.paymentTermsDays = dto.paymentTermsDays;
    if (dto.discountTerms !== undefined) data.discountTerms = dto.discountTerms?.trim() || null;
    if (dto.deliveryLeadTimeDays !== undefined) data.deliveryLeadTimeDays = dto.deliveryLeadTimeDays;
    if (dto.productCategories !== undefined) data.productCategories = dto.productCategories;
    if (dto.status !== undefined) data.status = dto.status as any;

    const updated = await this.ctx.prisma.pharmSupplier.update({
      where: { id },
      data,
      include: {
        storeMappings: {
          include: {
            pharmacyStore: {
              select: { id: true, storeCode: true, storeName: true, storeType: true },
            },
          },
        },
      },
    });

    await this.ctx.audit.log({
      branchId: existing.branchId,
      actorUserId: principal.userId,
      action: "PHARMACY_SUPPLIER_UPDATE",
      entity: "PharmSupplier",
      entityId: id,
      meta: { supplierCode: existing.supplierCode, changes: dto },
    });

    return updated;
  }

  // ----------------------------------------------------------------
  // Replace supplier-to-store mappings (delete existing, create new)
  // ----------------------------------------------------------------
  async mapSupplierToStores(
    principal: Principal,
    supplierId: string,
    storeIds: string[],
  ) {
    const supplier = await this.ctx.prisma.pharmSupplier.findUnique({
      where: { id: supplierId },
      select: { id: true, branchId: true, supplierCode: true },
    });
    if (!supplier) throw new NotFoundException("Supplier not found");

    this.ctx.resolveBranchId(principal, supplier.branchId);

    const uniqueStoreIds = this.ctx.uniq(storeIds);

    // Validate all store IDs belong to the same branch
    if (uniqueStoreIds.length) {
      const stores = await this.ctx.prisma.pharmacyStore.findMany({
        where: {
          id: { in: uniqueStoreIds },
          branchId: supplier.branchId,
        },
        select: { id: true },
      });

      const foundIds = new Set(stores.map((s) => s.id));
      const missing = uniqueStoreIds.filter((sid) => !foundIds.has(sid));
      if (missing.length) {
        throw new BadRequestException(
          `Invalid store IDs (not found or different branch): ${missing.join(", ")}`,
        );
      }
    }

    // Transaction: delete all existing mappings, then create new ones
    const result = await this.ctx.prisma.$transaction(async (tx) => {
      await tx.supplierStoreMapping.deleteMany({
        where: { supplierId },
      });

      if (uniqueStoreIds.length) {
        await tx.supplierStoreMapping.createMany({
          data: uniqueStoreIds.map((pharmacyStoreId) => ({
            supplierId,
            pharmacyStoreId,
          })),
        });
      }

      return tx.pharmSupplier.findUniqueOrThrow({
        where: { id: supplierId },
        include: {
          storeMappings: {
            include: {
              pharmacyStore: {
                select: { id: true, storeCode: true, storeName: true, storeType: true },
              },
            },
          },
        },
      });
    });

    await this.ctx.audit.log({
      branchId: supplier.branchId,
      actorUserId: principal.userId,
      action: "PHARMACY_SUPPLIER_STORE_MAP",
      entity: "PharmSupplier",
      entityId: supplierId,
      meta: { supplierCode: supplier.supplierCode, storeIds: uniqueStoreIds },
    });

    return result;
  }

  // ----------------------------------------------------------------
  // Private: Generate supplier code SUP-XXXX
  // ----------------------------------------------------------------
  private async generateSupplierCode(branchId: string): Promise<string> {
    const latest = await this.ctx.prisma.pharmSupplier.findFirst({
      where: {
        branchId,
        supplierCode: { startsWith: "SUP-" },
      },
      orderBy: [{ supplierCode: "desc" }],
      select: { supplierCode: true },
    });

    let nextNum = 1;
    if (latest?.supplierCode) {
      const match = latest.supplierCode.match(/^SUP-(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    return `SUP-${String(nextNum).padStart(4, "0")}`;
  }
}
