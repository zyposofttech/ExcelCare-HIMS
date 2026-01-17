import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { parseBool } from "../../../common/http.util";
import { CreateUnitRoomDto, UpdateUnitRoomDto } from "./dto";
import { RoomsService } from "./rooms.service";

@ApiTags("infrastructure/rooms")
@Controller(["infrastructure", "infra"])
export class RoomsController {
  constructor(private readonly svc: RoomsService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("rooms")
  @Permissions(PERM.INFRA_ROOM_READ)
  async listRooms(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("unitId") unitId?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.svc.listRooms(this.principal(req), {
      branchId: branchId ?? null,
      unitId: unitId ?? null,
      includeInactive: includeInactive === "true",
    });
  }

  @Post("rooms")
  @Permissions(PERM.INFRA_ROOM_CREATE)
  async createRoom(@Req() req: any, @Body() dto: CreateUnitRoomDto) {
    return this.svc.createRoom(this.principal(req), dto);
  }

  @Patch("rooms/:id")
  @Permissions(PERM.INFRA_ROOM_UPDATE)
  async updateRoom(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateUnitRoomDto) {
    return this.svc.updateRoom(this.principal(req), id, dto);
  }

  @Delete("rooms/:id")
  @Permissions(PERM.INFRA_ROOM_UPDATE)
  async deleteRoom(
    @Req() req: any,
    @Param("id") id: string,
    @Query("hard") hard?: string,
    @Query("cascade") cascade?: string,
  ) {
    return this.svc.deactivateRoom(this.principal(req), id, {
      hard: parseBool(hard),
      cascade: cascade == null ? true : parseBool(cascade),
    });
  }
}
