import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateServiceBlackoutDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
