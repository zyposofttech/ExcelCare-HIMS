import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreateLocationNodeDto, UpdateLocationNodeDto } from "./dto";
import { assertLocationCode, canonicalizeCode } from "../../../common/naming.util";

@Injectable()
export class LocationService {
  constructor(private readonly ctx: InfraContextService) {}

  async listLocations(principal: Principal, q: { branchId?: string; kind?: string; at?: string }) {
    const branchId = this.ctx.resolveBranchId(principal, q.branchId ?? null);
    const at = q.at ? new Date(q.at) : new Date();

    const nodes = await this.ctx.prisma.locationNode.findMany({
      where: {
        branchId,
        ...(q.kind ? { kind: q.kind as any } : {}),
      },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      include: {
        revisions: {
          where: {
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          },
          orderBy: [{ effectiveFrom: "desc" }],
          take: 1,
        },
      },
    });

    return nodes.map((n) => ({
      id: n.id,
      branchId: n.branchId,
      kind: n.kind,
      parentId: n.parentId,
      current: n.revisions[0] ?? null,
    }));
  }

  async getLocationTree(principal: Principal, branchIdParam?: string | null, at?: string) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);
    const when = at ? new Date(at) : new Date();

    const nodes = await this.ctx.prisma.locationNode.findMany({
      where: { branchId },
      select: {
        id: true,
        kind: true,
        parentId: true,
        revisions: {
          where: {
            effectiveFrom: { lte: when },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: when } }],
          },
          orderBy: [{ effectiveFrom: "desc" }],
          take: 1,
          select: { code: true, name: true, isActive: true, effectiveFrom: true, effectiveTo: true },
        },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    type TreeNode = {
      id: string;
      kind: any;
      parentId: string | null;
      code: string;
      name: string;
      isActive: boolean;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      children: TreeNode[];
    };

    const byId = new Map<string, TreeNode>();

    for (const n of nodes) {
      const cur = n.revisions?.[0];
      if (!cur) continue;
      byId.set(n.id, {
        id: n.id,
        kind: n.kind,
        parentId: n.parentId ?? null,
        code: cur.code,
        name: cur.name,
        isActive: cur.isActive,
        effectiveFrom: cur.effectiveFrom,
        effectiveTo: cur.effectiveTo,
        children: [],
      });
    }

    const roots: TreeNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortRec = (arr: TreeNode[]) => {
      arr.sort((a, b) => a.code.localeCompare(b.code));
      for (const x of arr) sortRec(x.children);
    };
    sortRec(roots);

    return { branchId, roots };
  }

  private async assertLocationCodeUnique(branchId: string, code: string, effectiveFrom: Date, effectiveTo: Date | null, excludeNodeId?: string) {
    const overlaps = await this.ctx.prisma.locationNodeRevision.findMany({
      where: {
        code,
        node: {
          branchId,
          ...(excludeNodeId ? { id: { not: excludeNodeId } } : {}),
        },
        effectiveFrom: { lt: effectiveTo ?? new Date("9999-12-31T00:00:00.000Z") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
      },
      select: { id: true, nodeId: true, effectiveFrom: true, effectiveTo: true },
      take: 1,
    });

    if (overlaps.length) {
      throw new BadRequestException(`Location code "${code}" already exists for an overlapping effective period.`);
    }
  }

  private async getCurrentLocationCode(nodeId: string, at: Date): Promise<string> {
    const rev = await this.ctx.prisma.locationNodeRevision.findFirst({
      where: {
        nodeId,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: [{ effectiveFrom: "desc" }],
      select: { code: true },
    });
    if (!rev) throw new BadRequestException("Parent location has no effective revision");
    return rev.code;
  }

  /**
   * Used by Units service: validates that locationNodeId belongs to branch and is active.
   */
  async assertValidLocationNode(
    branchId: string,
    locationNodeId: string,
    opts?: { allowKinds?: ("CAMPUS" | "BUILDING" | "FLOOR" | "ZONE")[] },
  ) {
    if (!locationNodeId?.trim()) throw new BadRequestException("locationNodeId is required");

    const at = new Date();
    const node = await this.ctx.prisma.locationNode.findFirst({
      where: { id: locationNodeId, branchId },
      select: {
        id: true,
        kind: true,
        parentId: true,
        revisions: {
          where: {
            effectiveFrom: { lte: at },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
          },
          orderBy: [{ effectiveFrom: "desc" }],
          take: 1,
          select: { code: true, name: true, isActive: true, effectiveFrom: true, effectiveTo: true },
        },
      },
    });

    if (!node) throw new BadRequestException("Invalid locationNodeId (must belong to your branch)");

    const current = node.revisions?.[0];
    if (!current) throw new BadRequestException("Location node has no current effective revision");
    if (!current.isActive) throw new BadRequestException("Location node is inactive (cannot assign units)");

    const allow = opts?.allowKinds;
    if (allow?.length && !allow.includes(node.kind as any)) {
      throw new BadRequestException(`Units must be mapped to one of: ${allow.join(", ")}.`);
    }

    return { id: node.id, kind: node.kind, parentId: node.parentId, current };
  }

  async createLocation(principal: Principal, dto: CreateLocationNodeDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);

    const parent = dto.parentId
      ? await this.ctx.prisma.locationNode.findFirst({ where: { id: dto.parentId, branchId }, select: { id: true, kind: true } })
      : null;

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    const rawCode = canonicalizeCode(dto.code);
    const code = assertLocationCode(dto.kind as any, rawCode, parent ? await this.getCurrentLocationCode(parent.id, new Date()) : undefined);

    await this.assertLocationCodeUnique(branchId, code, effectiveFrom, effectiveTo, undefined);

    const node = await this.ctx.prisma.locationNode.create({
      data: {
        branchId,
        kind: dto.kind as any,
        parentId: dto.parentId ?? null,
        revisions: {
          create: {
            code,
            name: dto.name.trim(),
            isActive: dto.isActive ?? true,
            effectiveFrom,
            effectiveTo,
            createdByUserId: principal.userId,
          },
        },
      },
      include: { revisions: { orderBy: [{ effectiveFrom: "desc" }], take: 1 } },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_LOCATION_CREATE",
      entity: "LocationNode",
      entityId: node.id,
      meta: dto,
    });

    return { id: node.id, kind: node.kind, parentId: node.parentId, current: node.revisions[0] };
  }

  async updateLocation(principal: Principal, id: string, dto: UpdateLocationNodeDto) {
    const node = await this.ctx.prisma.locationNode.findUnique({ where: { id }, select: { id: true, branchId: true, kind: true, parentId: true } });
    if (!node) throw new NotFoundException("Location not found");

    const branchId = this.ctx.resolveBranchId(principal, node.branchId);

    const now = new Date();
    const current = await this.ctx.prisma.locationNodeRevision.findFirst({
      where: { nodeId: id, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
      orderBy: [{ effectiveFrom: "desc" }],
    });
    if (!current) throw new BadRequestException("No current effective revision found");

    const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : now;
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    let nextCode = current.code;
    if (dto.code) {
      const parentCode = node.parentId ? await this.getCurrentLocationCode(node.parentId, effectiveFrom) : undefined;
      nextCode = assertLocationCode(node.kind as any, canonicalizeCode(dto.code), parentCode);
    }

    await this.assertLocationCodeUnique(branchId, nextCode, effectiveFrom, effectiveTo, node.id);

    const newRev = await this.ctx.prisma.$transaction(async (tx) => {
      if (current.effectiveTo == null || current.effectiveTo > effectiveFrom) {
        await tx.locationNodeRevision.update({
          where: { id: current.id },
          data: { effectiveTo: effectiveFrom },
        });
      }

      return tx.locationNodeRevision.create({
        data: {
          nodeId: node.id,
          code: nextCode,
          name: (dto.name ?? current.name).trim(),
          isActive: dto.isActive ?? current.isActive,
          effectiveFrom,
          effectiveTo,
          createdByUserId: principal.userId,
        },
      });
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_LOCATION_UPDATE",
      entity: "LocationNode",
      entityId: node.id,
      meta: dto,
    });

    return { id: node.id, kind: node.kind, parentId: node.parentId, current: newRev };
  }
}
