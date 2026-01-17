import { IsBoolean, IsDateString, IsOptional, IsString } from "class-validator";

// For ProcedureBooking model (unitId + resourceId + strict prechecks)
export class CreateProcedureBookingDto {
  @IsString()
  unitId!: string;

  @IsString()
  resourceId!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  // Strict at scheduling time
  @IsBoolean()
  consentOk!: boolean;

  @IsBoolean()
  anesthesiaOk!: boolean;

  @IsBoolean()
  checklistOk!: boolean;

  @IsOptional()
  @IsString()
  patientId?: string | null;

  @IsOptional()
  @IsString()
  departmentId?: string | null;
}
