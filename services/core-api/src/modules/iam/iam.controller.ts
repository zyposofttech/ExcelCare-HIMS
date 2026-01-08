import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrincipalGuard } from "../auth/principal.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { Permissions } from "../auth/permissions.decorator";
import type { Principal } from "../auth/access-policy.service";
import { IamService } from "./iam.service";
import { CreateUserDto, UpdateUserDto } from "./iam.dto";
import { PERM } from "./iam.constants";

@ApiTags("iam")
@Controller("iam")
@UseGuards(PrincipalGuard, PermissionsGuard)
export class IamController {
  constructor(private iam: IamService) {}

  private principal(req: any): Principal {
    return req.principal as Principal;
  }

  @Get("roles")
  @Permissions(PERM.IAM_ROLE_READ)
  async roles(@Query() _q: any, @Param() _p: any, @Body() _b: any, req: any) {
    return this.iam.listRoles(this.principal(req));
  }

  @Get("users")
  @Permissions(PERM.IAM_USER_READ)
  async users(@Query("q") q: string | undefined, req: any) {
    return this.iam.listUsers(this.principal(req), q);
  }

  @Post("users")
  @Permissions(PERM.IAM_USER_CREATE)
  async create(@Body() dto: CreateUserDto, req: any) {
    return this.iam.createUser(this.principal(req), dto);
  }

  @Patch("users/:id")
  @Permissions(PERM.IAM_USER_UPDATE)
  async update(@Param("id") id: string, @Body() dto: UpdateUserDto, req: any) {
    return this.iam.updateUser(this.principal(req), id, dto);
  }

  @Post("users/:id/reset-password")
  @Permissions(PERM.IAM_USER_RESET_PASSWORD)
  async reset(@Param("id") id: string, req: any) {
    return this.iam.resetPassword(this.principal(req), id);
  }
}
