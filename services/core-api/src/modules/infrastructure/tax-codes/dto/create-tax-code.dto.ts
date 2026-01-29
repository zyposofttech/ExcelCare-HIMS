import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

const TAX_TYPES = ["GST", "TDS", "OTHER"] as const;
export type TaxType = (typeof TAX_TYPES)[number];

export class CreateTaxCodeDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  @MaxLength(32)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsIn(TAX_TYPES as any)
  taxType?: TaxType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
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
