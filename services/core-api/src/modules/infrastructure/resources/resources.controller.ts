import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { parseBool } from "../../../common/http.util";
import { CreateUnitResourceDto, SetResourceStateDto, UpdateUnitResourceDto } from "./dto";
import { ResourcesService } from "./resources.service";

@ApiTags("infrastructure/resources")
@Controller(["infrastructure", "infra"])
export class ResourcesController {
  constructor(private readonly svc: ResourcesService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("resources")
  @Permissions(PERM.INFRA_RESOURCE_READ)
  async listResources(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("unitId") unitId?: string,
    @Query("roomId") roomId?: string,
    @Query("resourceType") resourceType?: string,
    @Query("state") state?: string,
    @Query("q") q?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.svc.listResources(this.principal(req), {
      branchId: branchId ?? null,
      unitId: unitId ?? null,
      roomId: roomId ?? null,
      resourceType: resourceType ?? null,
      state: state ?? null,
      q: q ?? null,
      includeInactive: includeInactive === "true",
    });
  }

  @Post("resources")
  @Permissions(PERM.INFRA_RESOURCE_CREATE)
  async createResource(@Req() req: any, @Body() dto: CreateUnitResourceDto) {
    return this.svc.createResource(this.principal(req), dto);
  }

  @Patch("resources/:id")
  @Permissions(PERM.INFRA_RESOURCE_UPDATE)
  async updateResource(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateUnitResourceDto) {
    return this.svc.updateResource(this.principal(req), id, dto);
  }

  @Put("resources/:id/state")
  @Permissions(PERM.INFRA_RESOURCE_STATE_UPDATE)
  async setResourceState(@Req() req: any, @Param("id") id: string, @Body() dto: SetResourceStateDto) {
    return this.svc.setResourceState(this.principal(req), id, dto.state);
  }

  @Delete("resources/:id")
  @Permissions(PERM.INFRA_RESOURCE_UPDATE)
  async deleteResource(@Req() req: any, @Param("id") id: string, @Query("hard") hard?: string) {
    return this.svc.deactivateResource(this.principal(req), id, { hard: parseBool(hard) });
  }
}
