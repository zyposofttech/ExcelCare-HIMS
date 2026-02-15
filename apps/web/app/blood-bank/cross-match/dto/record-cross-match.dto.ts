import { IsIn, IsOptional, IsString, ValidateIf } from "class-validator";

const METHODS = ["IMMEDIATE_SPIN", "AHG_INDIRECT_COOMBS", "ELECTRONIC"] as const;
const RESULTS = ["COMPATIBLE", "INCOMPATIBLE", "PENDING"] as const;

export class RecordCrossMatchDto {
  // Frontend sends bloodUnitId
  @ValidateIf((o) => !o.bloodUnitId) @IsOptional() @IsString() unitId?: string;
  @ValidateIf((o) => !o.unitId) @IsOptional() @IsString() bloodUnitId?: string;

  @IsOptional() @IsIn(METHODS as any) method?: string;
  @IsOptional() @IsIn(RESULTS as any) result?: string;
}
