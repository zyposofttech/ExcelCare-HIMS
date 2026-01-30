import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const TAX_TYPES = ["GST", "TDS", "OTHER"] as const;

export class CreateTaxCodeDto {
  @IsString()
  @MaxLength(32)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsIn(TAX_TYPES as any)
  taxType?: (typeof TAX_TYPES)[number];

  /**
   * Stored as Decimal(7,4) in DB. Use percent (e.g. 18, 5, 0).
   */
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercent!: number;

  @IsOptional()
  components?: any;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  hsnSac?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
