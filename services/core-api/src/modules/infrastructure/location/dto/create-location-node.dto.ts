import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength, Matches } from "class-validator";
import type { LocationKind } from "../../../../common/naming.util";
import { RX_LOCATION_CODE_ANY } from "../../../../common/naming.util";

export class CreateLocationNodeDto {
  @IsIn(["CAMPUS", "BUILDING", "FLOOR", "ZONE"])
  kind!: LocationKind;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @Matches(RX_LOCATION_CODE_ANY)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string; // ISO

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null; // ISO or null
}
