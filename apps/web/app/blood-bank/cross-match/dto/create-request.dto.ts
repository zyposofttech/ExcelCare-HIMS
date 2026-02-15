import { IsIn, IsInt, IsOptional, IsString, Min, ValidateIf } from "class-validator";

const URGENCIES = ["ROUTINE", "URGENT", "EMERGENCY", "MTP"] as const;
const COMPONENT_TYPES = [
  "WHOLE_BLOOD",
  "PRBC",
  "FFP",
  "PLATELET_RDP",
  "PLATELET_SDP",
  "CRYOPRECIPITATE",
  "CRYO_POOR_PLASMA",
] as const;

/**
 * Create Blood Request
 *
 * Notes:
 * - Canonical DB schema expects: patientId, requestedComponent, quantityUnits.
 * - Frontend currently posts: patientName + uhid + requestedComponent + quantityUnits.
 * - This DTO supports both styles. Service will resolve/create Patient from UHID if patientId is absent.
 */
export class CreateRequestDto {
  @IsOptional() @IsString() branchId?: string;

  // Preferred: linked Patient
  @ValidateIf((o) => !o.uhid && !o.patientName)
  @IsOptional()
  @IsString()
  patientId?: string;

  // UI compatibility: create/resolve Patient from UHID + name
  @ValidateIf((o) => !o.patientId)
  @IsOptional()
  @IsString()
  uhid?: string;

  @ValidateIf((o) => !o.patientId)
  @IsOptional()
  @IsString()
  patientName?: string;

  @IsOptional() @IsString() encounterId?: string;

  // Canonical names (Prisma)
  @ValidateIf((o) => !o.componentType)
  @IsOptional()
  @IsIn(COMPONENT_TYPES as any)
  requestedComponent?: string;

  @ValidateIf((o) => !o.quantityRequested)
  @IsOptional()
  @IsInt()
  @Min(1)
  quantityUnits?: number;

  // Legacy names (kept for backward compatibility)
  @ValidateIf((o) => !o.requestedComponent)
  @IsOptional()
  @IsIn(COMPONENT_TYPES as any)
  componentType?: string;

  @ValidateIf((o) => !o.quantityUnits)
  @IsOptional()
  @IsInt()
  @Min(1)
  quantityRequested?: number;

  @IsOptional() @IsIn(URGENCIES as any) urgency?: string;
  @IsOptional() @IsString() indication?: string;
  @IsOptional() @IsString() diagnosis?: string;
  @IsOptional() @IsString() notes?: string;

  // UI sends ISO string; service stores in notes/meta (future SLA use)
  @IsOptional() @IsString() requiredByDate?: string;
}
