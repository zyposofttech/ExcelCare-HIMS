import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateUnitDto {
  // Optional: move unit to another location node (must belong to same branch)
  @IsOptional()
  @IsString()
  locationNodeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  usesRooms?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
