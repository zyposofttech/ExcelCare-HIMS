import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class UpsertTierRateDto {
  @IsOptional()
  @IsString()
  serviceItemId?: string;

  @IsOptional()
  @IsString()
  chargeMasterItemId?: string;

  @IsOptional()
  @IsNumber()
  rateAmount?: number;

  @IsOptional()
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
