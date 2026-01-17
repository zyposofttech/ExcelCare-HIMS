import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreateDowntimeDto, CreateEquipmentAssetDto, UpdateEquipmentAssetDto } from "./dto";
import { EquipmentService } from "./equipment.service";

@ApiTags("infrastructure/equipment")
@Controller(["infrastructure", "infra"])
export class EquipmentController {
  constructor(private readonly svc: EquipmentService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("equipment")
  @Permissions(PERM.INFRA_EQUIPMENT_READ)
  async listEquipment(@Req() req: any, @Query("branchId") branchId?: string, @Query("q") q?: string) {
    return this.svc.listEquipment(this.principal(req), { branchId: branchId ?? null, q });
  }

  @Post("equipment")
  @Permissions(PERM.INFRA_EQUIPMENT_CREATE)
  async createEquipment(@Req() req: any, @Body() dto: CreateEquipmentAssetDto, @Query("branchId") branchId?: string) {
    return this.svc.createEquipment(this.principal(req), dto, branchId ?? null);
  }

  @Patch("equipment/:id")
  @Permissions(PERM.INFRA_EQUIPMENT_UPDATE)
  async updateEquipment(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateEquipmentAssetDto) {
    return this.svc.updateEquipment(this.principal(req), id, dto);
  }

  @Post("equipment/downtime")
  @Permissions(PERM.INFRA_EQUIPMENT_UPDATE)
  async openDowntime(@Req() req: any, @Body() dto: CreateDowntimeDto) {
    return this.svc.openDowntime(this.principal(req), dto);
  }
}
