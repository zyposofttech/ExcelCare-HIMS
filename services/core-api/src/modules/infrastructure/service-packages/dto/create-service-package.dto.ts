import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

const OVER_UTILIZATION = ["CHARGE_ADDITIONAL", "ABSORB"] as const;
const UNDER_UTILIZATION = ["NO_REFUND", "PARTIAL", "FULL"] as const;

export class CreateServicePackageDto {
  @IsString()
  @MaxLength(48)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string | null;

  @IsOptional()
  @IsString()
  payerGroup?: string | null;

  @IsOptional()
  @IsString()
  context?: string | null;

  // Package duration
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number | null;

  // Component flexibility rules
  @IsOptional()
  @IsBoolean()
  allowComponentAddition?: boolean;

  @IsOptional()
  @IsBoolean()
  allowComponentRemoval?: boolean;

  @IsOptional()
  @IsBoolean()
  allowQuantityChange?: boolean;

  // Utilization policies
  @IsOptional()
  @IsIn(OVER_UTILIZATION as any)
  overUtilizationPolicy?: (typeof OVER_UTILIZATION)[number];

  @IsOptional()
  @IsIn(UNDER_UTILIZATION as any)
  underUtilizationRefund?: (typeof UNDER_UTILIZATION)[number];

  // Eligibility
  @IsOptional()
  @IsInt()
  minAge?: number | null;

  @IsOptional()
  @IsInt()
  maxAge?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  genderRestriction?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicablePayerIds?: string[];

  @IsOptional()
  @IsBoolean()
  requiresPreauth?: boolean;
}
