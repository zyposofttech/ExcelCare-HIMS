import { IsBoolean, IsEnum, IsOptional, IsString, IsNumber, IsUUID, MaxLength } from "class-validator";
import { DiagnosticKind } from "../diagnostics.types";

export class ListItemsQuery {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsEnum(DiagnosticKind) kind?: DiagnosticKind;
  @IsOptional() @IsUUID() sectionId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsBoolean() includeInactive?: boolean;
  @IsOptional() @IsBoolean() isPanel?: boolean;
  @IsOptional() @IsString() q?: string;
}

export class CreateDiagnosticItemDto {
  @IsOptional() @IsString() branchId?: string;

  @IsString() @MaxLength(32) code!: string;
  @IsString() @MaxLength(200) name!: string;

  @IsEnum(DiagnosticKind) kind!: DiagnosticKind;

  @IsUUID() sectionId!: string;
  @IsOptional() @IsUUID() categoryId?: string;

  // LAB only
  @IsOptional() @IsUUID() specimenId?: string;

  @IsOptional() @IsBoolean() isPanel?: boolean;

  @IsOptional() @IsNumber() tatMinutes?: number;
  @IsOptional() @IsNumber() statTatMinutes?: number;

  @IsOptional() @IsString() preparationText?: string;

  @IsOptional() @IsBoolean() consentRequired?: boolean;
  @IsOptional() @IsBoolean() appointmentRequired?: boolean;

  @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateDiagnosticItemDto {
  @IsOptional() @IsString() branchId?: string;

  @IsOptional() @IsString() @MaxLength(32) code?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;

  @IsOptional() @IsUUID() sectionId?: string;
  @IsOptional() @IsUUID() categoryId?: string | null;

  @IsOptional() @IsUUID() specimenId?: string | null;

  @IsOptional() @IsBoolean() isPanel?: boolean;

  @IsOptional() @IsNumber() tatMinutes?: number | null;
  @IsOptional() @IsNumber() statTatMinutes?: number | null;

  @IsOptional() @IsString() preparationText?: string | null;

  @IsOptional() @IsBoolean() consentRequired?: boolean;
  @IsOptional() @IsBoolean() appointmentRequired?: boolean;

  @IsOptional() @IsNumber() sortOrder?: number;

  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ReplacePanelItemsDto {
  items!: { itemId: string; sortOrder?: number }[];
}
