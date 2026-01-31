import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateServiceAvailabilityCalendarDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
