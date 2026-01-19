import { IsEnum, IsOptional, IsString, IsNumber, IsUUID, IsBoolean, MaxLength } from "class-validator";
import { DiagnosticResultDataType } from "../diagnostics.types";

export class CreateParameterDto {
  @IsString() @MaxLength(32) code!: string;
  @IsString() @MaxLength(200) name!: string;

  @IsEnum(DiagnosticResultDataType) dataType!: DiagnosticResultDataType;

  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() precision?: number;

  // For CHOICE
  @IsOptional() @IsString() allowedText?: string;

  @IsOptional() @IsNumber() criticalLow?: number;
  @IsOptional() @IsNumber() criticalHigh?: number;

  @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateParameterDto {
  @IsOptional() @IsString() @MaxLength(32) code?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;

  @IsOptional() @IsEnum(DiagnosticResultDataType) dataType?: DiagnosticResultDataType;

  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @IsNumber() precision?: number | null;

  @IsOptional() @IsString() allowedText?: string | null;

  @IsOptional() @IsNumber() criticalLow?: number | null;
  @IsOptional() @IsNumber() criticalHigh?: number | null;

  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateReferenceRangeDto {
  @IsOptional() @IsString() sex?: string | null;

  @IsOptional() @IsNumber() ageMinDays?: number | null;
  @IsOptional() @IsNumber() ageMaxDays?: number | null;

  @IsOptional() @IsNumber() low?: number | null;
  @IsOptional() @IsNumber() high?: number | null;

  @IsOptional() @IsString() textRange?: string | null;

  @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateReferenceRangeDto {
  @IsOptional() @IsString() sex?: string | null;

  @IsOptional() @IsNumber() ageMinDays?: number | null;
  @IsOptional() @IsNumber() ageMaxDays?: number | null;

  @IsOptional() @IsNumber() low?: number | null;
  @IsOptional() @IsNumber() high?: number | null;

  @IsOptional() @IsString() textRange?: string | null;

  @IsOptional() @IsNumber() sortOrder?: number;

  @IsOptional() @IsBoolean() isActive?: boolean;
}
