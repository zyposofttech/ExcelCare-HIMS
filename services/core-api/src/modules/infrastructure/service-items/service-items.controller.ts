import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreateServiceItemDto, UpdateServiceItemDto, WorkflowNoteDto } from "./dto";
import { ServiceItemsService } from "./service-items.service";

@ApiTags("infrastructure/services")
@Controller(["infrastructure", "infra"])
export class ServiceItemsController {
  constructor(private readonly svc: ServiceItemsService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Post("services")
  @Permissions(PERM.INFRA_SERVICE_CREATE)
  async createService(@Req() req: any, @Body() dto: CreateServiceItemDto, @Query("branchId") branchId?: string) {
    return this.svc.createServiceItem(this.principal(req), dto, branchId ?? null);
  }

  @Get("services")
  @Permissions(PERM.INFRA_SERVICE_READ)
  async listServices(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("q") q?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.svc.listServiceItems(this.principal(req), {
      branchId: branchId ?? null,
      q,
      includeInactive: includeInactive === "true",
    });
  }

  @Get("services/:id")
  @Permissions(PERM.INFRA_SERVICE_READ)
  async getService(@Req() req: any, @Param("id") id: string) {
    return this.svc.getServiceItem(this.principal(req), id);
  }

  @Patch("services/:id")
  @Permissions(PERM.INFRA_SERVICE_UPDATE)
  async updateService(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateServiceItemDto) {
    return this.svc.updateServiceItem(this.principal(req), id, dto);
  }

  // ---------- Workflow (use UPDATE permission for now; you can add a separate PUBLISH perm later)
  @Post("services/:id/workflow/submit")
  @Permissions(PERM.INFRA_SERVICE_UPDATE)
  async submit(@Req() req: any, @Param("id") id: string, @Body() dto: WorkflowNoteDto) {
    return this.svc.submit(this.principal(req), id, dto?.note);
  }

  @Post("services/:id/workflow/approve")
  @Permissions(PERM.INFRA_SERVICE_UPDATE)
  async approve(@Req() req: any, @Param("id") id: string, @Body() dto: WorkflowNoteDto) {
    return this.svc.approve(this.principal(req), id, dto?.note);
  }

  @Post("services/:id/workflow/publish")
  @Permissions(PERM.INFRA_SERVICE_UPDATE)
  async publish(@Req() req: any, @Param("id") id: string, @Body() dto: WorkflowNoteDto) {
    return this.svc.publish(this.principal(req), id, dto?.note);
  }

  @Post("services/:id/workflow/deprecate")
  @Permissions(PERM.INFRA_SERVICE_UPDATE)
  async deprecate(@Req() req: any, @Param("id") id: string, @Body() dto: WorkflowNoteDto) {
    return this.svc.deprecate(this.principal(req), id, dto?.note);
  }

  @Get("services/:id/versions")
  @Permissions(PERM.INFRA_SERVICE_READ)
  async versions(@Req() req: any, @Param("id") id: string) {
    return this.svc.versions(this.principal(req), id);
  }
}
