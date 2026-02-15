import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { CreateDrugDto, UpdateDrugDto } from "./dto";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { Readable } from "stream";
import { INDIA_DRUG_DB_SAMPLE } from "./seed/india-drug-db.sample";

type ImportMode = "CREATE_ONLY" | "UPSERT";

type ImportOptions = {
  branchId?: string | null;
  dryRun?: boolean;
  mode?: ImportMode;
  source?: "FILE" | "JSON" | "SEED";
  fileName?: string | null;
  limit?: number | null;
};

type ImportRowResult = {
  row: number;
  drugCode: string;
  action: "created" | "updated" | "skipped" | "error";
  message?: string;
  warnings?: string[];
};

const DRUG_CATEGORIES = new Set([
  "TABLET", "CAPSULE", "INJECTION", "SYRUP", "OINTMENT", "DROPS",
  "INHALER", "SUPPOSITORY", "PATCH", "POWDER", "IV_FLUID", "OTHER",
]);

const DRUG_ROUTES = new Set([
  "ORAL", "IV", "IM", "SC", "TOPICAL", "INHALATION", "RECTAL",
  "OPHTHALMIC", "NASAL", "SUBLINGUAL", "TRANSDERMAL",
]);

const SCHEDULE_CLASSES = new Set(["GENERAL", "H", "H1", "X", "G"]);
const FORMULARY_STATUSES = new Set(["APPROVED", "RESTRICTED", "NON_FORMULARY"]);

function normalizeKey(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_-]+/g, "");
}

