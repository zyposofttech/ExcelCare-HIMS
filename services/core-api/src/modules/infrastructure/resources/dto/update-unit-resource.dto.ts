import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateUnitResourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSchedulable?: boolean;
}
