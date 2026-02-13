import { IsIn, IsOptional, IsString } from "class-validator";

const INSURANCE_CASE_STATUSES = [
  "DRAFT",
  "POLICY_VERIFIED",
  "PREAUTH_PENDING",
  "PREAUTH_APPROVED",
  "ADMITTED",
  "DISCHARGE_PENDING",
  "CLAIM_SUBMITTED",
  "CLAIM_APPROVED",
  "SETTLED",
  "CLOSED",
  "CANCELLED",
] as const;

export class TransitionCaseDto {
  @IsString()
  @IsIn(INSURANCE_CASE_STATUSES as any)
  targetStatus!: (typeof INSURANCE_CASE_STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string;
}
