import { IsInt, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateReferenceRangeDto {
  @IsString()
  @IsOptional()
  @MaxLength(10)
  sex?: string;

  @IsInt()
  @IsOptional()
  ageMinDays?: number;

  @IsInt()
  @IsOptional()
  ageMaxDays?: number;

  @IsNumber()
  @IsOptional()
  low?: number;

  @IsNumber()
  @IsOptional()
  high?: number;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  textRange?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateReferenceRangeDto {
  @IsOptional()
  sex?: string | null;

  @IsOptional()
  ageMinDays?: number | null;

  @IsOptional()
  ageMaxDays?: number | null;

  @IsOptional()
  low?: number | null;

  @IsOptional()
  high?: number | null;

  @IsOptional()
  textRange?: string | null;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsOptional()
  isActive?: boolean;
}
