import { IsIn, IsOptional, IsString, ValidateIf } from "class-validator";

const DISCARD_REASONS = ["EXPIRED", "TTI_REACTIVE", "BAG_LEAK", "CLOT", "LIPEMIC", "HEMOLYZED", "QC_FAILURE", "RETURN_TIMEOUT", "OTHER"] as const;

export class DiscardUnitDto {
  @IsOptional() @IsString() branchId?: string;

  // API compatibility
  @ValidateIf((o) => !o.bloodUnitId) @IsOptional() @IsString() unitId?: string;
  @ValidateIf((o) => !o.unitId) @IsOptional() @IsString() bloodUnitId?: string;

  @IsIn(DISCARD_REASONS as any) reason!: string;
  @IsOptional() @IsString() notes?: string;
}
