import { IsNumber, IsOptional, IsString } from "class-validator";

/**
 * Frontend payload (apps/web):
 * { branchId, crossMatchId, issuedToPerson, issuedToWard, transportBoxTemp, notes }
 */
export class IssueBloodDto {
  @IsOptional() @IsString() branchId?: string;

  @IsString() crossMatchId!: string;

  // API compatibility
  @IsOptional() @IsString() issuedToPerson?: string;
  @IsOptional() @IsString() issuedTo?: string; // legacy

  @IsOptional() @IsString() issuedToWard?: string;

  @IsOptional() @IsNumber() transportBoxTemp?: number;
  @IsOptional() @IsNumber() transportTemp?: number; // legacy

  @IsOptional() @IsString() notes?: string;

  // Optional inspection
  @IsOptional() visualInspectionOk?: boolean;
  @IsOptional() @IsString() inspectionNotes?: string;
}
