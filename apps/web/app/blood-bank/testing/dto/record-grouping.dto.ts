import { IsBoolean, IsIn, IsOptional, IsString, ValidateIf } from "class-validator";

const BLOOD_GROUPS = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG", "BOMBAY", "RARE_OTHER"] as const;

/**
 * Frontend posts: { bloodUnitId, aboGroup, rhFactor, antibodyScreen }
 * DB stores a richer structure; we accept both the compact UI payload and the detailed payload.
 */
export class RecordGroupingDto {
  @ValidateIf((o) => !o.bloodUnitId) @IsOptional() @IsString() unitId?: string;
  @ValidateIf((o) => !o.unitId) @IsOptional() @IsString() bloodUnitId?: string;

  // UI fields
  @IsOptional() @IsString() aboGroup?: string; // A, B, AB, O (UI)
  @IsOptional() @IsString() rhFactor?: string; // POS, NEG (UI)

  // Detailed fields (optional)
  @IsOptional() aboForward?: any;
  @IsOptional() aboReverse?: any;
  @IsOptional() rhTyping?: any;

  @IsOptional() @IsString() antibodyScreen?: string;

  // Optional direct confirmation (preferred if provided)
  @IsOptional() @IsIn(BLOOD_GROUPS as any) confirmedBloodGroup?: string;

  @IsOptional() @IsBoolean() hasDiscrepancy?: boolean;
  @IsOptional() @IsString() discrepancyNotes?: string;
}
