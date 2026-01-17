import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreateLocationNodeDto, UpdateLocationNodeDto } from "./dto";
import { LocationService } from "./location.service";

@ApiTags("infrastructure/locations")
@Controller(["infrastructure", "infra"])
export class LocationController {
  constructor(private readonly svc: LocationService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("locations")
  @Permissions(PERM.INFRA_LOCATION_READ)
  async listLocations(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("kind") kind?: string,
    @Query("at") at?: string,
  ) {
    return this.svc.listLocations(this.principal(req), { branchId, kind, at });
  }

  @Get("locations/tree")
  @Permissions(PERM.INFRA_LOCATION_READ)
  async locationTree(@Req() req: any, @Query("branchId") branchId?: string, @Query("at") at?: string) {
    const principal = this.principal(req);
    const { branchId: resolvedBranchId, roots } = await this.svc.getLocationTree(principal, branchId ?? null, at);

    // Adapt service shape (kind + children[]) -> UI shape (type + buildings/floors/zones)
    const mapNode = (n: any): any => {
      const type = n.type ?? n.kind;
      const base: any = {
        id: n.id,
        branchId: resolvedBranchId,
        type,
        parentId: n.parentId ?? null,
        code: n.code,
        name: n.name,
        isActive: n.isActive,
        effectiveFrom: n.effectiveFrom,
        effectiveTo: n.effectiveTo,
      };

      const kids: any[] = Array.isArray(n.children) ? n.children : [];
      if (type === "CAMPUS") base.buildings = kids.filter((x) => x.kind === "BUILDING").map(mapNode);
      if (type === "BUILDING") base.floors = kids.filter((x) => x.kind === "FLOOR").map(mapNode);
      if (type === "FLOOR") base.zones = kids.filter((x) => x.kind === "ZONE").map(mapNode);

      return base;
    };

    const campuses = roots.filter((r) => r.kind === "CAMPUS").map(mapNode);
    return { campuses };
  }

  // UI compatibility endpoints expected by page.tsx
  @Post("locations/campuses")
  @Permissions(PERM.INFRA_LOCATION_CREATE)
  async createCampus(@Req() req: any, @Body() body: any, @Query("branchId") branchId?: string) {
    const { branchId: bodyBranchId, ...rest } = body || {};
    const bid: string | undefined = branchId ?? bodyBranchId;
    return this.svc.createLocation(this.principal(req), { ...rest, kind: "CAMPUS" } as any, bid);
  }

  @Post("locations/buildings")
  @Permissions(PERM.INFRA_LOCATION_CREATE)
  async createBuilding(@Req() req: any, @Body() body: any, @Query("branchId") branchId?: string) {
    const { branchId: bodyBranchId, ...rest } = body || {};
    const bid: string | undefined = branchId ?? bodyBranchId;
    return this.svc.createLocation(this.principal(req), { ...rest, kind: "BUILDING" } as any, bid);
  }

  @Post("locations/floors")
  @Permissions(PERM.INFRA_LOCATION_CREATE)
  async createFloor(@Req() req: any, @Body() body: any, @Query("branchId") branchId?: string) {
    const { branchId: bodyBranchId, ...rest } = body || {};
    const bid: string | undefined = branchId ?? bodyBranchId;
    return this.svc.createLocation(this.principal(req), { ...rest, kind: "FLOOR" } as any, bid);
  }

  @Post("locations/zones")
  @Permissions(PERM.INFRA_LOCATION_CREATE)
  async createZone(@Req() req: any, @Body() body: any, @Query("branchId") branchId?: string) {
    const { branchId: bodyBranchId, ...rest } = body || {};
    const bid: string | undefined = branchId ?? bodyBranchId;
    return this.svc.createLocation(this.principal(req), { ...rest, kind: "ZONE" } as any, bid);
  }

  @Post("locations/:id/revise")
  @Permissions(PERM.INFRA_LOCATION_UPDATE)
  async reviseLocation(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    return this.svc.updateLocation(this.principal(req), id, body);
  }

  @Post("locations/:id/retire")
  @Permissions(PERM.INFRA_LOCATION_UPDATE)
  async retireLocation(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    const effectiveTo = body?.effectiveTo;
    return this.svc.updateLocation(this.principal(req), id, {
      isActive: false,
      effectiveFrom: effectiveTo,
      effectiveTo: null,
    } as any);
  }

  @Post("locations")
  @Permissions(PERM.INFRA_LOCATION_CREATE)
  async createLocation(@Req() req: any, @Body() dto: CreateLocationNodeDto, @Query("branchId") branchId?: string) {
    return this.svc.createLocation(this.principal(req), dto, branchId ?? null);
  }

  @Patch("locations/:id")
  @Permissions(PERM.INFRA_LOCATION_UPDATE)
  async updateLocation(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateLocationNodeDto) {
    return this.svc.updateLocation(this.principal(req), id, dto);
  }
}
