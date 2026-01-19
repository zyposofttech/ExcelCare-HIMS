import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

/**
 * Canonical OT suite lifecycle statuses (DB/API values).
 * UI may send uppercase; we normalize to lowercase.
 */
export enum OtSuiteStatus {
  DRAFT = "draft",
  READY = "ready",
  ACTIVE = "active",
  BOOKED = "booked",
  IN_USE = "in_use",
  MAINTENANCE = "maintenance",
  ARCHIVED = "archived",
}

export enum OtSpaceType {
  THEATRE = "THEATRE",
  RECOVERY_BAY = "RECOVERY_BAY",
  PREOP_HOLDING = "PREOP_HOLDING",
  INDUCTION_ROOM = "INDUCTION_ROOM",
  SCRUB_ROOM = "SCRUB_ROOM",
  STERILE_STORE = "STERILE_STORE",
  ANESTHESIA_STORE = "ANESTHESIA_STORE",
  EQUIPMENT_STORE = "EQUIPMENT_STORE",
  STAFF_CHANGE = "STAFF_CHANGE",
  OTHER = "OTHER",
}

/**
 * Must match UI SelectItem values exactly.
 */
export enum OtEquipmentCategory {
  ANESTHESIA_MACHINE = "ANESTHESIA_MACHINE",
  AIRWAY_MANAGEMENT = "AIRWAY_MANAGEMENT",
  VENTILATION_RESPIRATORY = "VENTILATION_RESPIRATORY",

  PATIENT_MONITORING = "PATIENT_MONITORING",
  HEMODYNAMIC_MONITORING = "HEMODYNAMIC_MONITORING",

  SURGICAL_INSTRUMENTS = "SURGICAL_INSTRUMENTS",
  OR_FURNITURE = "OR_FURNITURE",
  OR_LIGHTING = "OR_LIGHTING",
  ELECTROSURGERY_ENERGY = "ELECTROSURGERY_ENERGY",
  ENDOSCOPY_LAPAROSCOPY = "ENDOSCOPY_LAPAROSCOPY",
  IMAGING_INTRAOP = "IMAGING_INTRAOP",

  STERILIZATION_CSSD = "STERILIZATION_CSSD",
  DISINFECTION_CLEANING = "DISINFECTION_CLEANING",
  STERILE_STORAGE_PACKAGING = "STERILE_STORAGE_PACKAGING",

  MEDICAL_GASES = "MEDICAL_GASES",
  SUCTION_SYSTEMS = "SUCTION_SYSTEMS",
  POWER_BACKUP = "POWER_BACKUP",

  PATIENT_WARMING = "PATIENT_WARMING",
  DVT_PROPHYLAXIS = "DVT_PROPHYLAXIS",
  SAFETY_EMERGENCY = "SAFETY_EMERGENCY",

  RECOVERY_PACU_EQUIPMENT = "RECOVERY_PACU_EQUIPMENT",
  IT_AV_EQUIPMENT = "IT_AV_EQUIPMENT",

  CONSUMABLES_DISPOSABLES = "CONSUMABLES_DISPOSABLES",
  OTHER = "OTHER",
}

export function normalizeSuiteStatus(value: unknown): unknown {
  if (value === undefined || value === null) return value;

  const lower = String(value).trim().toLowerCase();
  if (["in used", "inuse", "in_used", "in-use"].includes(lower)) return "in_use";
  return lower;
}

// -------------------- Suites --------------------

export class CreateOtSuiteDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  locationNodeId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class UpdateOtSuiteDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeSuiteStatus(value))
  @IsEnum(OtSuiteStatus)
  status?: OtSuiteStatus;

  @IsOptional()
  @IsString()
  locationNodeId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// -------------------- Spaces --------------------

export class CreateOtSpaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(OtSpaceType)
  type!: OtSpaceType;

  @IsOptional()
  @IsString()
  locationNodeId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  // Convenience: when creating a theatre, auto-create a default primary table.
  @IsOptional()
  @IsBoolean()
  createDefaultTable?: boolean;
}

export class UpdateOtSpaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  locationNodeId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// -------------------- Tables --------------------

export class CreateOtTableDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNo?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

export class UpdateOtTableDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNo?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// -------------------- Equipment --------------------

export class CreateOtEquipmentDto {
  @IsEnum(OtEquipmentCategory)
  category!: OtEquipmentCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNo?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

export class UpdateOtEquipmentDto {
  @IsOptional()
  @IsEnum(OtEquipmentCategory)
  category?: OtEquipmentCategory;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  qty?: number;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNo?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
