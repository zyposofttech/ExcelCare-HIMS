import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

// FIX: remove @prisma/client dependency from this module
import {
  DiagnosticKind,
  DiagnosticResultDataType,
  DiagnosticTemplateKind,
} from "./diagnostics.types";

// FIX: correct relative path to src/prisma
import { Inject } from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";

export type Principal = {
  userId?: string;
  roleCode?: string;
  branchId?: string;
};

const CODE_REGEX = /^[A-Z0-9][A-Z0-9-]{0,31}$/; // 1-32 chars, allows TH01, OT-1, LAB1

function normalizeCode(input: any): string {
  return String(input ?? "").trim().toUpperCase();
}

function assertCode(input: any, label: string): string {
  const code = normalizeCode(input);
  if (!code) throw new BadRequestException(`${label} code is required`);
  if (!CODE_REGEX.test(code)) {
    throw new BadRequestException(
      `${label} code must be 1–32 chars, letters/numbers/hyphen (examples: TH01, OT-1, LAB1)`
    );
  }
  return code;
}
function parseMl(input: any): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;

  const s = String(input).trim();
  if (!s) return null;

  // Accept "5", "5.5", "5 ml", "5ml"
  const m = s.match(/([0-9]+(\.[0-9]+)?)/);
  if (!m) return null;

  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function assertName(input: any, label: string): string {
  const v = String(input ?? "").trim();
  if (!v) throw new BadRequestException(`${label} name is required`);
  if (v.length > 200) throw new BadRequestException(`${label} name is too long`);
  return v;
}

