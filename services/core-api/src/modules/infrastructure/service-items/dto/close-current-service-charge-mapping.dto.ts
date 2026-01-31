import { IsDateString, IsOptional, IsString } from "class-validator";

export class CloseCurrentServiceChargeMappingDto {
  @IsString()
  serviceItemId!: string;

  @IsOptional()
  @IsString()
  mappingId?: string;

  @IsDateString()
  effectiveTo!: string; // ISO datetime
}
