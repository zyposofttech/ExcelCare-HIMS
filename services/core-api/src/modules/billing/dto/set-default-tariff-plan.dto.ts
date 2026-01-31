import { IsBoolean } from "class-validator";

export class SetDefaultTariffPlanDto {
  @IsBoolean()
  isDefault!: boolean;
}
