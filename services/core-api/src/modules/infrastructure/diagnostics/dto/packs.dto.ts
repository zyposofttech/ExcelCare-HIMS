import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export enum DiagnosticPackVersionStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  RETIRED = "RETIRED",
}

export class ListPacksQuery {
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;

  @IsOptional()
  @IsString()
  labType?: string;
}

export class CreatePackDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  labType?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePackDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  labType?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListPackVersionsQuery {
  @IsOptional()
  @IsEnum(DiagnosticPackVersionStatus)
  status?: DiagnosticPackVersionStatus;
}

export class CreatePackVersionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  version?: number;

  @IsOptional()
  @IsEnum(DiagnosticPackVersionStatus)
  status?: DiagnosticPackVersionStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsObject()
  payload!: Record<string, any>;
}

export class UpdatePackVersionDto {
  @IsOptional()
  @IsEnum(DiagnosticPackVersionStatus)
  status?: DiagnosticPackVersionStatus;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}

export class PackPlacementDto {
  @IsString()
  @IsNotEmpty()
  servicePointCode!: string;

  @IsString()
  @IsNotEmpty()
  locationNodeId!: string;
}

export class ApplyPackDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  packVersionId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackPlacementDto)
  placements!: PackPlacementDto[];
}
