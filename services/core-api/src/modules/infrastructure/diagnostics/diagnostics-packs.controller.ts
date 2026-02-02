import { Body, Controller, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import type { Principal } from "./diagnostics.principal";
import { DiagnosticsPacksService } from "./diagnostics-packs.service";
import {
  ApplyPackDto,
  CreatePackDto,
  CreatePackVersionDto,
  ListPackVersionsQuery,
  ListPacksQuery,
  UpdatePackDto,
  UpdatePackVersionDto,
} from "./dto";

@ApiTags("infrastructure/diagnostics")
@Controller("infrastructure/diagnostics")
export class DiagnosticsPacksController {
  constructor(private readonly svc: DiagnosticsPacksService) {}

  private principalFrom(req: any): Principal {
    return (req?.principal ?? {}) as Principal;
  }

  @Get("packs")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  listPacks(@Req() req: any, @Query() q: ListPacksQuery) {
    return this.svc.listPacks(this.principalFrom(req), q);
  }

  @Post("packs")
  @Permissions(PERM.INFRA_DIAGNOSTICS_CREATE)
  createPack(@Req() req: any, @Body() dto: CreatePackDto) {
    return this.svc.createPack(this.principalFrom(req), dto);
  }

  @Put("packs/:id")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  updatePack(@Req() req: any, @Param("id") id: string, @Body() dto: UpdatePackDto) {
    return this.svc.updatePack(this.principalFrom(req), id, dto);
  }

  @Get("packs/:id/versions")
  @Permissions(PERM.INFRA_DIAGNOSTICS_READ)
  listPackVersions(@Req() req: any, @Param("id") id: string, @Query() q: ListPackVersionsQuery) {
    return this.svc.listPackVersions(this.principalFrom(req), id, q);
  }

  @Post("packs/:id/versions")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  createPackVersion(@Req() req: any, @Param("id") id: string, @Body() dto: CreatePackVersionDto) {
    return this.svc.createPackVersion(this.principalFrom(req), id, dto);
  }

  @Put("packs/versions/:id")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  updatePackVersion(@Req() req: any, @Param("id") id: string, @Body() dto: UpdatePackVersionDto) {
    return this.svc.updatePackVersion(this.principalFrom(req), id, dto);
  }

  @Post("packs/apply")
  @Permissions(PERM.INFRA_DIAGNOSTICS_UPDATE)
  applyPack(@Req() req: any, @Body() dto: ApplyPackDto) {
    return this.svc.applyPack(this.principalFrom(req), dto);
  }
}
