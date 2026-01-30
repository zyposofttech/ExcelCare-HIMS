import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { TAX_TYPES, TaxType } from "./tax-type.dto";

export class UpdateTaxCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(TAX_TYPES as any)
  taxType?: TaxType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercent?: number;

  @IsOptional()
  components?: any;

  /**
   * To CLEAR: send "" or null
   */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  hsnSac?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
