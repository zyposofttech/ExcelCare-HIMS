import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDecimal,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

const DRUG_CATEGORIES = [
  "TABLET", "CAPSULE", "INJECTION", "SYRUP", "OINTMENT", "DROPS",
  "INHALER", "SUPPOSITORY", "PATCH", "POWDER", "IV_FLUID", "OTHER",
] as const;

const DRUG_ROUTES = [
  "ORAL", "IV", "IM", "SC", "TOPICAL", "INHALATION", "RECTAL",
  "OPHTHALMIC", "NASAL", "SUBLINGUAL", "TRANSDERMAL",
] as const;

const SCHEDULE_CLASSES = ["GENERAL", "H", "H1", "X", "G"] as const;

export class CreateDrugDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  drugCode?: string;

  @IsString()
  @MaxLength(255)
  genericName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  brandName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  manufacturer?: string | null;

  @IsIn(DRUG_CATEGORIES)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dosageForm?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  strength?: string | null;

  @IsOptional()
  @IsIn(DRUG_ROUTES)
  route?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  therapeuticClass?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  pharmacologicalClass?: string | null;

  @IsOptional()
  @IsIn(SCHEDULE_CLASSES)
  scheduleClass?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isNarcotic?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPsychotropic?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isControlled?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isAntibiotic?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isHighAlert?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isLasa?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mrp?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  purchasePrice?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  hsnCode?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gstRate?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  packSize?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  defaultDosage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  maxDailyDose?: string | null;

  @IsOptional()
  contraindications?: any;

  @IsOptional()
  @IsIn(["APPROVED", "RESTRICTED", "NON_FORMULARY"])
  formularyStatus?: string;
}
