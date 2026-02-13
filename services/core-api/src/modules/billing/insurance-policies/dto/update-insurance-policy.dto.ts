import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const POLICY_RELATIONSHIPS = ["SELF", "SPOUSE", "CHILD", "PARENT", "OTHER"] as const;
const POLICY_STATUSES = ["ACTIVE", "EXPIRED", "CANCELLED", "SUSPENDED", "LAPSED"] as const;

export class UpdateInsurancePolicyDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  payerId?: string;

  @IsOptional()
  @IsString()
  contractId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  policyNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  memberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  groupId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  employerName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  planName?: string | null;

  @IsOptional()
  @IsIn(POLICY_RELATIONSHIPS as any)
  relationship?: (typeof POLICY_RELATIONSHIPS)[number];

  @IsOptional()
  @IsIn(POLICY_STATUSES as any)
  status?: (typeof POLICY_STATUSES)[number];

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsString()
  validTo?: string;

  @IsOptional()
  @IsNumber()
  sumInsured?: number | null;

  @IsOptional()
  @IsNumber()
  balanceRemaining?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cardNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cardImageUrl?: string | null;
}
