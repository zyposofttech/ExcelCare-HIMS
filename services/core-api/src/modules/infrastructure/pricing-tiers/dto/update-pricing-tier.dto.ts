import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const TIER_KINDS = [
  "GENERAL",
  "SENIOR_CITIZEN",
  "STAFF",
  "EMPLOYEE_FAMILY",
  "BPL",
  "MEDICAL_COUNCIL",
  "CUSTOM",
] as const;

export class UpdatePricingTierDto {
  @IsOptional()
  @IsIn(TIER_KINDS as any)
  kind?: (typeof TIER_KINDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  assignmentRules?: any;

  @IsOptional()
  @IsNumber()
  defaultDiscountPercent?: number | null;

  @IsOptional()
  @IsNumber()
  defaultMarkupPercent?: number | null;

  @IsOptional()
  @IsNumber()
  maxDiscountCap?: number | null;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
