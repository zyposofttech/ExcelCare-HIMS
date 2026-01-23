import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";
import { DiagnosticModality } from "./mappings.dto";

export class ListCapabilitiesQuery {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsOptional()
  @IsString()
  servicePointId?: string;

  @IsOptional()
  @IsString()
  diagnosticItemId?: string;

  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;
}

export class CreateCapabilityDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  servicePointId!: string;

  @IsString()
  @IsNotEmpty()
  diagnosticItemId!: string;

  @IsOptional()
  @IsEnum(DiagnosticModality)
  modality?: DiagnosticModality;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  defaultDurationMins?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateCapabilityDto {
  @IsOptional()
  @IsString()
  branchId?: string; // for guard checks only

  @IsOptional()
  @IsEnum(DiagnosticModality)
  modality?: DiagnosticModality | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  defaultDurationMins?: number | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddCapabilityRoomDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;
}

export class AddCapabilityResourceDto {
  @IsString()
  @IsNotEmpty()
  resourceId!: string;
}

export class AddCapabilityEquipmentDto {
  @IsString()
  @IsNotEmpty()
  equipmentId!: string;
}
