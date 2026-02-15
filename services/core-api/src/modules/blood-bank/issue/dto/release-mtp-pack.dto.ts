import { IsOptional, IsString } from "class-validator";

/**
 * Massive Transfusion Protocol (MTP) emergency release payload.
 *
 * Notes:
 * - This performs an *uncrossmatched* emergency release (PRD S8).
 * - Safety gates still apply for: verified grouping, verified NON_REACTIVE TTI, expiry, cold-chain, calibration, temp-breach.
 */
export class ReleaseMtpPackDto {
  @IsOptional() @IsString() branchId?: string;

  /** Defaults to MTP packRatio.prbc or 4 */
  @IsOptional() prbcUnits?: number;

  /** Defaults to MTP packRatio.ffp or 4 */
  @IsOptional() ffpUnits?: number;

  /** Optional additional platelets (not required for S8) */
  @IsOptional() plateletUnits?: number;

  @IsOptional() @IsString() issuedToWard?: string;
  @IsOptional() @IsString() issuedToPerson?: string;
  @IsOptional() transportBoxTemp?: number;
  @IsOptional() @IsString() notes?: string;
}
