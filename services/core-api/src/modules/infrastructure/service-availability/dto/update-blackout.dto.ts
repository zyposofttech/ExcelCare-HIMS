import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateServiceBlackoutDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
