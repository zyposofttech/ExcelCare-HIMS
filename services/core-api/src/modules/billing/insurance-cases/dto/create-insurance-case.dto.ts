import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

const CASE_TYPES = ["CASHLESS", "REIMBURSEMENT", "PACKAGE"] as const;

export class CreateInsuranceCaseDto {
  @IsString()
  @MaxLength(48)
  caseNumber!: string;

  @IsString()
  patientId!: string;

  @IsString()
  encounterId!: string;

  @IsOptional()
  @IsString()
  admissionId?: string;

  @IsString()
  policyId!: string;

  @IsString()
  payerId!: string;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsString()
  schemeConfigId?: string;

  @IsOptional()
  @IsIn(CASE_TYPES as any)
  caseType?: (typeof CASE_TYPES)[number];

  @IsOptional()
  @IsString()
  treatingDoctorId?: string;

  @IsOptional()
  @IsString()
  primaryDiagnosis?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  procedures?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(48)
  packageCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  packageName?: string;

  @IsOptional()
  @IsNumber()
  estimatedAmount?: number;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  slaDeadline?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
