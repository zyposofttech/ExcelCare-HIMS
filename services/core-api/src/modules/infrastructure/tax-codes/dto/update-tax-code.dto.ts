import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

const TAX_TYPES = ["GST", "TDS", "OTHER"] as const;
type TaxType = (typeof TAX_TYPES)[number];

export class UpdateTaxCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(TAX_TYPES as any)
  taxType?: TaxType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ratePercent?: number;

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
