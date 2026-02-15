import { BadRequestException, NotFoundException } from "@nestjs/common";
import { InfraContextService } from "../shared/infra-context.service";

const RESTRICTED_DISPENSE_TYPES = new Set([
  "MAIN",
  "OT_STORE",
  "ICU_STORE",
  "WARD_STORE",
  "NARCOTICS",
]);

export async function assertLocationNodeInBranch(
  ctx: InfraContextService,
  locationNodeId: string,
  branchId: string,
) {
  const node = await ctx.prisma.locationNode.findFirst({
    where: { id: locationNodeId, branchId },
    select: { id: true },
  });
  if (!node) throw new BadRequestException("Invalid locationNodeId for this branch");
}

export async function assertStoreInBranch(
  ctx: InfraContextService,
  storeId: string,
  branchId: string,
  select: any = { id: true },
) {
  const store = await ctx.prisma.pharmacyStore.findFirst({
    where: { id: storeId, branchId },
    select,
  });
  if (!store) throw new NotFoundException("Pharmacy store not found in this branch");
  return store as any;
}

export async function assertDrugInBranch(
  ctx: InfraContextService,
  drugId: string,
  branchId: string,
  select: any = { id: true },
) {
  const drug = await ctx.prisma.drugMaster.findFirst({
    where: { id: drugId, branchId },
    select,
  });
  if (!drug) throw new NotFoundException("Drug master not found in this branch");
  return drug as any;
}

export async function assertStaffIsPharmacistInBranch(
  ctx: InfraContextService,
  staffId: string,
  branchId: string,
  opts?: { maxStoresPerBranch?: number; ignoreStoreId?: string },
) {
  const staff = await ctx.prisma.staff.findUnique({
    where: { id: staffId },
    select: { id: true, staffType: true, status: true, primaryBranchId: true },
  });
  if (!staff) throw new BadRequestException("Pharmacist staff not found");

  // Must be ACTIVE staff
  if (String(staff.status) !== "ACTIVE") {
    throw new BadRequestException("Pharmacist-in-charge must be an ACTIVE staff member");
  }

  // Must be pharmacist (in-charge)
  if (String(staff.staffType) !== "PHARMACIST") {
    throw new BadRequestException("Selected staff is not a pharmacist");
  }

  // Must be assigned to this branch (assignment OR primary branch)
  const assigned = await ctx.prisma.staffAssignment.findFirst({
    where: {
      staffId,
      branchId,
      isActive: true,
      status: "ACTIVE" as any,
      approvalStatus: "APPROVED" as any,
    },
    select: { id: true },
  });

  if (!assigned && staff.primaryBranchId !== branchId) {
    throw new BadRequestException("Selected pharmacist is not assigned to this branch");
  }

  const max = opts?.maxStoresPerBranch ?? 2;
  if (max > 0) {
    const where: any = { branchId, pharmacistInChargeId: staffId };
    if (opts?.ignoreStoreId) where.NOT = { id: opts.ignoreStoreId };
    const cnt = await ctx.prisma.pharmacyStore.count({ where });
    if (cnt >= max) {
      throw new BadRequestException(
        `A pharmacist can be in-charge of maximum ${max} stores per branch`,
      );
    }
  }

  return staff;
}

export async function assertNoStoreHierarchyCycle(
  ctx: InfraContextService,
  storeId: string,
  proposedParentId: string,
  branchId: string,
) {
  // Build a parent map for all stores in this branch (small N).
  const stores = await ctx.prisma.pharmacyStore.findMany({
    where: { branchId },
    select: { id: true, parentStoreId: true },
  });
  const parentById = new Map<string, string | null>();
  for (const s of stores) parentById.set(s.id, s.parentStoreId ?? null);

  let cursor: string | null = proposedParentId;
  let hops = 0;

  while (cursor) {
    if (cursor === storeId) {
      throw new BadRequestException(
        "Invalid parentStoreId: would create a cycle in store hierarchy",
      );
    }
    cursor = parentById.get(cursor) ?? null;
    hops += 1;
    if (hops > 200) break; // safety guard
  }
}

export function assertCapabilitiesForStoreType(
  storeType: string,
  caps: { is24x7?: boolean; canDispense?: boolean },
) {
  if (storeType === "EMERGENCY" && caps.is24x7 === false) {
    throw new BadRequestException("Emergency pharmacy must be flagged as 24x7");
  }
  if (RESTRICTED_DISPENSE_TYPES.has(storeType) && caps.canDispense === true) {
    throw new BadRequestException(
      `Store type ${storeType} cannot be configured as a dispensing store`,
    );
  }
}
