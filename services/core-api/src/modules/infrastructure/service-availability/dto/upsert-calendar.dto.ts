import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpsertServiceAvailabilityCalendarDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  serviceItemId!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  name?: string | null;

  @IsOptional()
  timezone?: string | null; // e.g. "Asia/Kolkata"
}
