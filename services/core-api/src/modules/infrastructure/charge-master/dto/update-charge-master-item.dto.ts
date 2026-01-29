import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

const CHARGE_UNITS = ["PER_UNIT", "PER_DAY", "PER_SESSION", "PER_PROCEDURE", "PER_PACKAGE"] as const;
type ServiceChargeUnit = (typeof CHARGE_UNITS)[number];

export class UpdateChargeMasterItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @IsIn(CHARGE_UNITS as any)
  chargeUnit?: ServiceChargeUnit;

  @IsOptional()
  @IsString()
  taxCodeId?: string | null;

  @IsOptional()
  isTaxInclusive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  hsnSac?: string | null;

  @IsOptional()
  billingPolicy?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
