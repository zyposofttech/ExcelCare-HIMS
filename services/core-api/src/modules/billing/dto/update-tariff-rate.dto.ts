import { IsBoolean, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateTariffRateDto {
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
  effectiveFrom?: string;

  @IsOptional()
  @IsString()
  effectiveTo?: string | null;

  @IsOptional()
  rules?: any;

  @IsOptional()
  @IsString()
  notes?: string;
}
