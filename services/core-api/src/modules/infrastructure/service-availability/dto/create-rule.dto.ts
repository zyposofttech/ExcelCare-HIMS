import { IsBoolean, IsInt, IsOptional, Min, Max } from "class-validator";

export class CreateServiceAvailabilityRuleDto {
  // 0=Sun..6=Sat
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  // 0..1439
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  // 1..1440
  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
