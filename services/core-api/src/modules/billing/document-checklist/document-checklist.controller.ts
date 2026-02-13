import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { DocumentChecklistService } from "./document-checklist.service";
import { CreateDocumentTemplateDto, CreateDocumentRuleDto } from "./dto";

@ApiTags("billing/document-checklists")
@Controller("billing/document-checklists")
export class DocumentChecklistController {
  constructor(private readonly svc: DocumentChecklistService) {}

  private principal(req: any) {
    return req.principal;
  }

  // ------------------------------------------------------------------ POST /templates
  @Post("templates")
  @Permissions(PERM.BILLING_DOCUMENT_CREATE)
  async createTemplate(@Req() req: any, @Body() dto: CreateDocumentTemplateDto) {
    return this.svc.createTemplate(this.principal(req), dto);
  }

  // ------------------------------------------------------------------ GET /templates
  @Get("templates")
  @Permissions(PERM.BILLING_DOCUMENT_READ)
  async listTemplates(
    @Req() req: any,
    @Query("payerId") payerId?: string,
  ) {
    return this.svc.listTemplates(this.principal(req), { payerId });
  }

  // ------------------------------------------------------------------ GET /templates/:id
  @Get("templates/:id")
  @Permissions(PERM.BILLING_DOCUMENT_READ)
  async getTemplate(@Req() req: any, @Param("id") id: string) {
    return this.svc.getTemplate(this.principal(req), id);
  }

  // ------------------------------------------------------------------ PATCH /templates/:id
  @Patch("templates/:id")
  @Permissions(PERM.BILLING_DOCUMENT_UPDATE)
  async updateTemplate(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: Partial<CreateDocumentTemplateDto>,
  ) {
    return this.svc.updateTemplate(this.principal(req), id, dto);
  }

  // ------------------------------------------------------------------ POST /templates/:id/rules
  @Post("templates/:id/rules")
  @Permissions(PERM.BILLING_DOCUMENT_CREATE)
  async addRule(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: CreateDocumentRuleDto,
  ) {
    return this.svc.addRule(this.principal(req), id, dto);
  }

  // ------------------------------------------------------------------ PATCH /rules/:ruleId
  @Patch("rules/:ruleId")
  @Permissions(PERM.BILLING_DOCUMENT_UPDATE)
  async updateRule(
    @Req() req: any,
    @Param("ruleId") ruleId: string,
    @Body() dto: Partial<CreateDocumentRuleDto>,
  ) {
    return this.svc.updateRule(this.principal(req), ruleId, dto);
  }

  // ------------------------------------------------------------------ DELETE /rules/:ruleId
  @Delete("rules/:ruleId")
  @Permissions(PERM.BILLING_DOCUMENT_UPDATE)
  async deleteRule(@Req() req: any, @Param("ruleId") ruleId: string) {
    return this.svc.deleteRule(this.principal(req), ruleId);
  }

  // ------------------------------------------------------------------ GET /completeness/:insuranceCaseId
  @Get("completeness/:insuranceCaseId")
  @Permissions(PERM.BILLING_DOCUMENT_READ)
  async getCompleteness(@Req() req: any, @Param("insuranceCaseId") insuranceCaseId: string) {
    return this.svc.getCompleteness(this.principal(req), insuranceCaseId);
  }
}
