import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, Matches } from "class-validator";
import type { ResourceType } from "../../../../common/naming.util";
import { RX_RESOURCE_CODE_ANY } from "../../../../common/naming.util";

export class CreateUnitResourceDto {
  @IsString()
  unitId!: string;

  @IsOptional()
  @IsString()
  roomId?: string | null;

  @IsIn([
    "BED",
    "BAY",
    "CHAIR",
    "OT_TABLE",
    "PROCEDURE_TABLE",
    "DIALYSIS_STATION",
    "RECOVERY_BAY",
    "EXAM_SLOT",
    "INCUBATOR",
  ])
  resourceType!: ResourceType;

  @Matches(RX_RESOURCE_CODE_ANY)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSchedulable?: boolean;
}
