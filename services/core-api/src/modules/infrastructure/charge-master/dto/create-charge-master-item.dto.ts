import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

const CHARGE_UNITS = ["PER_UNIT", "PER_DAY", "PER_SESSION", "PER_PROCEDURE", "PER_PACKAGE"] as const;
export type ServiceChargeUnit = (typeof CHARGE_UNITS)[number];

export class CreateChargeMasterItemDto {
  @IsString()
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  unit?: string | null;

  // ✅ End-to-end enforcement
  @IsOptional()
  @IsIn(CHARGE_UNITS as any)
  chargeUnit?: ServiceChargeUnit;

  // ✅ Tax mapping
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
