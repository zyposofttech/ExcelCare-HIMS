import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

const CHARGE_UNITS = [
  "PER_UNIT",
  "PER_VISIT",
  "PER_TEST",
  "PER_HOUR",
  "PER_DAY",
  "PER_SIDE",
  "PER_LEVEL",
  "PER_SESSION",
  "PER_PROCEDURE",
  "PER_PACKAGE",
] as const;

export class UpdateChargeMasterItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string | null;

  // ✅ Option-B fields
  @IsOptional()
  @IsIn(CHARGE_UNITS as any)
  chargeUnit?: (typeof CHARGE_UNITS)[number];

  /**
   * To CLEAR tax code: send taxCodeId = "" (empty string) OR null
   */
  @IsOptional()
  @IsString()
  taxCodeId?: string | null;

  @IsOptional()
  @IsBoolean()
  isTaxInclusive?: boolean;

  /**
   * To CLEAR HSN/SAC: send hsnSac = "" OR null
   */
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
