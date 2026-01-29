import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class UpdateTariffPlanDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isTaxInclusive?: boolean;
}
