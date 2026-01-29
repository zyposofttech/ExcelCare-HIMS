import { IsDateString, IsOptional } from "class-validator";

export class ActivateTariffPlanDto {
  /**
   * If omitted, activation uses "now".
   * Used to close existing active plans (effectiveTo = effectiveFrom).
   */
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}
