import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

// ------------------------------------------------------------------ enums ---

const SCHEME_VALUES = ["PMJAY", "CGHS", "ECHS", "STATE_SCHEME", "OTHER"] as const;
type SchemeType = (typeof SCHEME_VALUES)[number];

const CITY_CATEGORY_VALUES = ["A", "B", "C"] as const;
type CityCategory = (typeof CITY_CATEGORY_VALUES)[number];

const EMPANELMENT_STATUS_VALUES = ["DRAFT", "ACTIVE", "SUSPENDED"] as const;
type EmpanelmentStatus = (typeof EMPANELMENT_STATUS_VALUES)[number];

// ------------------------------------------------------- Empanelment DTOs ---

export class CreateEmpanelmentDto {
  // UI v1 posts branchId; backend resolves to workspaceId.
  @IsString()
  @IsOptional()
  workspaceId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsIn(SCHEME_VALUES as unknown as string[])
  scheme!: SchemeType;

  @IsString()
  @MaxLength(100)
  empanelmentNumber!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  shaCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @IsIn(CITY_CATEGORY_VALUES as unknown as string[])
  @IsOptional()
  cityCategory?: CityCategory;

  @IsIn(EMPANELMENT_STATUS_VALUES as unknown as string[])
  @IsOptional()
  status?: EmpanelmentStatus;
}

export class UpdateEmpanelmentDto {
  @IsIn(SCHEME_VALUES as unknown as string[])
  @IsOptional()
  scheme?: SchemeType;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  empanelmentNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  shaCode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  state?: string;

  @IsIn(CITY_CATEGORY_VALUES as unknown as string[])
  @IsOptional()
  cityCategory?: CityCategory;

  @IsIn(EMPANELMENT_STATUS_VALUES as unknown as string[])
  @IsOptional()
  status?: EmpanelmentStatus;
}

// --------------------------------------------------------- RateCard DTOs ---

export class CreateRateCardDto {
  @IsString()
  @IsOptional()
  workspaceId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsIn(SCHEME_VALUES as unknown as string[])
  scheme!: SchemeType;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  version?: string;

  @IsString()
  @IsOptional()
  effectiveFrom?: string;

  @IsString()
  @IsOptional()
  effectiveTo?: string;
}

export class UpdateRateCardDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  version?: string;

  @IsString()
  @IsOptional()
  effectiveFrom?: string;

  @IsString()
  @IsOptional()
  effectiveTo?: string;
}

// ----------------------------------------------------- RateCardItem DTOs ---

export class UpdateRateCardItemDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  name?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  rate?: number;

  @IsString()
  @IsOptional()
  inclusions?: string;

  @IsString()
  @IsOptional()
  exclusions?: string;
}

// ---------------------------------------------------------- Mapping DTOs ---

export class CreateMappingDto {
  @IsString()
  @IsOptional()
  workspaceId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsIn(SCHEME_VALUES as unknown as string[])
  scheme!: SchemeType;

  @IsString()
  @MaxLength(100)
  externalCode!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  externalName?: string;

  @IsString()
  @IsOptional()
  internalServiceId?: string;

  @IsString()
  @IsOptional()
  internalTariffItemId?: string;

  @IsObject()
  @IsOptional()
  rules?: Record<string, any>;
}

export class UpdateMappingDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  externalName?: string;

  @IsString()
  @IsOptional()
  internalServiceId?: string;

  @IsString()
  @IsOptional()
  internalTariffItemId?: string;

  @IsObject()
  @IsOptional()
  rules?: Record<string, any>;
}
