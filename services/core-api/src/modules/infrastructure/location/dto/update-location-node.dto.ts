import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength, Matches } from "class-validator";
import { RX_LOCATION_CODE_ANY } from "../../../../common/naming.util";

export class UpdateLocationNodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  // If you want to effective-date code changes too
  @IsOptional()
  @Matches(RX_LOCATION_CODE_ANY)
  code?: string;
}
