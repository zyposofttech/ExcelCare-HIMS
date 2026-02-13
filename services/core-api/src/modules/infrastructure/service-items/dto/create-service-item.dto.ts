import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  Min,
} from "class-validator";

export class ServiceItemContextInputDto {
  @IsString()
  context!: string; // CareContext enum value as string

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class ServiceItemResourceRequirementInputDto {
  @IsString()
  resourceType!: string; // UnitResourceType enum value as string

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsObject()
  constraints?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ServiceItemClinicalRuleInputDto {
  @IsString()
  @MaxLength(64)
  ruleType!: string;

  @IsOptional()
  payload?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ServiceSeriesPolicyInputDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  totalSessions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSessionsPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiryDays?: number;

  @IsOptional()
  scheduleTemplate?: any;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateServiceItemDto {
  @IsString()
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  searchAliases?: string[];

  // Keep legacy category for UI grouping
  @IsString()
  @MaxLength(80)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subCategory?: string | null;

  @IsOptional()
  @IsString()
  unit?: string | null;

  // Advanced typing
  @IsOptional()
  @IsString()
  type?: string; // ServiceItemType enum string

  @IsOptional()
  @IsString()
  specialtyId?: string | null;

  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalId?: string | null;

  // Orderability + lifecycle flags
  @IsOptional()
  @IsBoolean()
  isOrderable?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;

  // Clinical constraints
  @IsOptional()
  @IsBoolean()
  consentRequired?: boolean;

  @IsOptional()
  @IsString()
  preparationText?: string | null;

  @IsOptional()
  @IsString()
  instructionsText?: string | null;

  @IsOptional()
  @IsString()
  contraindicationsText?: string | null;

  @IsOptional()
  @IsInt()
  minAgeYears?: number | null;

  @IsOptional()
  @IsInt()
  maxAgeYears?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  genderRestriction?: string | null;

  @IsOptional()
  @IsInt()
  cooldownMins?: number | null;

  // Operational definition
  @IsOptional()
  @IsBoolean()
  requiresAppointment?: boolean;

  @IsOptional()
  @IsInt()
  estimatedDurationMins?: number | null;

  @IsOptional()
  @IsInt()
  prepMins?: number | null;

  @IsOptional()
  @IsInt()
  recoveryMins?: number | null;

  @IsOptional()
  @IsInt()
  tatMinsRoutine?: number | null;

  @IsOptional()
  @IsInt()
  tatMinsStat?: number | null;

  // Billing definition
  @IsOptional()
  @IsString()
  chargeUnit?: string | null; // ServiceChargeUnit enum string

  @IsOptional()
  @IsString()
  taxApplicability?: string | null; // TaxApplicability enum string

  @IsOptional()
  billingPolicy?: any;

  // Scheduling & Availability
  @IsOptional()
  @IsBoolean()
  requiresScheduling?: boolean;

  @IsOptional()
  @IsBoolean()
  statAvailable?: boolean;

  @IsOptional()
  @IsInt()
  defaultTatHours?: number | null;

  // Pricing
  @IsOptional()
  basePrice?: number | null;

  @IsOptional()
  costPrice?: number | null;

  @IsOptional()
  @IsBoolean()
  allowDiscount?: boolean;

  @IsOptional()
  maxDiscountPercent?: number | null;

  // Effective dates
  @IsOptional()
  @IsString()
  effectiveFrom?: string | null;

  @IsOptional()
  @IsString()
  effectiveTill?: string | null;

  // Optional mapping at create-time (convenience)
  @IsOptional()
  @IsString()
  chargeMasterCode?: string | null;

  // Optional: aliases/contexts/resources/rules series setup at create-time
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceItemContextInputDto)
  contexts?: ServiceItemContextInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceItemResourceRequirementInputDto)
  resourceRequirements?: ServiceItemResourceRequirementInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceItemClinicalRuleInputDto)
  clinicalRules?: ServiceItemClinicalRuleInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceSeriesPolicyInputDto)
  seriesPolicies?: ServiceSeriesPolicyInputDto[];
}
