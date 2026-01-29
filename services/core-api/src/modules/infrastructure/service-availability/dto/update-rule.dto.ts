import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateAvailabilityRuleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  startMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  endMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  slotSizeMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAppointmentsPerSlot?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
