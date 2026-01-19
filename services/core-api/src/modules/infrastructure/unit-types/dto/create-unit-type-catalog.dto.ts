import { IsBoolean, IsOptional, IsString, Length, Matches } from "class-validator";

export class CreateUnitTypeCatalogDto {
  @IsString()
  @Length(2, 24)
  @Matches(/^[A-Z0-9_-]+$/, { message: "Code can contain only A–Z, 0–9, underscore (_) and hyphen (-)." })
  code!: string;

  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  usesRoomsDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  schedulableByDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
