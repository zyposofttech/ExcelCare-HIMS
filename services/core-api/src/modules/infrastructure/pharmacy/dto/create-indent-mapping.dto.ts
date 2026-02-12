import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateIndentMappingDto {
  @IsString()
  requestingStoreId!: string;

  @IsString()
  supplyingStoreId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  approvalRole?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  slaDurationMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isEmergencyOverride?: boolean;
}
