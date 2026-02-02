import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
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
    return (req?.principal ?? {}) as Principal;
  }

  // -------- Service Points (Diagnostic Units) --------
  @Get("service-points")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  listServicePoints(@Req() req: any, @Query() q: ListServicePointsQuery) {
    return this.svc.listServicePoints(this.principalFrom(req), q);
  }

  @Post("service-points")
  @Permissions(PERM.INFRA_DIAGNOSTICS_CREATE)
  createServicePoint(@Req() req: any, @Body() dto: CreateServicePointDto) {
    return this.svc.createServicePoint(this.principalFrom(req), dto);
  }

  @Get("service-points/:id")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  getServicePoint(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.getServicePoint(this.principalFrom(req), { id, branchId });
  }

  @Put("service-points/:id")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  updateServicePoint(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateServicePointDto) {
    return this.svc.updateServicePoint(this.principalFrom(req), id, dto);
  }

  @Delete("service-points/:id")
  @Permissions(PERM.INFRA_DIAGNOSTICS_DELETE)
  deleteServicePoint(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.deleteServicePoint(this.principalFrom(req), { id, branchId });
  }

  // -------- Rooms --------
  @Get("service-points/:id/rooms")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  listRooms(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listRooms(this.principalFrom(req), { servicePointId: id, branchId });
  }

  @Post("service-points/:id/rooms")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  addRoom(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddRoomToServicePointDto) {
    return this.svc.addRoom(this.principalFrom(req), { servicePointId: id, branchId }, dto);
  }

  @Delete("service-points/:id/rooms/:linkId")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  removeRoom(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeRoom(this.principalFrom(req), { servicePointId: id, linkId, branchId });
  }

  // -------- Resources --------
  @Get("service-points/:id/resources")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  listResources(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listResources(this.principalFrom(req), { servicePointId: id, branchId });
  }

  @Post("service-points/:id/resources")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  addResource(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddResourceToServicePointDto) {
    return this.svc.addResource(this.principalFrom(req), { servicePointId: id, branchId }, dto);
  }

  @Delete("service-points/:id/resources/:linkId")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  removeResource(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeResource(this.principalFrom(req), { servicePointId: id, linkId, branchId });
  }

  // -------- Equipment --------
  @Get("service-points/:id/equipment")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  listEquipment(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.listEquipment(this.principalFrom(req), { servicePointId: id, branchId });
  }

  @Post("service-points/:id/equipment")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  addEquipment(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: AddEquipmentToServicePointDto) {
    return this.svc.addEquipment(this.principalFrom(req), { servicePointId: id, branchId }, dto);
  }

  @Delete("service-points/:id/equipment/:linkId")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  removeEquipment(@Req() req: any, @Param("id") id: string, @Param("linkId") linkId: string, @Query("branchId") branchId: string) {
    return this.svc.removeEquipment(this.principalFrom(req), { servicePointId: id, linkId, branchId });
  }
}
