import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export class CreateAvailabilityRuleDto {
  @IsIn(WEEKDAYS as any)
  dayOfWeek!: (typeof WEEKDAYS)[number];

  // minutes from midnight, e.g. 540 = 09:00
  @IsInt()
  @Min(0)
  @Max(1439)
  startMin!: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  endMin!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  slotSizeMin?: number; // default 15

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAppointmentsPerSlot?: number; // default 1

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
