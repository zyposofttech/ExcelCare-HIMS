import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

// ────────────────────────────── Templates ──────────────────────────────

export class CreateNabhTemplateDto {
  @IsString()
  orgId!: string;

  @IsString()
  @MaxLength(200)
  name!: string;
}

export class CreateNabhTemplateItemDto {
  @IsString()
  templateId!: string;

  @IsString()
  @MaxLength(100)
  chapter!: string;

  @IsString()
  @MaxLength(30)
  standardCode!: string;

  @IsString()
  @MaxLength(30)
  meCode!: string;

  @IsString()
  @MaxLength(500)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsBoolean()
  @IsOptional()
  evidenceRequired?: boolean;

  @IsIn(["CRITICAL", "MAJOR", "MINOR"])
  @IsOptional()
  riskLevel?: "CRITICAL" | "MAJOR" | "MINOR";
}

// ────────────────────────────── Workspace Items ──────────────────────────────

export class UpdateNabhItemDto {
  @IsIn(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED", "NON_COMPLIANT"])
  @IsOptional()
  status?: "NOT_STARTED" | "IN_PROGRESS" | "IMPLEMENTED" | "VERIFIED" | "NON_COMPLIANT";

  @IsString()
  @IsOptional()
  ownerStaffId?: string;

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  notes?: string;

  @IsIn(["CRITICAL", "MAJOR", "MINOR"])
  @IsOptional()
  riskLevel?: "CRITICAL" | "MAJOR" | "MINOR";
}

// ────────────────────────────── Audit Cycles ──────────────────────────────

export class CreateAuditCycleDto {
  /** Option A: UI sends branchId (UUID). Backend resolves workspaceId. */
  @IsString()
  @IsOptional()
  branchId?: string;

  /** Backward compatible: allow direct workspaceId too. */
  @IsString()
  @IsOptional()
  workspaceId?: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  /** UI field */
  @IsString()
  @IsOptional()
  plannedStartDate?: string;

  /** Backward compatible */
  @IsString()
  @IsOptional()
  startDate?: string;

  /** UI field */
  @IsString()
  @IsOptional()
  plannedEndDate?: string | null;

  /** Backward compatible */
  @IsString()
  @IsOptional()
  endDate?: string;

  /** UI field - stored in auditorStaffIds[0] */
  @IsString()
  @IsOptional()
  leadAuditorStaffId?: string | null;

  /** UI-only fields (ignored by DB, stored in logs) */
  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  scope?: string | null;

  @IsString()
  @IsOptional()
  notes?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  auditorStaffIds?: string[];
}

export class UpdateAuditCycleDto {
  /** UI supports COMPLETED and CLOSED. */
  @IsIn(["PLANNED", "IN_PROGRESS", "COMPLETED", "CLOSED"])
  @IsOptional()
  status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED";

  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}

// ────────────────────────────── Findings ──────────────────────────────

export class CreateFindingDto {
  @IsString()
  auditId!: string;

  /** UI uses nabhItemId; backend stores it in itemId */
  @IsString()
  @IsOptional()
  nabhItemId?: string | null;

  @IsString()
  @IsOptional()
  itemId?: string;

  /** UI also sends OBSERVATION (mapped to MINOR) */
  @IsIn(["CRITICAL", "MAJOR", "MINOR", "OBSERVATION"])
  severity!: "CRITICAL" | "MAJOR" | "MINOR" | "OBSERVATION";

  @IsString()
  @MaxLength(4000)
  description!: string;

  /** UI uses recommendation; backend stores in recommendedAction */
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  recommendation?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  recommendedAction?: string;

  @IsString()
  @IsOptional()
  dueDate?: string;
}

export class UpdateFindingDto {
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  recommendedAction?: string;

  @IsString()
  @IsOptional()
  dueDate?: string;
}

// ────────────────────────────── CAPA ──────────────────────────────

export class CreateCapaDto {
  @IsString()
  findingId!: string;

  /** UI v1 fields */
  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  responsibleStaffId?: string | null;

  @IsString()
  @IsOptional()
  targetDate?: string | null;

  /** Backward compatible */
  @IsString()
  @IsOptional()
  ownerStaffId?: string;

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  actionPlan?: string;
}

export class UpdateCapaDto {
  /** UI has more statuses; map them to OPEN/IN_PROGRESS/CLOSED */
  @IsIn(["OPEN", "IN_PROGRESS", "COMPLETED", "VERIFIED", "CLOSED"])
  @IsOptional()
  status?: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED" | "CLOSED";

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  closureNotes?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  actionPlan?: string;
}
