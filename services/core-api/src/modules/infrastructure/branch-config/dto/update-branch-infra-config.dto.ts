import { IsBoolean } from "class-validator";

export class UpdateBranchInfraConfigDto {
  @IsBoolean()
  housekeepingGateEnabled!: boolean;
}
