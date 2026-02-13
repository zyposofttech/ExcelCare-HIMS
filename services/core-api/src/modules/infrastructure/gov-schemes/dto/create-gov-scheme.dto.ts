import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const SCHEME_TYPES = ["PMJAY", "CGHS", "ECHS", "STATE_SCHEME", "OTHER"] as const;

export class CreateGovSchemeDto {
  @IsIn(SCHEME_TYPES as any)
  schemeType!: (typeof SCHEME_TYPES)[number];

  @IsString()
  @MaxLength(200)
  schemeName!: string;

  @IsString()
  @MaxLength(64)
  schemeCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  registrationDate?: string;

  @IsOptional()
  @IsString()
  validTill?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  shaCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nhaCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nhaHospitalCode?: string;

  @IsOptional()
  @IsArray()
  empaneledSpecialtyIds?: string[];

  @IsOptional()
  @IsBoolean()
  preauthRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  verificationMethod?: string;

  @IsOptional()
  packageMapping?: any;

  @IsOptional()
  @IsNumber()
  claimSubmissionWindowDays?: number;

  @IsOptional()
  @IsNumber()
  claimProcessingTimeDays?: number;

  @IsOptional()
  @IsArray()
  requiredDocuments?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
