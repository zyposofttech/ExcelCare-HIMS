import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreateInsuranceDocumentDto, UpdateInsuranceDocumentDto, LinkDocumentDto } from "./dto";
import { InsuranceDocumentService } from "./insurance-document.service";

@ApiTags("billing/insurance-documents")
@Controller("billing")
export class InsuranceDocumentController {
  constructor(private readonly svc: InsuranceDocumentService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Post("insurance-documents")
  @Permissions(PERM.BILLING_DOCUMENT_CREATE)
  async create(
    @Req() req: any,
    @Body() dto: CreateInsuranceDocumentDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.create(this.principal(req), dto, branchId ?? null);
  }

  @Get("insurance-documents")
  @Permissions(PERM.BILLING_DOCUMENT_READ)
  async list(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("docRole") docRole?: string,
  ) {
    return this.svc.list(this.principal(req), {
      branchId: branchId ?? null,
      entityType,
      entityId,
      docRole,
    });
  }

  @Get("insurance-documents/:id")
  @Permissions(PERM.BILLING_DOCUMENT_READ)
  async get(@Req() req: any, @Param("id") id: string) {
    return this.svc.get(this.principal(req), id);
  }

  @Patch("insurance-documents/:id")
  @Permissions(PERM.BILLING_DOCUMENT_UPDATE)
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateInsuranceDocumentDto,
  ) {
    return this.svc.update(this.principal(req), id, dto);
  }

  @Post("insurance-documents/:id/verify")
  @Permissions(PERM.BILLING_DOCUMENT_UPDATE)
  async verify(@Req() req: any, @Param("id") id: string) {
    return this.svc.verify(this.principal(req), id);
  }

  @Post("insurance-documents/link")
  @Permissions(PERM.BILLING_DOCUMENT_CREATE)
  async linkDocument(@Req() req: any, @Body() dto: LinkDocumentDto) {
    return this.svc.linkDocument(this.principal(req), dto);
  }

  @Delete("insurance-documents/link/:linkId")
  @Permissions(PERM.BILLING_DOCUMENT_UPDATE)
  async unlinkDocument(@Req() req: any, @Param("linkId") linkId: string) {
    return this.svc.unlinkDocument(this.principal(req), linkId);
  }
}
