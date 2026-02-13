import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const SCHEME_TYPES = ["PMJAY", "CGHS", "ECHS", "STATE_SCHEME", "OTHER"] as const;

export class UpdateGovSchemeDto {
  @IsOptional()
  @IsIn(SCHEME_TYPES as any)
  schemeType?: (typeof SCHEME_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  schemeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  schemeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  registrationNumber?: string | null;

  @IsOptional()
  @IsString()
  registrationDate?: string | null;

  @IsOptional()
  @IsString()
  validTill?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  shaCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nhaCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nhaHospitalCode?: string | null;

  @IsOptional()
  @IsArray()
  empaneledSpecialtyIds?: string[];

  @IsOptional()
  @IsBoolean()
  preauthRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  verificationMethod?: string | null;

  @IsOptional()
  packageMapping?: any;

  @IsOptional()
  @IsNumber()
  claimSubmissionWindowDays?: number | null;

  @IsOptional()
  @IsNumber()
  claimProcessingTimeDays?: number | null;

  @IsOptional()
  @IsArray()
  requiredDocuments?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
