import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateServiceAvailabilityCalendarDto {
  @IsString()
  serviceItemId!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
