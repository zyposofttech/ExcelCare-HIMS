import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpsertInfraTariffRateDto {
  @IsOptional()
  @IsString()
  tariffPlanId?: string;

  @IsString()
  chargeMasterItemId!: string;

  @IsOptional()
  @IsString()
  serviceCode?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rateAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number; // legacy alias

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  taxCodeId?: string | null;

  @IsOptional()
  @IsBoolean()
  isTaxInclusive?: boolean;

  @IsOptional()
  @IsString()
  effectiveFrom?: string; // ISO

  @IsOptional()
  @IsString()
  effectiveTo?: string | null; // ISO

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  rules?: any;

  @IsOptional()
  @IsString()
  notes?: string;
}
