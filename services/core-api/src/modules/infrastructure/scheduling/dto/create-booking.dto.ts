import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

// For ScheduledProcedure model (unitId + optional roomId)
export class CreateBookingDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  roomId?: string | null;

  @IsString()
  @MaxLength(200)
  procedureName!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  primaryDoctorId?: string | null;
}
