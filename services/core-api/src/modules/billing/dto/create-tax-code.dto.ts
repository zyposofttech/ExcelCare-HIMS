import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { TAX_TYPES, TaxType } from "./tax-type.dto";

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
