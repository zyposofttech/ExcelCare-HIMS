import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
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
    return (req?.user ?? req?.principal ?? {}) as Principal;
  }

  // ---------- CRUD ----------
  @Get("capabilities")
  list(@Req() req: any, @Query() q: ListCapabilitiesQuery) {
    return this.svc.list(this.principalFrom(req), q);
  }

  @Post("capabilities")
  create(@Req() req: any, @Body() dto: CreateCapabilityDto) {
    return this.svc.create(this.principalFrom(req), dto);
  }

  @Get("capabilities/:id")
  get(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.get(this.principalFrom(req), { id, branchId });
  }

  @Put("capabilities/:id")
  update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateCapabilityDto) {
    return this.svc.update(this.principalFrom(req), id, dto);
  }

  @Delete("capabilities/:id")
  delete(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.softDelete(this.principalFrom(req), { id, branchId });
  }

  // ---------- Allowed Rooms ----------
  @Get("capabilities/:id/rooms")
  listRooms(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listAllowedRooms(this.principalFrom(req), { capabilityId: id, branchId });
  }

  @Post("capabilities/:id/rooms")
  addRoom(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddCapabilityRoomDto) {
    return this.svc.addAllowedRoom(this.principalFrom(req), { capabilityId: id, branchId }, dto);
  }

  @Delete("capabilities/:id/rooms/:linkId")
  removeRoom(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeAllowedRoom(this.principalFrom(req), { capabilityId: id, linkId, branchId });
  }

  // ---------- Allowed Resources ----------
  @Get("capabilities/:id/resources")
  listResources(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listAllowedResources(this.principalFrom(req), { capabilityId: id, branchId });
  }

  @Post("capabilities/:id/resources")
  addResource(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddCapabilityResourceDto) {
    return this.svc.addAllowedResource(this.principalFrom(req), { capabilityId: id, branchId }, dto);
  }

  @Delete("capabilities/:id/resources/:linkId")
  removeResource(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeAllowedResource(this.principalFrom(req), { capabilityId: id, linkId, branchId });
  }

  // ---------- Allowed Equipment ----------
  @Get("capabilities/:id/equipment")
  listEquipment(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listAllowedEquipment(this.principalFrom(req), { capabilityId: id, branchId });
  }

  @Post("capabilities/:id/equipment")
  addEquipment(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddCapabilityEquipmentDto) {
    return this.svc.addAllowedEquipment(this.principalFrom(req), { capabilityId: id, branchId }, dto);
  }

  @Delete("capabilities/:id/equipment/:linkId")
  removeEquipment(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeAllowedEquipment(this.principalFrom(req), { capabilityId: id, linkId, branchId });
  }
}
