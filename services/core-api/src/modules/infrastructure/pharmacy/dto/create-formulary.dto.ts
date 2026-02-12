import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class FormularyItemDto {
  @IsString()
  drugMasterId!: string;

  @IsIn(["APPROVED", "RESTRICTED", "NON_FORMULARY"])
  tier!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class CreateFormularyDto {
  @IsOptional()
  @IsDateString()
  effectiveDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormularyItemDto)
  items?: FormularyItemDto[];
}
