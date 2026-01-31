import { IsDateString } from "class-validator";

export class CloseServiceChargeMappingDto {
  @IsDateString()
  effectiveTo!: string; // ISO date-time string
}
