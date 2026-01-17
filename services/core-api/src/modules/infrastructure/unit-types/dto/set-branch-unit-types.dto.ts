import { IsString } from "class-validator";

export class SetBranchUnitTypesDto {
  @IsString({ each: true })
  unitTypeIds!: string[];
}
