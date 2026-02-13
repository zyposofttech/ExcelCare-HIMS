import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRED", "SUSPENDED", "TERMINATED"] as const;
const PRICING_STRATEGIES = ["GLOBAL_DISCOUNT", "CATEGORY_WISE", "SERVICE_SPECIFIC"] as const;

export class CreatePayerContractDto {
  @IsString()
  payerId!: string;

  @IsString()
  @MaxLength(64)
  code!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(CONTRACT_STATUSES as any)
  status?: (typeof CONTRACT_STATUSES)[number];

  @IsOptional()
  @IsString()
  tariffPlanId?: string;

  @IsString()
  startDate!: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsIn(PRICING_STRATEGIES as any)
  pricingStrategy?: (typeof PRICING_STRATEGIES)[number];

  @IsOptional()
  @IsNumber()
  globalDiscountPercent?: number;

  @IsOptional()
  @IsNumber()
  emergencyLoadingPercent?: number;

  @IsOptional()
  @IsNumber()
  afterHoursLoadingPercent?: number;

  @IsOptional()
  @IsNumber()
  weekendLoadingPercent?: number;

  @IsOptional()
  @IsNumber()
  statLoadingPercent?: number;

  @IsOptional()
  copaymentRules?: any;

  @IsOptional()
  @IsArray()
  excludedServiceIds?: string[];

  @IsOptional()
  @IsArray()
  excludedCategories?: string[];

  @IsOptional()
  @IsNumber()
  gracePeriodDays?: number;

  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;
}
