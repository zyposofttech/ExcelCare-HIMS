import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const RATE_TYPES = ["FIXED_PRICE", "PERCENTAGE_OF_BASE", "DISCOUNT"] as const;

export class UpsertContractRateDto {
  @IsOptional()
  @IsString()
  serviceItemId?: string;

  @IsOptional()
  @IsString()
  packageId?: string;

  @IsOptional()
  @IsString()
  chargeMasterItemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsIn(RATE_TYPES as any)
  rateType!: (typeof RATE_TYPES)[number];

  @IsOptional()
  @IsNumber()
  fixedPrice?: number;

  @IsOptional()
  @IsNumber()
  percentageOfBase?: number;

  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsString()
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
