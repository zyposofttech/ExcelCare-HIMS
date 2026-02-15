import { IsIn, IsOptional, IsString } from "class-validator";

const BLOOD_GROUPS = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG", "BOMBAY", "RARE_OTHER"] as const;

export class PatientGroupingDto {
  /** Canonical field name (preferred) */
  @IsOptional() @IsIn(BLOOD_GROUPS as any) patientBloodGroup?: string;

  /** UI/backward-compat alias */
  @IsOptional() @IsIn(BLOOD_GROUPS as any) bloodGroup?: string;

  /** Canonical field name (preferred) */
  @IsOptional() @IsString() patientAntibodies?: string;

  /** UI/backward-compat aliases */
  @IsOptional() @IsString() antibodies?: string;
  @IsOptional() @IsString() antibodyScreenResult?: string;

  // e.g., "WRISTBAND_SCAN", "MANUAL" (stored on sample)
  @IsOptional() @IsString() verificationMethod?: string;

  @IsOptional() @IsString() notes?: string;
}
