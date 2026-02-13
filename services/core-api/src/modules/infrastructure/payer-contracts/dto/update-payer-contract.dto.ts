import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRED", "SUSPENDED", "TERMINATED"] as const;
const PRICING_STRATEGIES = ["GLOBAL_DISCOUNT", "CATEGORY_WISE", "SERVICE_SPECIFIC"] as const;

export class UpdatePayerContractDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(CONTRACT_STATUSES as any)
  status?: (typeof CONTRACT_STATUSES)[number];

  @IsOptional()
  @IsString()
  tariffPlanId?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string | null;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsIn(PRICING_STRATEGIES as any)
  pricingStrategy?: (typeof PRICING_STRATEGIES)[number] | null;

  @IsOptional()
  @IsNumber()
  globalDiscountPercent?: number | null;

  @IsOptional()
  @IsNumber()
  emergencyLoadingPercent?: number | null;

  @IsOptional()
  @IsNumber()
  afterHoursLoadingPercent?: number | null;

  @IsOptional()
  @IsNumber()
  weekendLoadingPercent?: number | null;

  @IsOptional()
  @IsNumber()
  statLoadingPercent?: number | null;

  @IsOptional()
  copaymentRules?: any;

  @IsOptional()
  @IsArray()
  excludedServiceIds?: string[];

  @IsOptional()
  @IsArray()
  excludedCategories?: string[];

  @IsOptional()
  @IsString()
  approvalStatus?: string | null;

  @IsOptional()
  @IsNumber()
  gracePeriodDays?: number | null;

  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;
}
