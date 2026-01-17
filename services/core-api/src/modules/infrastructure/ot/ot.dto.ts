import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export enum OtSuiteStatus {
  DRAFT = "DRAFT",
  READY = "READY",
  ARCHIVED = "ARCHIVED",
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

export enum OtEquipmentCategory {
  ANESTHESIA = "ANESTHESIA",
  MONITORING = "MONITORING",
  SURGICAL_LIGHT = "SURGICAL_LIGHT",
  DIATHERMY = "DIATHERMY",
  SUCTION = "SUCTION",
  INFUSION = "INFUSION",
  INSTRUMENTS = "INSTRUMENTS",
  OT_TABLE = "OT_TABLE",
  CSSD = "CSSD",
  OTHER = "OTHER",
}

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
  @IsOptional() @IsString() @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(OtSuiteStatus)
  status?: OtSuiteStatus;

  @IsOptional() @IsString()
  locationNodeId?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

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
  @IsOptional() @IsString() @MaxLength(120)
  name?: string;

  @IsOptional() @IsString()
  locationNodeId?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateOtTableDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional() @IsBoolean()
  isPrimary?: boolean;

  @IsOptional() @IsString()
  manufacturer?: string;

  @IsOptional() @IsString()
  model?: string;

  @IsOptional() @IsString()
  serialNo?: string;

  @IsOptional() @IsObject()
  meta?: Record<string, any>;
}

export class UpdateOtTableDto {
  @IsOptional() @IsString() @MaxLength(120)
  name?: string;

  @IsOptional() @IsBoolean()
  isPrimary?: boolean;

  @IsOptional() @IsString()
  manufacturer?: string;

  @IsOptional() @IsString()
  model?: string;

  @IsOptional() @IsString()
  serialNo?: string;

  @IsOptional() @IsObject()
  meta?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

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

  @IsOptional() @IsString()
  spaceId?: string;

  @IsOptional() @IsString()
  manufacturer?: string;

  @IsOptional() @IsString()
  model?: string;

  @IsOptional() @IsString()
  serialNo?: string;

  @IsOptional() @IsObject()
  meta?: Record<string, any>;
}

export class UpdateOtEquipmentDto {
  @IsOptional()
  @IsEnum(OtEquipmentCategory)
  category?: OtEquipmentCategory;

  @IsOptional() @IsString() @MaxLength(180)
  name?: string;

  @IsOptional() @IsInt() @Min(1)
  qty?: number;

  @IsOptional() @IsString()
  spaceId?: string;

  @IsOptional() @IsString()
  manufacturer?: string;

  @IsOptional() @IsString()
  model?: string;

  @IsOptional() @IsString()
  serialNo?: string;

  @IsOptional() @IsObject()
  meta?: Record<string, any>;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
