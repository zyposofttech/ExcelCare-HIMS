import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DiagnosticsFacilitiesService } from "./diagnostics-facilities.service";
import {
  AddEquipmentToServicePointDto,
  AddResourceToServicePointDto,
  AddRoomToServicePointDto,
  CreateServicePointDto,
  ListServicePointsQuery,
  UpdateServicePointDto,
} from "./dto";
import type { Principal } from "./diagnostics.principal";

@ApiTags("infrastructure/diagnostics")
@Controller("infrastructure/diagnostics")
export class DiagnosticsFacilitiesController {
  constructor(private readonly svc: DiagnosticsFacilitiesService) {}

  private principalFrom(req: any): Principal {
    return (req?.user ?? req?.principal ?? {}) as Principal;
  }

  // -------- Service Points (Diagnostic Units) --------
  @Get("service-points")
  listServicePoints(@Req() req: any, @Query() q: ListServicePointsQuery) {
    return this.svc.listServicePoints(this.principalFrom(req), q);
  }

  @Post("service-points")
  createServicePoint(@Req() req: any, @Body() dto: CreateServicePointDto) {
    return this.svc.createServicePoint(this.principalFrom(req), dto);
  }

  @Get("service-points/:id")
  getServicePoint(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.getServicePoint(this.principalFrom(req), { id, branchId });
  }

  @Put("service-points/:id")
  updateServicePoint(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateServicePointDto) {
    return this.svc.updateServicePoint(this.principalFrom(req), id, dto);
  }

  @Delete("service-points/:id")
  deleteServicePoint(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.deleteServicePoint(this.principalFrom(req), { id, branchId });
  }

  // -------- Rooms --------
  @Get("service-points/:id/rooms")
  listRooms(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listRooms(this.principalFrom(req), { servicePointId: id, branchId });
  }

  @Post("service-points/:id/rooms")
  addRoom(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddRoomToServicePointDto) {
    return this.svc.addRoom(this.principalFrom(req), { servicePointId: id, branchId }, dto);
  }

  @Delete("service-points/:id/rooms/:linkId")
  removeRoom(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeRoom(this.principalFrom(req), { servicePointId: id, linkId, branchId });
  }

  // -------- Resources --------
  @Get("service-points/:id/resources")
  listResources(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listResources(this.principalFrom(req), { servicePointId: id, branchId });
  }

  @Post("service-points/:id/resources")
  addResource(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddResourceToServicePointDto) {
    return this.svc.addResource(this.principalFrom(req), { servicePointId: id, branchId }, dto);
  }

  @Delete("service-points/:id/resources/:linkId")
  removeResource(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeResource(this.principalFrom(req), { servicePointId: id, linkId, branchId });
  }

  // -------- Equipment --------
  @Get("service-points/:id/equipment")
  listEquipment(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listEquipment(this.principalFrom(req), { servicePointId: id, branchId });
  }

  @Post("service-points/:id/equipment")
  addEquipment(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddEquipmentToServicePointDto) {
    return this.svc.addEquipment(this.principalFrom(req), { servicePointId: id, branchId }, dto);
  }

  @Delete("service-points/:id/equipment/:linkId")
  removeEquipment(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeEquipment(this.principalFrom(req), { servicePointId: id, linkId, branchId });
  }
}
