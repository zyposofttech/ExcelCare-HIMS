import { Body, Controller, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
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
    return (req?.user ?? req?.principal ?? {}) as Principal;
  }

  @Get("packs")
  listPacks(@Req() req: any, @Query() q: ListPacksQuery) {
    return this.svc.listPacks(this.principalFrom(req), q);
  }

  @Post("packs")
  createPack(@Req() req: any, @Body() dto: CreatePackDto) {
    return this.svc.createPack(this.principalFrom(req), dto);
  }

  @Put("packs/:id")
  updatePack(@Req() req: any, @Param("id") id: string, @Body() dto: UpdatePackDto) {
    return this.svc.updatePack(this.principalFrom(req), id, dto);
  }

  @Get("packs/:id/versions")
  listPackVersions(@Req() req: any, @Param("id") id: string, @Query() q: ListPackVersionsQuery) {
    return this.svc.listPackVersions(this.principalFrom(req), id, q);
  }

  @Post("packs/:id/versions")
  createPackVersion(@Req() req: any, @Param("id") id: string, @Body() dto: CreatePackVersionDto) {
    return this.svc.createPackVersion(this.principalFrom(req), id, dto);
  }

  @Put("packs/versions/:id")
  updatePackVersion(@Req() req: any, @Param("id") id: string, @Body() dto: UpdatePackVersionDto) {
    return this.svc.updatePackVersion(this.principalFrom(req), id, dto);
  }

  @Post("packs/apply")
  applyPack(@Req() req: any, @Body() dto: ApplyPackDto) {
    return this.svc.applyPack(this.principalFrom(req), dto);
  }
}
