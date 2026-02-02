import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import type { Principal } from "./diagnostics.principal";
import { DiagnosticsCapabilitiesService } from "./diagnostics-capabilities.service";
import {
  AddCapabilityEquipmentDto,
  AddCapabilityResourceDto,
  AddCapabilityRoomDto,
  CreateCapabilityDto,
  ListCapabilitiesQuery,
  UpdateCapabilityDto,
} from "./dto";

@ApiTags("infrastructure/diagnostics")
@Controller("infrastructure/diagnostics")
export class DiagnosticsCapabilitiesController {
  constructor(private readonly svc: DiagnosticsCapabilitiesService) {}

  private principalFrom(req: any): Principal {
    return (req?.principal ?? {}) as Principal;
  }

  // ---------- CRUD ----------
  @Get("capabilities")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  list(@Req() req: any, @Query() q: ListCapabilitiesQuery) {
    return this.svc.list(this.principalFrom(req), q);
  }

  @Post("capabilities")
  @Permissions(PERM.INFRA_DIAGNOSTICS_CREATE)
  create(@Req() req: any, @Body() dto: CreateCapabilityDto) {
    return this.svc.create(this.principalFrom(req), dto);
  }

  @Get("capabilities/:id")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  get(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.get(this.principalFrom(req), { id, branchId });
  }

  @Put("capabilities/:id")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateCapabilityDto) {
    return this.svc.update(this.principalFrom(req), id, dto);
  }

  @Delete("capabilities/:id")
  @Permissions(PERM.INFRA_DIAGNOSTICS_DELETE)
  delete(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.softDelete(this.principalFrom(req), { id, branchId });
  }

  // ---------- Allowed Rooms ----------
  @Get("capabilities/:id/rooms")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  listRooms(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listAllowedRooms(this.principalFrom(req), { capabilityId: id, branchId });
  }

  @Post("capabilities/:id/rooms")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  addRoom(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddCapabilityRoomDto) {
    return this.svc.addAllowedRoom(this.principalFrom(req), { capabilityId: id, branchId }, dto);
  }

  @Delete("capabilities/:id/rooms/:linkId")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  removeRoom(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeAllowedRoom(this.principalFrom(req), { capabilityId: id, linkId, branchId });
  }

  // ---------- Allowed Resources ----------
  @Get("capabilities/:id/resources")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  listResources(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listAllowedResources(this.principalFrom(req), { capabilityId: id, branchId });
  }

  @Post("capabilities/:id/resources")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  addResource(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddCapabilityResourceDto) {
    return this.svc.addAllowedResource(this.principalFrom(req), { capabilityId: id, branchId }, dto);
  }

  @Delete("capabilities/:id/resources/:linkId")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  removeResource(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeAllowedResource(this.principalFrom(req), { capabilityId: id, linkId, branchId });
  }

  // ---------- Allowed Equipment ----------
  @Get("capabilities/:id/equipment")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  listEquipment(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listAllowedEquipment(this.principalFrom(req), { capabilityId: id, branchId });
  }

  @Post("capabilities/:id/equipment")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  addEquipment(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddCapabilityEquipmentDto) {
    return this.svc.addAllowedEquipment(this.principalFrom(req), { capabilityId: id, branchId }, dto);
  }

  @Delete("capabilities/:id/equipment/:linkId")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  removeEquipment(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeAllowedEquipment(this.principalFrom(req), { capabilityId: id, linkId, branchId });
  }
}
