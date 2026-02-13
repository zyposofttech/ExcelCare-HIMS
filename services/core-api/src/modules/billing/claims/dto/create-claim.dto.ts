import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const CLAIM_TYPES = ["FINAL", "INTERIM", "ENHANCEMENT"] as const;

export class CreateClaimDto {
  @IsString()
  insuranceCaseId!: string;

  @IsString()
  @MaxLength(48)
  claimNumber!: string;

  @IsOptional()
  @IsIn(CLAIM_TYPES as any)
  claimType?: (typeof CLAIM_TYPES)[number];

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