export class DiagnosticsConfigService {
  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) { }

  // ---------------------- Branch scoping ----------------------
  private resolveBranchId(principal: Principal, branchId?: string): string {
    if (principal?.branchId) {
      if (branchId && principal.branchId !== branchId) {
        throw new ForbiddenException("Cross-branch access is not allowed");
      }
      return principal.branchId;
    }
    if (!branchId) throw new BadRequestException("branchId is required");
    return branchId;
  }

  // ---------------------- Sections ----------------------
  async listSections(
    principal: Principal,
    q: { branchId?: string; includeInactive?: boolean; q?: string }
  ) {
    const branchId = this.resolveBranchId(principal, q.branchId);

    // FIX: avoid Prisma types so module compiles without @prisma/client
    const where: any = {
      branchId,
      ...(q.includeInactive ? {} : { isActive: true }),
      ...(q.q
        ? {
          OR: [
            { code: { contains: q.q, mode: "insensitive" } },
            { name: { contains: q.q, mode: "insensitive" } },
          ],
        }
        : {}),
    };

    return this.prisma.diagnosticSection.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async createSection(
    principal: Principal,
    dto: { branchId?: string; code: string; name: string; sortOrder?: number }
  ) {
    const branchId = this.resolveBranchId(principal, dto.branchId);
    const code = assertCode(dto.code, "Section");
    const name = assertName(dto.name, "Section");

    return this.prisma.diagnosticSection.create({
      data: {
        branchId,
        code,
        name,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateSection(
    principal: Principal,
    id: string,
    dto: {
      code?: string;
      name?: string;
      sortOrder?: number;
      isActive?: boolean;
      branchId?: string;
    }
  ) {
    const existing = await this.prisma.diagnosticSection.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Section not found");
    this.resolveBranchId(principal, dto.branchId ?? existing.branchId);

    return this.prisma.diagnosticSection.update({
      where: { id },
      data: {
        ...(dto.code ? { code: assertCode(dto.code, "Section") } : {}),
        ...(dto.name ? { name: assertName(dto.name, "Section") } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteSection(principal: Principal, id: string) {
    const existing = await this.prisma.diagnosticSection.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Section not found");
    this.resolveBranchId(principal, existing.branchId);

    return this.prisma.diagnosticSection.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---------------------- Categories ----------------------
  async listCategories(
    principal: Principal,
    q: { branchId?: string; sectionId?: string; includeInactive?: boolean; q?: string }
  ) {
    const branchId = this.resolveBranchId(principal, q.branchId);

    const where: any = {
      branchId,
      ...(q.sectionId ? { sectionId: q.sectionId } : {}),
      ...(q.includeInactive ? {} : { isActive: true }),
      ...(q.q
        ? {
          OR: [
            { code: { contains: q.q, mode: "insensitive" } },
            { name: { contains: q.q, mode: "insensitive" } },
          ],
        }
        : {}),
    };

    return this.prisma.diagnosticCategory.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { section: true },
    });
  }

  async createCategory(
    principal: Principal,
    dto: { branchId?: string; sectionId: string; code: string; name: string; sortOrder?: number }
  ) {
    const branchId = this.resolveBranchId(principal, dto.branchId);

    const section = await this.prisma.diagnosticSection.findFirst({
      where: { id: dto.sectionId, branchId, isActive: true },
      select: { id: true },
    });
    if (!section) throw new BadRequestException("Invalid sectionId for this branch");

    const code = assertCode(dto.code, "Category");
    const name = assertName(dto.name, "Category");

    return this.prisma.diagnosticCategory.create({
      data: {
        branchId,
        sectionId: dto.sectionId,
        code,
        name,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { section: true },
    });
  }

  async updateCategory(
    principal: Principal,
    id: string,
    dto: { code?: string; name?: string; sortOrder?: number; isActive?: boolean; branchId?: string; sectionId?: string }
  ) {
    const existing = await this.prisma.diagnosticCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Category not found");
    const branchId = this.resolveBranchId(principal, dto.branchId ?? existing.branchId);

    if (dto.sectionId && dto.sectionId !== existing.sectionId) {
      const section = await this.prisma.diagnosticSection.findFirst({
        where: { id: dto.sectionId, branchId, isActive: true },
        select: { id: true },
      });
      if (!section) throw new BadRequestException("Invalid sectionId for this branch");
    }

    return this.prisma.diagnosticCategory.update({
      where: { id },
      data: {
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
        ...(dto.code ? { code: assertCode(dto.code, "Category") } : {}),
        ...(dto.name ? { name: assertName(dto.name, "Category") } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { section: true },
    });
  }

  async deleteCategory(principal: Principal, id: string) {
    const existing = await this.prisma.diagnosticCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Category not found");
    this.resolveBranchId(principal, existing.branchId);

    return this.prisma.diagnosticCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---------------------- Specimens ----------------------
  async listSpecimens(
    principal: Principal,
    q: { branchId?: string; includeInactive?: boolean; q?: string }
  ) {
    const branchId = this.resolveBranchId(principal, q.branchId);

    const where: any = {
      branchId,
      ...(q.includeInactive ? {} : { isActive: true }),
      ...(q.q
        ? {
          OR: [
            { code: { contains: q.q, mode: "insensitive" } },
            { name: { contains: q.q, mode: "insensitive" } },
          ],
        }
        : {}),
    };

    return this.prisma.specimenType.findMany({
      where,
      orderBy: [{ name: "asc" }, { code: "asc" }],
    });

  }

  async createSpecimen(
    principal: Principal,
    dto: {
      branchId?: string;
      code: string;
      name: string;
      container?: string;
      minVolume?: string;
      handlingNotes?: string;
      sortOrder?: number;
    }
  ) {
    const branchId = this.resolveBranchId(principal, dto.branchId);

    const code = assertCode(dto.code, "Specimen");
    const name = assertName(dto.name, "Specimen");

    return this.prisma.specimenType.create({
      data: {
        branchId,
        code,
        name,
        container: dto.container?.trim() || null,
        minVolumeMl: parseMl((dto as any).minVolumeMl ?? dto.minVolume),
        handlingNotes: dto.handlingNotes?.trim() || null,
      },

    });
  }

  async updateSpecimen(
    principal: Principal,
    id: string,
    dto: {
      branchId?: string;
      code?: string;
      name?: string;
      container?: string | null;
      minVolume?: string | null;
      handlingNotes?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await this.prisma.specimenType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Specimen not found");
    this.resolveBranchId(principal, dto.branchId ?? existing.branchId);

    return this.prisma.specimenType.update({
      where: { id },
      data: {
        ...(dto.code ? { code: assertCode(dto.code, "Specimen") } : {}),
        ...(dto.name ? { name: assertName(dto.name, "Specimen") } : {}),
        ...(dto.container !== undefined ? { container: dto.container?.trim() || null } : {}),
        ...(dto.minVolume !== undefined || (dto as any).minVolumeMl !== undefined
  ? { minVolumeMl: parseMl((dto as any).minVolumeMl ?? dto.minVolume) }
  : {}),
        ...(dto.handlingNotes !== undefined ? { handlingNotes: dto.handlingNotes?.trim() || null } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteSpecimen(principal: Principal, id: string) {
    const existing = await this.prisma.specimenType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Specimen not found");
    this.resolveBranchId(principal, existing.branchId);

    // Prevent delete if used by active LAB items
    const used = await this.prisma.diagnosticItem.count({
      where: { specimenId: id, isActive: true },
    });
    if (used > 0) throw new BadRequestException("Cannot delete specimen: it is used by active diagnostic items");

    return this.prisma.specimenType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---------------------- Items ----------------------
  async listItems(
    principal: Principal,
    q: {
      branchId?: string;
      kind?: DiagnosticKind;
      sectionId?: string;
      categoryId?: string;
      includeInactive?: boolean;
      isPanel?: boolean;
      q?: string;
    }
  ) {
    const branchId = this.resolveBranchId(principal, q.branchId);

    const where: any = {
      branchId,
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.sectionId ? { sectionId: q.sectionId } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.isPanel !== undefined ? { isPanel: q.isPanel } : {}),
      ...(q.includeInactive ? {} : { isActive: true }),
      ...(q.q
        ? {
          OR: [
            { code: { contains: q.q, mode: "insensitive" } },
            { name: { contains: q.q, mode: "insensitive" } },
          ],
        }
        : {}),
    };

    return this.prisma.diagnosticItem.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        section: true,
        category: true,
        specimen: true,
      },
    });
  }

  async createItem(
    principal: Principal,
    dto: {
      branchId?: string;
      code: string;
      name: string;
      kind: DiagnosticKind;
      sectionId: string;
      categoryId?: string;
      specimenId?: string;
      isPanel?: boolean;
      tatMinutes?: number;
      statTatMinutes?: number;
      preparationText?: string;
      consentRequired?: boolean;
      appointmentRequired?: boolean;
      sortOrder?: number;
    }
  ) {
    const branchId = this.resolveBranchId(principal, dto.branchId);

    const section = await this.prisma.diagnosticSection.findFirst({
      where: { id: dto.sectionId, branchId, isActive: true },
      select: { id: true },
    });
    if (!section) throw new BadRequestException("Invalid sectionId for this branch");

    if (dto.categoryId) {
      const category = await this.prisma.diagnosticCategory.findFirst({
        where: { id: dto.categoryId, branchId, isActive: true },
        select: { id: true },
      });
      if (!category) throw new BadRequestException("Invalid categoryId for this branch");
    }

    if (dto.kind !== DiagnosticKind.LAB && dto.specimenId) {
      throw new BadRequestException("specimenId can be used only for LAB items");
    }
    if (dto.kind === DiagnosticKind.LAB && dto.specimenId) {
      const specimen = await this.prisma.specimenType.findFirst({
        where: { id: dto.specimenId, branchId, isActive: true },
        select: { id: true },
      });
      if (!specimen) throw new BadRequestException("Invalid specimenId for this branch");
    }

    // If isPanel=true for LAB, specimenId must be null (panel has many items/specimens differ)
    if (dto.isPanel && dto.kind === DiagnosticKind.LAB && dto.specimenId) {
      throw new BadRequestException("LAB panels should not have a specimenId. Set specimen at child tests.");
    }

    const code = assertCode(dto.code, "Item");
    const name = assertName(dto.name, "Item");

    return this.prisma.diagnosticItem.create({
      data: {
        branchId,
        code,
        name,
        kind: dto.kind,
        sectionId: dto.sectionId,
        categoryId: dto.categoryId ?? null,
        specimenId: dto.specimenId ?? null,
        isPanel: dto.isPanel ?? false,
        //tatMinutes: dto.tatMinutes ?? null,
        //statTatMinutes: dto.statTatMinutes ?? null,
        preparationText: dto.preparationText?.trim() || null,
        consentRequired: dto.consentRequired ?? false,
        //appointmentRequired: dto.appointmentRequired ?? (dto.kind === DiagnosticKind.IMAGING),
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { section: true, category: true, specimen: true },
    });
  }

  async updateItem(
    principal: Principal,
    id: string,
    dto: {
      branchId?: string;
      code?: string;
      name?: string;
      sectionId?: string;
      categoryId?: string | null;
      specimenId?: string | null;
      tatMinutes?: number | null;
      statTatMinutes?: number | null;
      preparationText?: string | null;
      consentRequired?: boolean;
      appointmentRequired?: boolean;
      isPanel?: boolean;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await this.prisma.diagnosticItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Item not found");
    const branchId = this.resolveBranchId(principal, dto.branchId ?? existing.branchId);

    if (dto.sectionId && dto.sectionId !== existing.sectionId) {
      const section = await this.prisma.diagnosticSection.findFirst({
        where: { id: dto.sectionId, branchId, isActive: true },
        select: { id: true },
      });
      if (!section) throw new BadRequestException("Invalid sectionId for this branch");
    }

    if (dto.categoryId !== undefined && dto.categoryId) {
      const category = await this.prisma.diagnosticCategory.findFirst({
        where: { id: dto.categoryId, branchId, isActive: true },
        select: { id: true },
      });
      if (!category) throw new BadRequestException("Invalid categoryId for this branch");
    }

    if (dto.specimenId !== undefined && dto.specimenId) {
      if (existing.kind !== DiagnosticKind.LAB) {
        throw new BadRequestException("specimenId can be used only for LAB items");
      }
      const specimen = await this.prisma.specimenType.findFirst({
        where: { id: dto.specimenId, branchId, isActive: true },
        select: { id: true },
      });
      if (!specimen) throw new BadRequestException("Invalid specimenId for this branch");
    }

    return this.prisma.diagnosticItem.update({
      where: { id },
      data: {
        ...(dto.code ? { code: assertCode(dto.code, "Item") } : {}),
        ...(dto.name ? { name: assertName(dto.name, "Item") } : {}),
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId ?? null } : {}),
        ...(dto.specimenId !== undefined ? { specimenId: dto.specimenId ?? null } : {}),
        ...(dto.tatMinutes !== undefined ? { tatMinutes: dto.tatMinutes } : {}),
        ...(dto.statTatMinutes !== undefined ? { statTatMinutes: dto.statTatMinutes } : {}),
        ...(dto.preparationText !== undefined ? { preparationText: dto.preparationText?.trim() || null } : {}),
        ...(dto.consentRequired !== undefined ? { consentRequired: dto.consentRequired } : {}),
        ...(dto.appointmentRequired !== undefined ? { appointmentRequired: dto.appointmentRequired } : {}),
        ...(dto.isPanel !== undefined ? { isPanel: dto.isPanel } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { section: true, category: true, specimen: true },
    });
  }

  async deleteItem(principal: Principal, id: string) {
    const existing = await this.prisma.diagnosticItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Item not found");
    this.resolveBranchId(principal, existing.branchId);

    const panelParents = await this.prisma.diagnosticPanelItem.count({
      where: { itemId: id, isActive: true },
    });
    if (panelParents > 0) {
      throw new BadRequestException("Cannot delete item because it is part of an active panel. Remove from panel first.");
    }

    return this.prisma.diagnosticItem.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---------------------- Panels ----------------------
  async getPanelItems(principal: Principal, panelId: string) {
    const panel = await this.prisma.diagnosticItem.findUnique({ where: { id: panelId } });
    if (!panel) throw new NotFoundException("Panel not found");
    this.resolveBranchId(principal, panel.branchId);
    if (!panel.isPanel) throw new BadRequestException("This item is not a panel");

    return this.prisma.diagnosticPanelItem.findMany({
      where: { panelId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { item: true },
    });
  }

  async replacePanelItems(
    principal: Principal,
    panelId: string,
    dto: { items: { itemId: string; sortOrder?: number }[] }
  ) {
    const panel = await this.prisma.diagnosticItem.findUnique({ where: { id: panelId } });
    if (!panel) throw new NotFoundException("Panel not found");
    this.resolveBranchId(principal, panel.branchId);
    if (!panel.isPanel) throw new BadRequestException("This item is not a panel");

    const uniqueItemIds = Array.from(new Set((dto.items || []).map((x) => x.itemId)));
    if (uniqueItemIds.includes(panelId)) throw new BadRequestException("Panel cannot include itself");

    // FIX: explicit typing so TS doesn't infer `any` for i
    const items = (await this.prisma.diagnosticItem.findMany({
      where: { id: { in: uniqueItemIds }, branchId: panel.branchId, isActive: true },
      select: { id: true, kind: true, isPanel: true },
    })) as Array<{ id: string; kind: DiagnosticKind; isPanel: boolean }>;

    if (items.length !== uniqueItemIds.length) {
      throw new BadRequestException("One or more itemIds are invalid for this branch");
    }

    if (items.some((i) => i.isPanel)) {
      throw new BadRequestException("Panels cannot contain other panels (MVP rule)");
    }

    if (items.some((i) => i.kind !== panel.kind)) {
      throw new BadRequestException("Panel items must match the panel kind (LAB/IMAGING/PROCEDURE)");
    }

    // FIX: type tx explicitly
    await this.prisma.$transaction(async (tx: any) => {
      await tx.diagnosticPanelItem.updateMany({
        where: { panelId, isActive: true },
        data: { isActive: false },
      });

      for (const row of dto.items || []) {
        await tx.diagnosticPanelItem.upsert({
          where: { panelId_itemId: { panelId, itemId: row.itemId } },
          update: { isActive: true, sortOrder: row.sortOrder ?? 0 },
          create: { panelId, itemId: row.itemId, sortOrder: row.sortOrder ?? 0, isActive: true },
        });
      }
    });

    return this.getPanelItems(principal, panelId);
  }

  // ---------------------- Parameters (Lab) ----------------------
  async listParameters(principal: Principal, itemId: string) {
    const item = await this.prisma.diagnosticItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Diagnostic item not found");
    this.resolveBranchId(principal, item.branchId);

    return this.prisma.diagnosticParameter.findMany({
      where: { testId: itemId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { ranges: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }] } },
    });
  }

  async createParameter(
    principal: Principal,
    itemId: string,
    dto: {
      code: string;
      name: string;
      dataType: DiagnosticResultDataType;
      unit?: string;
      precision?: number;
      allowedText?: string;
      criticalLow?: number;
      criticalHigh?: number;
      sortOrder?: number;
    }
  ) {
    const item = await this.prisma.diagnosticItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Diagnostic item not found");
    this.resolveBranchId(principal, item.branchId);

    if (item.kind !== DiagnosticKind.LAB || item.isPanel) {
      throw new BadRequestException("Parameters can be defined only for non-panel LAB items");
    }

    const code = assertCode(dto.code, "Parameter");
    const name = assertName(dto.name, "Parameter");

    if (dto.dataType === DiagnosticResultDataType.CHOICE && !dto.allowedText?.trim()) {
      throw new BadRequestException("allowedText is required for CHOICE dataType");
    }

    return this.prisma.diagnosticParameter.create({
      data: {
        testId: itemId,
        code,
        name,
        dataType: dto.dataType,
        unit: dto.unit?.trim() || null,
        precision: dto.precision ?? null,
        allowedText: dto.allowedText?.trim() || null,
        criticalLow: dto.criticalLow ?? null,
        criticalHigh: dto.criticalHigh ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { ranges: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }] } },
    });
  }

  async updateParameter(
    principal: Principal,
    id: string,
    dto: {
      code?: string;
      name?: string;
      dataType?: DiagnosticResultDataType;
      unit?: string | null;
      precision?: number | null;
      allowedText?: string | null;
      criticalLow?: number | null;
      criticalHigh?: number | null;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await this.prisma.diagnosticParameter.findUnique({
      where: { id },
      include: { test: true },
    });
    if (!existing) throw new NotFoundException("Parameter not found");
    this.resolveBranchId(principal, existing.test.branchId);

    const nextDataType = dto.dataType ?? existing.dataType;
    const nextAllowed = dto.allowedText !== undefined ? dto.allowedText : existing.allowedText;

    if (nextDataType === DiagnosticResultDataType.CHOICE && !String(nextAllowed ?? "").trim()) {
      throw new BadRequestException("allowedText is required for CHOICE dataType");
    }

    return this.prisma.diagnosticParameter.update({
      where: { id },
      data: {
        ...(dto.code ? { code: assertCode(dto.code, "Parameter") } : {}),
        ...(dto.name ? { name: assertName(dto.name, "Parameter") } : {}),
        ...(dto.dataType !== undefined ? { dataType: dto.dataType } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit?.trim() || null } : {}),
        ...(dto.precision !== undefined ? { precision: dto.precision } : {}),
        ...(dto.allowedText !== undefined ? { allowedText: dto.allowedText?.trim() || null } : {}),
        ...(dto.criticalLow !== undefined ? { criticalLow: dto.criticalLow } : {}),
        ...(dto.criticalHigh !== undefined ? { criticalHigh: dto.criticalHigh } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { ranges: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }] } },
    });
  }

  async deleteParameter(principal: Principal, id: string) {
    const existing = await this.prisma.diagnosticParameter.findUnique({
      where: { id },
      include: { test: true },
    });
    if (!existing) throw new NotFoundException("Parameter not found");
    this.resolveBranchId(principal, existing.test.branchId);

    return this.prisma.diagnosticParameter.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---------------------- Reference Ranges ----------------------
  async listRanges(principal: Principal, parameterId: string) {
    const parameter = await this.prisma.diagnosticParameter.findUnique({
      where: { id: parameterId },
      include: { test: true },
    });
    if (!parameter) throw new NotFoundException("Parameter not found");
    this.resolveBranchId(principal, parameter.test.branchId);

    return this.prisma.diagnosticReferenceRange.findMany({
      where: { parameterId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async createRange(
    principal: Principal,
    parameterId: string,
    dto: {
      sex?: string | null;
      ageMinDays?: number | null;
      ageMaxDays?: number | null;
      low?: number | null;
      high?: number | null;
      textRange?: string | null;
      sortOrder?: number;
    }
  ) {
    const parameter = await this.prisma.diagnosticParameter.findUnique({
      where: { id: parameterId },
      include: { test: true },
    });
    if (!parameter) throw new NotFoundException("Parameter not found");
    this.resolveBranchId(principal, parameter.test.branchId);

    const ageMin = dto.ageMinDays ?? null;
    const ageMax = dto.ageMaxDays ?? null;
    if (ageMin !== null && ageMin !== undefined && ageMin < 0) throw new BadRequestException("ageMinDays must be >= 0");
    if (ageMax !== null && ageMax !== undefined && ageMax < 0) throw new BadRequestException("ageMaxDays must be >= 0");
    if (ageMin !== null && ageMin !== undefined && ageMax !== null && ageMax !== undefined && ageMin > ageMax) {
      throw new BadRequestException("ageMinDays cannot be greater than ageMaxDays");
    }

    return this.prisma.diagnosticReferenceRange.create({
      data: {
        parameterId,
        sex: dto.sex?.trim() || null,
        ageMinDays: dto.ageMinDays ?? null,
        ageMaxDays: dto.ageMaxDays ?? null,
        low: dto.low ?? null,
        high: dto.high ?? null,
        textRange: dto.textRange?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateRange(
    principal: Principal,
    id: string,
    dto: {
      sex?: string | null;
      ageMinDays?: number | null;
      ageMaxDays?: number | null;
      low?: number | null;
      high?: number | null;
      textRange?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await this.prisma.diagnosticReferenceRange.findUnique({
      where: { id },
      include: { parameter: { include: { test: true } } },
    });
    if (!existing) throw new NotFoundException("Range not found");
    this.resolveBranchId(principal, existing.parameter.test.branchId);

    const ageMin = dto.ageMinDays ?? null;
    const ageMax = dto.ageMaxDays ?? null;
    if (ageMin !== null && ageMin !== undefined && ageMin < 0) throw new BadRequestException("ageMinDays must be >= 0");
    if (ageMax !== null && ageMax !== undefined && ageMax < 0) throw new BadRequestException("ageMaxDays must be >= 0");
    if (ageMin !== null && ageMin !== undefined && ageMax !== null && ageMax !== undefined && ageMin > ageMax) {
      throw new BadRequestException("ageMinDays cannot be greater than ageMaxDays");
    }

    return this.prisma.diagnosticReferenceRange.update({
      where: { id },
      data: {
        ...(dto.sex !== undefined ? { sex: dto.sex?.trim() || null } : {}),
        ...(dto.ageMinDays !== undefined ? { ageMinDays: dto.ageMinDays } : {}),
        ...(dto.ageMaxDays !== undefined ? { ageMaxDays: dto.ageMaxDays } : {}),
        ...(dto.low !== undefined ? { low: dto.low } : {}),
        ...(dto.high !== undefined ? { high: dto.high } : {}),
        ...(dto.textRange !== undefined ? { textRange: dto.textRange?.trim() || null } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteRange(principal: Principal, id: string) {
    const existing = await this.prisma.diagnosticReferenceRange.findUnique({
      where: { id },
      include: { parameter: { include: { test: true } } },
    });
    if (!existing) throw new NotFoundException("Range not found");
    this.resolveBranchId(principal, existing.parameter.test.branchId);

    return this.prisma.diagnosticReferenceRange.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---------------------- Templates ----------------------
  async listTemplates(principal: Principal, itemId: string) {
    const item = await this.prisma.diagnosticItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Diagnostic item not found");
    this.resolveBranchId(principal, item.branchId);

    return this.prisma.diagnosticTemplate.findMany({
      where: { itemId, isActive: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
  }

  async createTemplate(
    principal: Principal,
    itemId: string,
    dto: { kind?: DiagnosticTemplateKind; name: string; body: string }
  ) {
    const item = await this.prisma.diagnosticItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException("Diagnostic item not found");
    this.resolveBranchId(principal, item.branchId);

    const name = assertName(dto.name, "Template");
    const body = String(dto.body ?? "").trim();
    if (!body) throw new BadRequestException("Template body is required");

    return this.prisma.diagnosticTemplate.create({
      data: {
        itemId,
        kind: dto.kind ?? DiagnosticTemplateKind.IMAGING_REPORT,
        name,
        body,
      },
    });
  }

  async updateTemplate(
    principal: Principal,
    id: string,
    dto: { kind?: DiagnosticTemplateKind; name?: string; body?: string; isActive?: boolean }
  ) {
    const existing = await this.prisma.diagnosticTemplate.findUnique({
      where: { id },
      include: { item: true },
    });
    if (!existing) throw new NotFoundException("Template not found");
    this.resolveBranchId(principal, existing.item.branchId);

    return this.prisma.diagnosticTemplate.update({
      where: { id },
      data: {
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.name ? { name: assertName(dto.name, "Template") } : {}),
        ...(dto.body !== undefined
  ? (() => {
      const body = String(dto.body ?? "").trim();
      if (!body) throw new BadRequestException("Template body cannot be empty");
      return { body };
    })()
  : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteTemplate(principal: Principal, id: string) {
    const existing = await this.prisma.diagnosticTemplate.findUnique({
      where: { id },
      include: { item: true },
    });
    if (!existing) throw new NotFoundException("Template not found");
    this.resolveBranchId(principal, existing.item.branchId);

    return this.prisma.diagnosticTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---------------------- Charge mapping ----------------------
  async listChargeMaps(
    principal: Principal,
    q: { branchId?: string; includeInactive?: boolean; diagnosticItemId?: string }
  ) {
    const branchId = this.resolveBranchId(principal, q.branchId);

    return this.prisma.diagnosticChargeMap.findMany({
      where: {
        branchId,
        ...(q.diagnosticItemId ? { diagnosticItemId: q.diagnosticItemId } : {}),
        ...(q.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        diagnosticItem: { include: { section: true, category: true } },
      },
    });
  }

  async createChargeMap(
    principal: Principal,
    dto: {
      branchId?: string;
      diagnosticItemId: string;
      chargeMasterId: string;
      price?: number;
      effectiveFrom?: string | Date;
      effectiveTo?: string | Date;
    }
  ) {
    const branchId = this.resolveBranchId(principal, dto.branchId);

    const item = await this.prisma.diagnosticItem.findFirst({
      where: { id: dto.diagnosticItemId, branchId, isActive: true },
    });
    if (!item) throw new BadRequestException("Invalid diagnosticItemId for this branch");

    const chargeMasterId = String(dto.chargeMasterId ?? "").trim();
    if (!chargeMasterId) throw new BadRequestException("chargeMasterId is required");

    return this.prisma.diagnosticChargeMap.create({
      data: {
        branchId,
        diagnosticItemId: dto.diagnosticItemId,
        chargeMasterId,
        price: dto.price ?? null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom as any) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo as any) : null,
      },
      include: { diagnosticItem: true },
    });
  }

  async updateChargeMap(
    principal: Principal,
    id: string,
    dto: { price?: number | null; effectiveFrom?: string | Date | null; effectiveTo?: string | Date | null; isActive?: boolean }
  ) {
    const existing = await this.prisma.diagnosticChargeMap.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Charge map not found");
    this.resolveBranchId(principal, existing.branchId);

    return this.prisma.diagnosticChargeMap.update({
      where: { id },
      data: {
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.effectiveFrom !== undefined
          ? { effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom as any) : null }
          : {}),
        ...(dto.effectiveTo !== undefined
          ? { effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo as any) : null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { diagnosticItem: true },
    });
  }

  async deleteChargeMap(principal: Principal, id: string) {
    const existing = await this.prisma.diagnosticChargeMap.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Charge map not found");
    this.resolveBranchId(principal, existing.branchId);

    return this.prisma.diagnosticChargeMap.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async listUnmapped(principal: Principal, q: { branchId?: string; kind?: DiagnosticKind }) {
    const branchId = this.resolveBranchId(principal, q.branchId);

    const items = await this.prisma.diagnosticItem.findMany({
      where: { branchId, isActive: true, ...(q.kind ? { kind: q.kind } : {}) },
      select: { id: true, code: true, name: true, kind: true, isPanel: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });

    const mapped = await this.prisma.diagnosticChargeMap.findMany({
      where: { branchId, isActive: true },
      select: { diagnosticItemId: true },
    });

    const mappedSet = new Set(mapped.map((m: any) => m.diagnosticItemId));
    return items.filter((i: any) => !mappedSet.has(i.id));
  }
}
