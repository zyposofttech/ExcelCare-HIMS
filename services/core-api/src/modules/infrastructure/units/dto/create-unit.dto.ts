import { IsBoolean, IsOptional, IsString, MaxLength, Matches } from "class-validator";
import { RX_UNIT_CODE } from "../../../../common/naming.util";

export class CreateUnitDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  departmentId!: string;

  @IsString()
  unitTypeId!: string;

  // Unit must be bound to a specific location node under the branch
  @IsString()
  locationNodeId!: string;

  @Matches(RX_UNIT_CODE)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsBoolean()
  usesRooms?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
