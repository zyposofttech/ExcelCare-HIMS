import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateChargeMasterItemDto {
  @IsString()
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
