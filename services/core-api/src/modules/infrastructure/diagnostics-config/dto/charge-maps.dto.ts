import { IsOptional, IsString, IsNumber, IsUUID, IsBoolean } from "class-validator";
import { DiagnosticKind } from "../diagnostics.types";

export class ListChargeMapsQuery {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsBoolean() includeInactive?: boolean;
  @IsOptional() @IsUUID() diagnosticItemId?: string;
}

export class CreateChargeMapDto {
  @IsOptional() @IsString() branchId?: string;

  @IsUUID() diagnosticItemId!: string;
  @IsString() chargeMasterId!: string;

  @IsOptional() @IsNumber() price?: number;

  @IsOptional() @IsString() effectiveFrom?: string;
  @IsOptional() @IsString() effectiveTo?: string;
}

export class UpdateChargeMapDto {
  @IsOptional() @IsNumber() price?: number | null;

  @IsOptional() @IsString() effectiveFrom?: string | null;
  @IsOptional() @IsString() effectiveTo?: string | null;

  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UnmappedQuery {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() kind?: DiagnosticKind;
}
