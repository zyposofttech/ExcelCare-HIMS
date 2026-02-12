import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";

export class SetInventoryConfigDto {
  @IsString()
  pharmacyStoreId!: string;

  @IsString()
  drugMasterId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  minimumStock?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maximumStock?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reorderLevel?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reorderQuantity?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  safetyStock?: number | null;

  @IsOptional()
  @IsIn(["A", "B", "C"])
  abcClass?: string | null;

  @IsOptional()
  @IsIn(["V", "E", "D"])
  vedClass?: string | null;
}
