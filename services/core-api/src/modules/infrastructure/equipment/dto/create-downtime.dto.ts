import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDowntimeDto {
  @IsString()
  assetId!: string;

  @IsString()
  @MaxLength(240)
  reason!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
