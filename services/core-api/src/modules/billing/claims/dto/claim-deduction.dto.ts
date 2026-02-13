import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const DEDUCTION_CATEGORIES = [
  "NON_PAYABLE",
  "EXCESS",
  "COPAY",
  "DEDUCTIBLE",
  "NON_MEDICAL",
  "TARIFF_DIFF",
  "OTHER",
] as const;

export class ClaimDeductionDto {
  @IsString()
  @MaxLength(48)
  reasonCode!: string;

  @IsString()
  @IsIn(DEDUCTION_CATEGORIES as any)
  reasonCategory!: (typeof DEDUCTION_CATEGORIES)[number];

  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsBoolean()
  isDisputed?: boolean;

  @IsOptional()
  @IsString()
  disputeNotes?: string;
}