function toStr(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  // exceljs types: { text }, { richText }, { result }, Date, etc.
  if (v?.text) return String(v.text);
  if (v?.richText && Array.isArray(v.richText)) return v.richText.map((x: any) => x?.text ?? "").join("");
  if (v?.result !== undefined) return String(v.result);
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function parseBool(v: any): boolean | undefined {
  const s = normalizeKey(toStr(v));
  if (!s) return undefined;
  if (["true", "yes", "y", "1"].includes(s)) return true;
  if (["false", "no", "n", "0"].includes(s)) return false;
  return undefined;
}

function parseNum(v: any): number | null {
  const s = toStr(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cleanNullableString(v: any): string | null {
  const s = toStr(v).trim();
  return s ? s : null;
}

function signatureOf(d: {
  genericName: string;
  strength?: string | null;
  dosageForm?: string | null;
  route?: string | null;
}) {
  const g = normalizeKey(d.genericName);
  const st = normalizeKey(d.strength ?? "");
  const df = normalizeKey(d.dosageForm ?? "");
  const rt = normalizeKey(d.route ?? "");
  return `${g}|${st}|${df}|${rt}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

@Injectable()
export class DrugMasterService {
  constructor(private readonly ctx: InfraContextService) {}

  async listDrugs(
    principal: Principal,
    query: {
      branchId?: string | null;
      q?: string | null;
      category?: string | null;
      route?: string | null;
      scheduleClass?: string | null;
      formularyStatus?: string | null;
      status?: string | null;
      isNarcotic?: boolean;
      isHighAlert?: boolean;
      isLasa?: boolean;
      isAntibiotic?: boolean;
      page?: string | number | null;
      pageSize?: string | number | null;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, query.branchId ?? null);
    const where: any = { branchId };

    if (query.q) {
      const q = String(query.q).trim();
      where.OR = [
        { genericName: { contains: q, mode: "insensitive" } },
        { brandName: { contains: q, mode: "insensitive" } },
        { drugCode: { contains: q, mode: "insensitive" } },
        { manufacturer: { contains: q, mode: "insensitive" } },
        { therapeuticClass: { contains: q, mode: "insensitive" } },
      ];
    }

    if (query.category) where.category = query.category;
    if (query.route) where.route = query.route;
    if (query.scheduleClass) where.scheduleClass = query.scheduleClass;
    if (query.formularyStatus) where.formularyStatus = query.formularyStatus;
    if (query.status) where.status = query.status;
    if (query.isNarcotic !== undefined) where.isNarcotic = query.isNarcotic;
    if (query.isHighAlert !== undefined) where.isHighAlert = query.isHighAlert;
    if (query.isLasa !== undefined) where.isLasa = query.isLasa;
    if (query.isAntibiotic !== undefined) where.isAntibiotic = query.isAntibiotic;

    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 50)));
    const skip = (page - 1) * pageSize;

    const [rows, total] = await this.ctx.prisma.$transaction([
      this.ctx.prisma.drugMaster.findMany({
        where,
        orderBy: [{ drugCode: "asc" }],
        skip,
        take: pageSize,
      }),
      this.ctx.prisma.drugMaster.count({ where }),
    ]);

    return { page, pageSize, total, rows };
  }

  async getDrug(principal: Principal, id: string) {
    const drug = await this.ctx.prisma.drugMaster.findUnique({
      where: { id },
      include: {
        interactionsA: {
          include: { drugB: { select: { id: true, drugCode: true, genericName: true } } },
          take: 50,
        },
        interactionsB: {
          include: { drugA: { select: { id: true, drugCode: true, genericName: true } } },
          take: 50,
        },
      },
    });
    if (!drug) throw new NotFoundException("Drug not found");
    this.ctx.resolveBranchId(principal, drug.branchId);
    const { interactionsA, interactionsB, ...rest } = drug as any;
    return {
      ...rest,
      interactionsAsA: interactionsA ?? [],
      interactionsAsB: interactionsB ?? [],
    };
  }

  async createDrug(principal: Principal, dto: CreateDrugDto, branchId?: string | null) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    // Auto-generate drugCode if not provided
    let drugCode = dto.drugCode?.toUpperCase().trim();
    if (!drugCode) {
      drugCode = await this.generateDrugCode(bid);
    }

    // Duplicate by drugCode
    const existing = await this.ctx.prisma.drugMaster.findFirst({
      where: { branchId: bid, drugCode },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(`Drug code '${drugCode}' already exists in this branch`);
    }

    // Optional: real-time duplicate detection by signature
    const sig = signatureOf({
      genericName: dto.genericName,
      strength: dto.strength ?? null,
      dosageForm: dto.dosageForm ?? null,
      route: dto.route ?? null,
    });
    const dupe = await this.findDuplicateBySignature(bid, sig, dto.genericName, dto.strength ?? null, dto.dosageForm ?? null, dto.route ?? null);
    if (dupe) {
      throw new BadRequestException(
        `Possible duplicate drug detected (same Generic/Strength/Form/Route). Existing: ${dupe.drugCode} - ${dupe.genericName}`,
      );
    }

    // Auto-set narcotic flags based on schedule class
    const scheduleClass = dto.scheduleClass ?? "GENERAL";
    const isNarcotic = dto.isNarcotic ?? (scheduleClass === "X");
    const isControlled = dto.isControlled ?? (scheduleClass === "X" || scheduleClass === "H1");

    const drug = await this.ctx.prisma.drugMaster.create({
      data: {
        branchId: bid,
        drugCode,
        genericName: dto.genericName.trim(),
        brandName: dto.brandName?.trim() ?? null,
        manufacturer: dto.manufacturer?.trim() ?? null,
        category: dto.category as any,
        dosageForm: dto.dosageForm?.trim() ?? null,
        strength: dto.strength?.trim() ?? null,
        route: dto.route ? (dto.route as any) : null,
        therapeuticClass: dto.therapeuticClass?.trim() ?? null,
        pharmacologicalClass: dto.pharmacologicalClass?.trim() ?? null,
        scheduleClass: scheduleClass as any,
        isNarcotic,
        isPsychotropic: dto.isPsychotropic ?? false,
        isControlled,
        isAntibiotic: dto.isAntibiotic ?? false,
        isHighAlert: dto.isHighAlert ?? false,
        isLasa: dto.isLasa ?? false,
        mrp: dto.mrp ?? null,
        purchasePrice: dto.purchasePrice ?? null,
        hsnCode: dto.hsnCode?.trim() ?? null,
        gstRate: dto.gstRate ?? null,
        packSize: dto.packSize ?? null,
        defaultDosage: dto.defaultDosage?.trim() ?? null,
        maxDailyDose: dto.maxDailyDose?.trim() ?? null,
        contraindications: dto.contraindications ?? undefined,
        formularyStatus: (dto.formularyStatus ?? "NON_FORMULARY") as any,
        status: "ACTIVE" as any,
      },
    });

    await this.ctx.audit.log({
      branchId: bid,
      actorUserId: principal.userId,
      action: "PHARMACY_DRUG_CREATE",
      entity: "DrugMaster",
      entityId: drug.id,
      meta: { drugCode, genericName: dto.genericName },
    });

    return drug;
  }

  async updateDrug(principal: Principal, id: string, dto: UpdateDrugDto) {
    const current = await this.ctx.prisma.drugMaster.findUnique({
      where: { id },
      select: { id: true, branchId: true, drugCode: true },
    });
    if (!current) throw new NotFoundException("Drug not found");
    this.ctx.resolveBranchId(principal, current.branchId);

    const data: any = {};
    if (dto.genericName !== undefined) data.genericName = dto.genericName.trim();
    if (dto.brandName !== undefined) data.brandName = dto.brandName?.trim() ?? null;
    if (dto.manufacturer !== undefined) data.manufacturer = dto.manufacturer?.trim() ?? null;
    if (dto.category !== undefined) data.category = dto.category as any;
    if (dto.dosageForm !== undefined) data.dosageForm = dto.dosageForm?.trim() ?? null;
    if (dto.strength !== undefined) data.strength = dto.strength?.trim() ?? null;
    if (dto.route !== undefined) data.route = dto.route ? (dto.route as any) : null;
    if (dto.therapeuticClass !== undefined) data.therapeuticClass = dto.therapeuticClass?.trim() ?? null;
    if (dto.pharmacologicalClass !== undefined) data.pharmacologicalClass = dto.pharmacologicalClass?.trim() ?? null;
    if (dto.scheduleClass !== undefined) data.scheduleClass = dto.scheduleClass as any;
    if (dto.isNarcotic !== undefined) data.isNarcotic = dto.isNarcotic;
    if (dto.isPsychotropic !== undefined) data.isPsychotropic = dto.isPsychotropic;
    if (dto.isControlled !== undefined) data.isControlled = dto.isControlled;
    if (dto.isAntibiotic !== undefined) data.isAntibiotic = dto.isAntibiotic;
    if (dto.isHighAlert !== undefined) data.isHighAlert = dto.isHighAlert;
    if (dto.isLasa !== undefined) data.isLasa = dto.isLasa;
    if (dto.mrp !== undefined) data.mrp = dto.mrp;
    if (dto.purchasePrice !== undefined) data.purchasePrice = dto.purchasePrice;
    if (dto.hsnCode !== undefined) data.hsnCode = dto.hsnCode?.trim() ?? null;
    if (dto.gstRate !== undefined) data.gstRate = dto.gstRate;
    if (dto.packSize !== undefined) data.packSize = dto.packSize;
    if (dto.defaultDosage !== undefined) data.defaultDosage = dto.defaultDosage?.trim() ?? null;
    if (dto.maxDailyDose !== undefined) data.maxDailyDose = dto.maxDailyDose?.trim() ?? null;
    if (dto.contraindications !== undefined) data.contraindications = dto.contraindications;
    if (dto.formularyStatus !== undefined) data.formularyStatus = dto.formularyStatus as any;
    if (dto.status !== undefined) data.status = dto.status as any;

    const updated = await this.ctx.prisma.drugMaster.update({ where: { id }, data });

    await this.ctx.audit.log({
      branchId: current.branchId,
      actorUserId: principal.userId,
      action: "PHARMACY_DRUG_UPDATE",
      entity: "DrugMaster",
      entityId: id,
      meta: { drugCode: current.drugCode, changes: dto },
    });

    return updated;
  }

  /**
   * Legacy JSON bulk import endpoint support (kept for compatibility).
   * Now routed through the same validator/import pipeline as file import.
   */
  async bulkImportDrugs(principal: Principal, rows: any[], branchId?: string | null) {
    return this.importDrugsFromRows(principal, rows ?? [], {
      branchId: branchId ?? null,
      source: "JSON",
      mode: "CREATE_ONLY",
      dryRun: false,
    });
  }

  async seedStandardDrugDb(principal: Principal, opts: { branchId?: string | null; dryRun?: boolean; mode?: ImportMode; limit?: number }) {
    const rows = (opts.limit ? INDIA_DRUG_DB_SAMPLE.slice(0, opts.limit) : INDIA_DRUG_DB_SAMPLE) as any[];
    return this.importDrugsFromRows(principal, rows, {
      branchId: opts.branchId ?? null,
      source: "SEED",
      mode: opts.mode ?? "UPSERT",
      dryRun: opts.dryRun ?? false,
    });
  }

  async importDrugsFromFile(
    principal: Principal,
    file: Express.Multer.File,
    opts: { branchId?: string | null; dryRun?: boolean; mode?: ImportMode },
  ) {
    if (!file) throw new BadRequestException("File is required");
    const rows = await this.parseFileToRows(file);
    return this.importDrugsFromRows(principal, rows, {
      branchId: opts.branchId ?? null,
      source: "FILE",
      fileName: file.originalname ?? null,
      mode: opts.mode ?? "CREATE_ONLY",
      dryRun: opts.dryRun ?? false,
    });
  }

  async suggestGenericNames(principal: Principal, term: string, branchId?: string | null) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);
    const q = String(term ?? "").trim();
    if (!q) return { suggestions: [] as string[] };

    const rows = await this.ctx.prisma.drugMaster.findMany({
      where: { branchId: bid, genericName: { contains: q, mode: "insensitive" } },
      distinct: ["genericName"],
      orderBy: [{ genericName: "asc" }],
      take: 20,
      select: { genericName: true },
    });

    return { suggestions: rows.map((r) => r.genericName) };
  }

  async duplicateCheck(
    principal: Principal,
    input: { drugCode?: string; genericName?: string; strength?: string | null; dosageForm?: string | null; route?: string | null },
    branchId?: string | null,
  ) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    const drugCode = input.drugCode ? input.drugCode.toUpperCase().trim() : null;
    const genericName = input.genericName ? input.genericName.trim() : null;

    const byCode = drugCode
      ? await this.ctx.prisma.drugMaster.findFirst({
          where: { branchId: bid, drugCode },
          select: { id: true, drugCode: true, genericName: true },
        })
      : null;

    if (!genericName) {
      return { byCode, bySignature: [] as any[] };
    }

    const sig = signatureOf({
      genericName,
      strength: input.strength ?? null,
      dosageForm: input.dosageForm ?? null,
      route: input.route ?? null,
    });

    const dupe = await this.findDuplicateBySignature(bid, sig, genericName, input.strength ?? null, input.dosageForm ?? null, input.route ?? null);

    return { byCode, bySignature: dupe ? [dupe] : [] };
  }

  async getDrugTemplate(format?: string) {
    const fmt = (format ?? "xlsx").toLowerCase() === "csv" ? "csv" : "xlsx";

    const headers = [
      "drugCode",
      "genericName*",
      "brandName",
      "manufacturer",
      "category*",
      "dosageForm",
      "strength",
      "route",
      "therapeuticClass",
      "pharmacologicalClass",
      "scheduleClass",
      "isNarcotic",
      "isPsychotropic",
      "isControlled",
      "isAntibiotic",
      "isHighAlert",
      "isLasa",
      "mrp",
      "purchasePrice",
      "hsnCode",
      "gstRate",
      "packSize",
      "defaultDosage",
      "maxDailyDose",
      "formularyStatus",
    ];

    const sample = [
      "",
      "Paracetamol",
      "Dolo 650",
      "Micro Labs",
      "TABLET",
      "Tablet",
      "650 mg",
      "ORAL",
      "Analgesic/Antipyretic",
      "",
      "GENERAL",
      "false",
      "false",
      "false",
      "false",
      "false",
      "false",
      "35",
      "20",
      "3004",
      "12",
      "10",
      "650mg PO q6h PRN",
      "4g/day",
      "APPROVED",
    ];

    if (fmt === "csv") {
      const escape = (s: any) => {
        const v = String(s ?? "");
        if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
        return v;
      };
      const csv = [headers, sample].map((row) => row.map(escape).join(",")).join("\n") + "\n";
      return {
        filename: "drug-master-template.csv",
        contentType: "text/csv",
        buffer: Buffer.from(csv, "utf8"),
      };
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("DrugMaster");
    ws.addRow(headers);
    ws.addRow(sample);

    ws.getRow(1).font = { bold: true };
    ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(14, h.length + 2) }));

    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    return {
      filename: "drug-master-template.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(buf),
    };
  }

  async drugSummary(principal: Principal, branchId?: string) {
    const bid = this.ctx.resolveBranchId(principal, branchId ?? null);

    const [byCategory, bySchedule, byStatus, total, narcoticsCount, highAlertCount] =
      await this.ctx.prisma.$transaction([
        this.ctx.prisma.drugMaster.groupBy({
          by: ["category"],
          where: { branchId: bid },
          orderBy: { category: "asc" },
          _count: { _all: true },
        }),
        this.ctx.prisma.drugMaster.groupBy({
          by: ["scheduleClass"],
          where: { branchId: bid },
          orderBy: { scheduleClass: "asc" },
          _count: { _all: true },
        }),
        this.ctx.prisma.drugMaster.groupBy({
          by: ["status"],
          where: { branchId: bid },
          orderBy: { status: "asc" },
          _count: { _all: true },
        }),
        this.ctx.prisma.drugMaster.count({ where: { branchId: bid } }),
        this.ctx.prisma.drugMaster.count({ where: { branchId: bid, isNarcotic: true } }),
        this.ctx.prisma.drugMaster.count({ where: { branchId: bid, isHighAlert: true } }),
      ]);

    return { branchId: bid, total, narcoticsCount, highAlertCount, byCategory, bySchedule, byStatus };
  }

  // -------------------------
  // Internal Import Pipeline
  // -------------------------

  private mapRow(raw: any) {
    // map using flexible headers
    const out: any = {};
    const entries = Object.entries(raw ?? {});
    for (const [k, v] of entries) {
      const nk = normalizeKey(k);
      const val = v;

      const set = (field: string) => {
        // preserve first non-empty
        if (out[field] === undefined || out[field] === null || String(out[field]).trim() === "") out[field] = val;
      };

      if (["drugcode", "code"].includes(nk)) set("drugCode");
      else if (["genericname", "generic", "inn", "drugname"].includes(nk)) set("genericName");
      else if (["brandname", "brand"].includes(nk)) set("brandName");
      else if (["manufacturer", "mfg", "company"].includes(nk)) set("manufacturer");
      else if (["category", "drugcategory"].includes(nk)) set("category");
      else if (["dosageform", "form"].includes(nk)) set("dosageForm");
      else if (["strength", "dose", "dosage"].includes(nk)) set("strength");
      else if (["route", "administrationroute"].includes(nk)) set("route");
      else if (["therapeuticclass", "therclass"].includes(nk)) set("therapeuticClass");
      else if (["pharmacologicalclass", "pharmclass"].includes(nk)) set("pharmacologicalClass");
      else if (["scheduleclass", "schedule"].includes(nk)) set("scheduleClass");
      else if (["isnarcotic", "narcotic"].includes(nk)) set("isNarcotic");
      else if (["ispsychotropic", "psychotropic"].includes(nk)) set("isPsychotropic");
      else if (["iscontrolled", "controlled"].includes(nk)) set("isControlled");
      else if (["isantibiotic", "antibiotic"].includes(nk)) set("isAntibiotic");
      else if (["ishighalert", "highalert"].includes(nk)) set("isHighAlert");
      else if (["islasa", "lasa"].includes(nk)) set("isLasa");
      else if (["mrp"].includes(nk)) set("mrp");
      else if (["purchaseprice", "costprice"].includes(nk)) set("purchasePrice");
      else if (["hsncode", "hsn"].includes(nk)) set("hsnCode");
      else if (["gstrate", "gst"].includes(nk)) set("gstRate");
      else if (["packsize", "packsz"].includes(nk)) set("packSize");
      else if (["defaultdosage", "defaultdose"].includes(nk)) set("defaultDosage");
      else if (["maxdailydose", "maxdose"].includes(nk)) set("maxDailyDose");
      else if (["formularitystatus", "formularystatus"].includes(nk)) set("formularyStatus");
    }

    // normalize fields
    const drugCode = cleanNullableString(out.drugCode);
    const genericName = cleanNullableString(out.genericName);
    const brandName = cleanNullableString(out.brandName);
    const manufacturer = cleanNullableString(out.manufacturer);
    const categoryRaw = cleanNullableString(out.category);
    const category = categoryRaw ? categoryRaw.toUpperCase().trim() : null;

    const dosageForm = cleanNullableString(out.dosageForm);
    const strength = cleanNullableString(out.strength);
    const routeRaw = cleanNullableString(out.route);
    const route = routeRaw ? routeRaw.toUpperCase().trim() : null;

    const therapeuticClass = cleanNullableString(out.therapeuticClass);
    const pharmacologicalClass = cleanNullableString(out.pharmacologicalClass);

    const scheduleRaw = cleanNullableString(out.scheduleClass);
    const scheduleClass = scheduleRaw ? scheduleRaw.toUpperCase().trim() : "GENERAL";

    const isNarcotic = parseBool(out.isNarcotic);
    const isPsychotropic = parseBool(out.isPsychotropic);
    const isControlled = parseBool(out.isControlled);
    const isAntibiotic = parseBool(out.isAntibiotic);
    const isHighAlert = parseBool(out.isHighAlert);
    const isLasa = parseBool(out.isLasa);

    const mrp = parseNum(out.mrp);
    const purchasePrice = parseNum(out.purchasePrice);
    const hsnCode = cleanNullableString(out.hsnCode);
    const gstRate = parseNum(out.gstRate);
    const packSizeNum = parseNum(out.packSize);
    const packSize = packSizeNum === null ? null : Math.trunc(packSizeNum);

    const defaultDosage = cleanNullableString(out.defaultDosage);
    const maxDailyDose = cleanNullableString(out.maxDailyDose);

    const formularyRaw = cleanNullableString(out.formularyStatus);
    const formularyStatus = formularyRaw ? formularyRaw.toUpperCase().trim() : "NON_FORMULARY";

    return {
      drugCode,
      genericName,
      brandName,
      manufacturer,
      category,
      dosageForm,
      strength,
      route,
      therapeuticClass,
      pharmacologicalClass,
      scheduleClass,
      isNarcotic,
      isPsychotropic,
      isControlled,
      isAntibiotic,
      isHighAlert,
      isLasa,
      mrp,
      purchasePrice,
      hsnCode,
      gstRate,
      packSize,
      defaultDosage,
      maxDailyDose,
      formularyStatus,
    };
  }

  private validateMappedRow(mapped: any) {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!mapped.genericName) errors.push("genericName is required");
    if (!mapped.category) {
      // allow defaulting but warn
      mapped.category = "OTHER";
      warnings.push("category missing → defaulted to OTHER");
    } else if (!DRUG_CATEGORIES.has(mapped.category)) {
      errors.push(`invalid category '${mapped.category}'`);
    }

    if (mapped.route && !DRUG_ROUTES.has(mapped.route)) errors.push(`invalid route '${mapped.route}'`);
    if (mapped.scheduleClass && !SCHEDULE_CLASSES.has(mapped.scheduleClass)) errors.push(`invalid scheduleClass '${mapped.scheduleClass}'`);
    if (mapped.formularyStatus && !FORMULARY_STATUSES.has(mapped.formularyStatus)) {
      warnings.push(`invalid formularyStatus '${mapped.formularyStatus}' → defaulted to NON_FORMULARY`);
      mapped.formularyStatus = "NON_FORMULARY";
    }

    // auto flags based on schedule
    if (mapped.scheduleClass === "X") {
      if (mapped.isNarcotic === undefined) mapped.isNarcotic = true;
      if (mapped.isControlled === undefined) mapped.isControlled = true;
    }
    if (mapped.scheduleClass === "H1") {
      if (mapped.isControlled === undefined) mapped.isControlled = true;
    }

    return { errors, warnings, mapped };
  }

  private async importDrugsFromRows(principal: Principal, rows: any[], opts: ImportOptions) {
    const bid = this.ctx.resolveBranchId(principal, opts.branchId ?? null);
    const mode: ImportMode = opts.mode ?? "CREATE_ONLY";
    const dryRun = !!opts.dryRun;

    if (!rows?.length) throw new BadRequestException("No rows provided for import");
    if (rows.length > 5000) throw new BadRequestException("Maximum 5000 rows per import");

    const prepared: { rowIndex: number; raw: any; mapped: any; warnings: string[] }[] = [];
    const results: ImportRowResult[] = [];

    // 1) map + validate
    for (let i = 0; i < rows.length; i++) {
      const mapped = this.mapRow(rows[i]);
      const { errors, warnings, mapped: normalized } = this.validateMappedRow(mapped);

      const drugCode = normalized.drugCode ? normalized.drugCode.toUpperCase().trim() : "";
      if (errors.length) {
        results.push({ row: i + 1, drugCode, action: "error", message: errors.join("; "), warnings });
        continue;
      }

      prepared.push({ rowIndex: i + 1, raw: rows[i], mapped: normalized, warnings });
    }

    // 2) detect duplicates within file
    const seenCodes = new Set<string>();
    const seenSigs = new Set<string>();
    const usable: typeof prepared = [];
    for (const item of prepared) {
      const drugCode = item.mapped.drugCode ? item.mapped.drugCode.toUpperCase().trim() : null;
      const sig = signatureOf(item.mapped);

      if (drugCode) {
        if (seenCodes.has(drugCode)) {
          results.push({ row: item.rowIndex, drugCode, action: "skipped", message: "Duplicate drugCode in file", warnings: item.warnings });
          continue;
        }
        seenCodes.add(drugCode);
      }

      if (seenSigs.has(sig)) {
        results.push({ row: item.rowIndex, drugCode: drugCode ?? "", action: "skipped", message: "Possible duplicate (same Generic/Strength/Form/Route) in file", warnings: item.warnings });
        continue;
      }
      seenSigs.add(sig);

      usable.push(item);
    }

    // 3) prefetch existing by code
    const codes = usable.map((u) => u.mapped.drugCode?.toUpperCase().trim()).filter(Boolean) as string[];
    const existingByCode = new Map<string, { id: string; drugCode: string; genericName: string; strength: string | null; dosageForm: string | null; route: any }>();

    if (codes.length) {
      const existing = await this.ctx.prisma.drugMaster.findMany({
        where: { branchId: bid, drugCode: { in: codes } },
        select: { id: true, drugCode: true, genericName: true, strength: true, dosageForm: true, route: true },
      });
      for (const e of existing) existingByCode.set(e.drugCode.toUpperCase(), e as any);
    }

    // 4) prefetch possible duplicates by signature (case-insensitive genericName)
    const gnUnique = Array.from(new Set(usable.map((u) => String(u.mapped.genericName).trim()).filter(Boolean)));
    const existingForSig: any[] = [];
    for (const batch of chunk(gnUnique, 150)) {
      const OR = batch.map((gn) => ({ genericName: { equals: gn, mode: "insensitive" as any } }));
      if (!OR.length) continue;
      const rows = await this.ctx.prisma.drugMaster.findMany({
        where: { branchId: bid, OR },
        select: { id: true, drugCode: true, genericName: true, strength: true, dosageForm: true, route: true },
      });
      existingForSig.push(...rows);
    }

    const existingSigMap = new Map<string, any>();
    for (const e of existingForSig) {
      const sig = signatureOf({
        genericName: e.genericName,
        strength: e.strength ?? null,
        dosageForm: e.dosageForm ?? null,
        route: e.route ?? null,
      });
      if (!existingSigMap.has(sig)) existingSigMap.set(sig, e);
    }

    // 5) allocate codes for rows missing drugCode
    const missingCodeCount = usable.filter((u) => !u.mapped.drugCode).length;
    const allocatedCodes = missingCodeCount ? await this.allocateDrugCodes(bid, missingCodeCount) : [];
    let allocIdx = 0;

    // 6) apply
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of usable) {
      const m = item.mapped;

      let drugCode = m.drugCode ? m.drugCode.toUpperCase().trim() : null;
      if (!drugCode) {
        drugCode = allocatedCodes[allocIdx++];
      }

      const sig = signatureOf({ ...m, drugCode });

      // code duplicate in DB
      const existing = existingByCode.get(drugCode);
      if (existing) {
        if (mode === "UPSERT") {
          if (!dryRun) {
            await this.ctx.prisma.drugMaster.update({
              where: { id: existing.id },
              data: {
                genericName: String(m.genericName).trim(),
                brandName: m.brandName ?? null,
                manufacturer: m.manufacturer ?? null,
                category: m.category as any,
                dosageForm: m.dosageForm ?? null,
                strength: m.strength ?? null,
                route: m.route ? (m.route as any) : null,
                therapeuticClass: m.therapeuticClass ?? null,
                pharmacologicalClass: m.pharmacologicalClass ?? null,
                scheduleClass: (m.scheduleClass ?? "GENERAL") as any,
                isNarcotic: m.isNarcotic ?? ((m.scheduleClass ?? "GENERAL") === "X"),
                isPsychotropic: m.isPsychotropic ?? false,
                isControlled: m.isControlled ?? ((m.scheduleClass ?? "GENERAL") === "X" || (m.scheduleClass ?? "GENERAL") === "H1"),
                isAntibiotic: m.isAntibiotic ?? false,
                isHighAlert: m.isHighAlert ?? false,
                isLasa: m.isLasa ?? false,
                mrp: m.mrp ?? null,
                purchasePrice: m.purchasePrice ?? null,
                hsnCode: m.hsnCode ?? null,
                gstRate: m.gstRate ?? null,
                packSize: m.packSize ?? null,
                defaultDosage: m.defaultDosage ?? null,
                maxDailyDose: m.maxDailyDose ?? null,
                formularyStatus: (m.formularyStatus ?? "NON_FORMULARY") as any,
              },
            });
          }
          results.push({ row: item.rowIndex, drugCode, action: "updated", warnings: item.warnings });
          updated++;
        } else {
          results.push({ row: item.rowIndex, drugCode, action: "skipped", message: "Duplicate drugCode (already exists)", warnings: item.warnings });
          skipped++;
        }
        continue;
      }

      // signature duplicate in DB
      const sigDupe = existingSigMap.get(sig);
      if (sigDupe) {
        results.push({
          row: item.rowIndex,
          drugCode,
          action: "skipped",
          message: `Possible duplicate (same Generic/Strength/Form/Route). Existing: ${sigDupe.drugCode} - ${sigDupe.genericName}`,
          warnings: item.warnings,
        });
        skipped++;
        continue;
      }

      if (!dryRun) {
        await this.ctx.prisma.drugMaster.create({
          data: {
            branchId: bid,
            drugCode,
            genericName: String(m.genericName).trim(),
            brandName: m.brandName ?? null,
            manufacturer: m.manufacturer ?? null,
            category: m.category as any,
            dosageForm: m.dosageForm ?? null,
            strength: m.strength ?? null,
            route: m.route ? (m.route as any) : null,
            therapeuticClass: m.therapeuticClass ?? null,
            pharmacologicalClass: m.pharmacologicalClass ?? null,
            scheduleClass: (m.scheduleClass ?? "GENERAL") as any,
            isNarcotic: m.isNarcotic ?? ((m.scheduleClass ?? "GENERAL") === "X"),
            isPsychotropic: m.isPsychotropic ?? false,
            isControlled: m.isControlled ?? ((m.scheduleClass ?? "GENERAL") === "X" || (m.scheduleClass ?? "GENERAL") === "H1"),
            isAntibiotic: m.isAntibiotic ?? false,
            isHighAlert: m.isHighAlert ?? false,
            isLasa: m.isLasa ?? false,
            mrp: m.mrp ?? null,
            purchasePrice: m.purchasePrice ?? null,
            hsnCode: m.hsnCode ?? null,
            gstRate: m.gstRate ?? null,
            packSize: m.packSize ?? null,
            defaultDosage: m.defaultDosage ?? null,
            maxDailyDose: m.maxDailyDose ?? null,
            formularyStatus: (m.formularyStatus ?? "NON_FORMULARY") as any,
            status: "ACTIVE" as any,
          },
        });
      }

      results.push({ row: item.rowIndex, drugCode, action: "created", warnings: item.warnings });
      created++;
    }

    await this.ctx.audit.log({
      branchId: bid,
      actorUserId: principal.userId,
      action: "PHARMACY_DRUG_IMPORT",
      entity: "DrugMaster",
      entityId: null,
      meta: {
        source: opts.source ?? "JSON",
        fileName: opts.fileName ?? null,
        mode,
        dryRun,
        totalRows: rows.length,
        usableRows: usable.length,
        created,
        updated,
        skipped,
        errors: results.filter((r) => r.action === "error").length,
      },
    });

    return {
      branchId: bid,
      source: opts.source ?? "JSON",
      fileName: opts.fileName ?? null,
      mode,
      dryRun,
      totalRows: rows.length,
      usableRows: usable.length,
      created,
      updated,
      skipped,
      results,
    };
  }

  private async parseFileToRows(file: Express.Multer.File): Promise<any[]> {
    const name = (file.originalname ?? "").toLowerCase();
    const isCsv = name.endsWith(".csv") || (file.mimetype ?? "").includes("csv");
    const isXlsx =
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      (file.mimetype ?? "").includes("spreadsheet") ||
      (file.mimetype ?? "").includes("excel");

    if (!isCsv && !isXlsx) {
      throw new BadRequestException("Unsupported file type. Please upload .xlsx or .csv");
    }

    if (isCsv) {
      const text = file.buffer.toString("utf8");
      const parsed = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: "greedy",
      });

      if (parsed.errors?.length) {
        const first = parsed.errors[0];
        throw new BadRequestException(`CSV parse error: ${first.message} at row ${first.row}`);
      }

      return (parsed.data ?? []).filter((r) => r && Object.keys(r).length);
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.read(Readable.from(file.buffer));

    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException("Excel file has no worksheets");

    const headerRow = ws.getRow(1);
    const headers = (headerRow.values as any[]).slice(1).map((v) => toStr(v).trim());

    if (!headers.length) throw new BadRequestException("Excel header row is empty");

    const out: any[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const obj: any = {};
      let hasAny = false;

      for (let c = 1; c <= headers.length; c++) {
        const h = headers[c - 1];
        const cell = row.getCell(c);
        const v = toStr((cell as any).value).trim();
        if (v !== "") hasAny = true;
        obj[h] = v;
      }

      if (hasAny) out.push(obj);
    }

    return out;
  }

  private async findDuplicateBySignature(
    branchId: string,
    _sig: string,
    genericName: string,
    strength: string | null,
    dosageForm: string | null,
    route: string | null,
  ) {
    const candidates = await this.ctx.prisma.drugMaster.findMany({
      where: {
        branchId,
        genericName: { equals: genericName.trim(), mode: "insensitive" as any },
      },
      select: { id: true, drugCode: true, genericName: true, strength: true, dosageForm: true, route: true },
      take: 50,
    });

    const wanted = signatureOf({ genericName, strength, dosageForm, route });
    const hit = candidates.find((c) => signatureOf({ genericName: c.genericName, strength: c.strength, dosageForm: c.dosageForm, route: c.route }) === wanted);
    return hit ?? null;
  }

  private async allocateDrugCodes(branchId: string, count: number): Promise<string[]> {
    const latest = await this.ctx.prisma.drugMaster.findFirst({
      where: { branchId, drugCode: { startsWith: "DRG-" } },
      orderBy: [{ drugCode: "desc" }],
      select: { drugCode: true },
    });

    let nextNum = 1;
    if (latest?.drugCode) {
      const match = latest.drugCode.match(/^DRG-(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(`DRG-${String(nextNum + i).padStart(5, "0")}`);
    }
    return codes;
  }

  private async generateDrugCode(branchId: string): Promise<string> {
    const latest = await this.ctx.prisma.drugMaster.findFirst({
      where: { branchId, drugCode: { startsWith: "DRG-" } },
      orderBy: [{ drugCode: "desc" }],
      select: { drugCode: true },
    });

    let nextNum = 1;
    if (latest?.drugCode) {
      const match = latest.drugCode.match(/^DRG-(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    return `DRG-${String(nextNum).padStart(5, "0")}`;
  }
}
