import { Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../../infrastructure/shared/infra-context.service";
import type { CreateDocumentTemplateDto, CreateDocumentRuleDto } from "./dto";

@Injectable()
export class DocumentChecklistService {
  constructor(private readonly ctx: InfraContextService) {}

  // ------------------------------------------------------------------ createTemplate
  async createTemplate(principal: Principal, dto: CreateDocumentTemplateDto) {
    const branchId = this.ctx.resolveBranchId(principal, null);

    const created = await this.ctx.prisma.payerDocumentTemplate.create({
      data: {
        branchId,
        payerId: dto.payerId,
        name: dto.name.trim(),
        scope: dto.scope ? (dto.scope as any) : undefined,
        caseTypes: dto.caseTypes ? (dto.caseTypes as any) : [],
        description: dto.description ?? null,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_DOC_TEMPLATE_CREATE",
      entity: "PayerDocumentTemplate",
      entityId: created.id,
      meta: dto,
    });

    return created;
  }

  // ------------------------------------------------------------------ listTemplates
  async listTemplates(
    principal: Principal,
    filters: { payerId?: string },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, null);

    const where: any = { branchId };
    if (filters.payerId) where.payerId = filters.payerId;

    return this.ctx.prisma.payerDocumentTemplate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        payer: { select: { id: true, name: true, code: true } },
      },
    });
  }

  // ------------------------------------------------------------------ getTemplate
  async getTemplate(principal: Principal, id: string) {
    const row = await this.ctx.prisma.payerDocumentTemplate.findUnique({
      where: { id },
      include: {
        payer: { select: { id: true, name: true, code: true } },
        rules: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!row) throw new NotFoundException("Document template not found");

    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  // ------------------------------------------------------------------ updateTemplate
  async updateTemplate(
    principal: Principal,
    id: string,
    dto: Partial<CreateDocumentTemplateDto>,
  ) {
    const existing = await this.ctx.prisma.payerDocumentTemplate.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Document template not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.payerDocumentTemplate.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        scope: dto.scope ? (dto.scope as any) : undefined,
        caseTypes: dto.caseTypes ? (dto.caseTypes as any) : undefined,
        description: dto.description === undefined ? undefined : (dto.description ?? null),
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_DOC_TEMPLATE_UPDATE",
      entity: "PayerDocumentTemplate",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  // ------------------------------------------------------------------ addRule
  async addRule(principal: Principal, templateId: string, dto: CreateDocumentRuleDto) {
    const template = await this.ctx.prisma.payerDocumentTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, branchId: true },
    });
    if (!template) throw new NotFoundException("Document template not found");

    const branchId = this.ctx.resolveBranchId(principal, template.branchId);

    const rule = await this.ctx.prisma.payerDocumentRule.create({
      data: {
        templateId,
        docRole: dto.docRole as any,
        label: dto.label.trim(),
        description: dto.description ?? null,
        isRequired: dto.isRequired ?? true,
        requiredAt: dto.requiredAt ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_DOC_RULE_CREATE",
      entity: "PayerDocumentRule",
      entityId: rule.id,
      meta: { templateId, ...dto },
    });

    return rule;
  }

  // ------------------------------------------------------------------ updateRule
  async updateRule(principal: Principal, ruleId: string, dto: Partial<CreateDocumentRuleDto>) {
    const rule = await this.ctx.prisma.payerDocumentRule.findUnique({
      where: { id: ruleId },
      include: { template: { select: { id: true, branchId: true } } },
    });
    if (!rule) throw new NotFoundException("Document rule not found");

    const branchId = this.ctx.resolveBranchId(principal, rule.template.branchId);

    const updated = await this.ctx.prisma.payerDocumentRule.update({
      where: { id: ruleId },
      data: {
        docRole: dto.docRole ? (dto.docRole as any) : undefined,
        label: dto.label?.trim(),
        description: dto.description === undefined ? undefined : (dto.description ?? null),
        isRequired: dto.isRequired,
        requiredAt: dto.requiredAt === undefined ? undefined : (dto.requiredAt ?? null),
        sortOrder: dto.sortOrder,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_DOC_RULE_UPDATE",
      entity: "PayerDocumentRule",
      entityId: ruleId,
      meta: dto,
    });

    return updated;
  }

  // ------------------------------------------------------------------ deleteRule
  async deleteRule(principal: Principal, ruleId: string) {
    const rule = await this.ctx.prisma.payerDocumentRule.findUnique({
      where: { id: ruleId },
      include: { template: { select: { id: true, branchId: true } } },
    });
    if (!rule) throw new NotFoundException("Document rule not found");

    const branchId = this.ctx.resolveBranchId(principal, rule.template.branchId);

    await this.ctx.prisma.payerDocumentRule.delete({ where: { id: ruleId } });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_DOC_RULE_DELETE",
      entity: "PayerDocumentRule",
      entityId: ruleId,
      meta: { templateId: rule.templateId },
    });

    return { deleted: true, id: ruleId };
  }

  // ------------------------------------------------------------------ getCompleteness
  async getCompleteness(principal: Principal, insuranceCaseId: string) {
    // 1. Load InsuranceCase with payer info
    const insuranceCase = await this.ctx.prisma.insuranceCase.findUnique({
      where: { id: insuranceCaseId },
      select: {
        id: true,
        branchId: true,
        payerId: true,
        caseType: true,
        preauthRequests: { select: { id: true } },
        claims: { select: { id: true } },
      },
    });
    if (!insuranceCase) throw new NotFoundException("Insurance case not found");

    const branchId = this.ctx.resolveBranchId(principal, insuranceCase.branchId);

    // 2. Find matching PayerDocumentTemplate for this payer + caseType
    const template = await this.ctx.prisma.payerDocumentTemplate.findFirst({
      where: {
        branchId,
        payerId: insuranceCase.payerId,
        isActive: true,
        OR: [
          { caseTypes: { has: insuranceCase.caseType } },
          { caseTypes: { isEmpty: true } },
        ],
      },
      include: {
        rules: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!template) {
      return {
        templateName: null,
        totalRequired: 0,
        totalUploaded: 0,
        missingDocs: [],
        completenessPercent: 100,
        isReadyForSubmission: true,
      };
    }

    // 3. Load all rules for that template
    const rules = template.rules;

    // 4. Load all InsuranceDocumentLinks for this case and related entities
    const entityIds = [
      insuranceCaseId,
      ...insuranceCase.preauthRequests.map((p) => p.id),
      ...insuranceCase.claims.map((c) => c.id),
    ];

    const documentLinks = await this.ctx.prisma.insuranceDocumentLink.findMany({
      where: {
        entityId: { in: entityIds },
      },
      include: {
        document: { select: { id: true, docRole: true } },
      },
    });

    // Build a set of uploaded docRoles
    const uploadedDocRoles = new Set(
      documentLinks.map((link) => link.document.docRole),
    );

    // 5. For each rule, check if a matching document exists
    const missingDocs: Array<{
      ruleId: string;
      docRole: string;
      label: string;
      isRequired: boolean;
      requiredAt: string | null;
    }> = [];

    for (const rule of rules) {
      if (!uploadedDocRoles.has(rule.docRole)) {
        missingDocs.push({
          ruleId: rule.id,
          docRole: rule.docRole,
          label: rule.label,
          isRequired: rule.isRequired,
          requiredAt: rule.requiredAt,
        });
      }
    }

    const totalRequired = rules.filter((r) => r.isRequired).length;
    const missingRequired = missingDocs.filter((d) => d.isRequired).length;
    const totalUploaded = totalRequired - missingRequired;
    const completenessPercent =
      totalRequired === 0 ? 100 : Math.round((totalUploaded / totalRequired) * 100);

    return {
      templateName: template.name,
      totalRequired,
      totalUploaded,
      missingDocs,
      completenessPercent,
      isReadyForSubmission: missingRequired === 0,
    };
  }
}
