import { IsArray, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class CreatePreauthDto {
  @IsString()
  insuranceCaseId!: string;

  @IsString()
  @MaxLength(48)
  requestNumber!: string;

  @IsOptional()
  @IsNumber()
  requestedAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  packageCode?: string;

  @IsOptional()
  @IsString()
  procedureSummary?: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  // Clinical coding fields (for NHCX/FHIR-compliant submissions)
  @IsOptional()
  @IsString()
  @MaxLength(16)
  primaryDiagnosisCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  primaryDiagnosisDesc?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  secondaryDiagnosisCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  procedureCodes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(48)
  hbpPackageCode?: string;

  @IsOptional()
  @IsString()
  implantDetails?: string;

  @IsOptional()
  @IsString()
  investigationSummary?: string;

  @IsOptional()
  @IsString()
  otNotes?: string;
}
