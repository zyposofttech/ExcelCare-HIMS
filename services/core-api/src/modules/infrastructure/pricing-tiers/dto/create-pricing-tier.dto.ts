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

export class CreatePricingTierDto {
  @IsIn(TIER_KINDS as any)
  kind!: (typeof TIER_KINDS)[number];

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(64)
  code!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  assignmentRules?: any;

  @IsOptional()
  @IsNumber()
  defaultDiscountPercent?: number;

  @IsOptional()
  @IsNumber()
  defaultMarkupPercent?: number;

  @IsOptional()
  @IsNumber()
  maxDiscountCap?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
