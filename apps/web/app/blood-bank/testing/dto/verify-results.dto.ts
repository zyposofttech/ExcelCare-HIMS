import { IsOptional, IsString, ValidateIf } from "class-validator";

export class VerifyResultsDto {
  @ValidateIf((o) => !o.bloodUnitId) @IsOptional() @IsString() unitId?: string;
  @ValidateIf((o) => !o.unitId) @IsOptional() @IsString() bloodUnitId?: string;

  @IsOptional() @IsString() notes?: string;
}
