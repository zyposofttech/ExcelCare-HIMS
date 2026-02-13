import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { PreauthService } from "./preauth.service";
import { CreatePreauthDto, UpdatePreauthDto, PreauthQueryDto } from "./dto";

@ApiTags("billing/preauth")
@Controller("billing/preauth")
export class PreauthController {
  constructor(private readonly svc: PreauthService) {}

  private principal(req: any) {
    return req.principal;
  }

  // ------------------------------------------------------------------ POST /
  @Post()
  @Permissions(PERM.BILLING_PREAUTH_CREATE)
  async create(
    @Req() req: any,
    @Body() dto: CreatePreauthDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.create(this.principal(req), dto, branchId ?? null);
  }

  // ------------------------------------------------------------------ GET /
  @Get()
  @Permissions(PERM.BILLING_PREAUTH_READ)
  async list(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("insuranceCaseId") insuranceCaseId?: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
  ) {
    return this.svc.list(this.principal(req), {
      branchId: branchId ?? null,
      insuranceCaseId,
      status,
      q,
    });
  }

  // ------------------------------------------------------------------ GET /:id
  @Get(":id")
  @Permissions(PERM.BILLING_PREAUTH_READ)
  async get(@Req() req: any, @Param("id") id: string) {
    return this.svc.get(this.principal(req), id);
  }

  // ------------------------------------------------------------------ PATCH /:id
  @Patch(":id")
  @Permissions(PERM.BILLING_PREAUTH_UPDATE)
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdatePreauthDto,
  ) {
    return this.svc.update(this.principal(req), id, dto);
  }

  // ------------------------------------------------------------------ POST /:id/submit
  @Post(":id/submit")
  @Permissions(PERM.BILLING_PREAUTH_UPDATE)
  async submit(@Req() req: any, @Param("id") id: string) {
    return this.svc.submit(this.principal(req), id);
  }

  // ------------------------------------------------------------------ POST /:id/approve
  @Post(":id/approve")
  @Permissions(PERM.BILLING_PREAUTH_APPROVE)
  async approve(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { approvedAmount?: number; validTill?: string },
  ) {
    return this.svc.approve(this.principal(req), id, body);
  }

  // ------------------------------------------------------------------ POST /:id/reject
  @Post(":id/reject")
  @Permissions(PERM.BILLING_PREAUTH_APPROVE)
  async reject(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { rejectionReason?: string },
  ) {
    return this.svc.reject(this.principal(req), id, body);
  }

  // ------------------------------------------------------------------ POST /:id/queries
  @Post(":id/queries")
  @Permissions(PERM.BILLING_PREAUTH_UPDATE)
  async addQuery(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: PreauthQueryDto,
  ) {
    return this.svc.addQuery(this.principal(req), id, dto);
  }
}
