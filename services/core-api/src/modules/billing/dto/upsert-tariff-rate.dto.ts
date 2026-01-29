import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpsertTariffRateDto {
  @IsOptional()
  @IsString()
  tariffPlanId?: string; // optional if provided via URL

  @IsString()
  chargeMasterItemId!: string;

  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  /**
   * Optional override. If absent, billing uses ChargeMasterItem.taxCodeId.
   * Enforced: if provided, must be ACTIVE.
   */
  @IsOptional()
  @IsString()
  taxCodeId?: string | null;

  @IsOptional()
  rules?: any;
}
