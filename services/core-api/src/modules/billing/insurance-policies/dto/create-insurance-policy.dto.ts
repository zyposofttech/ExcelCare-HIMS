import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const POLICY_RELATIONSHIPS = ["SELF", "SPOUSE", "CHILD", "PARENT", "OTHER"] as const;
const POLICY_STATUSES = ["ACTIVE", "EXPIRED", "CANCELLED", "SUSPENDED", "LAPSED"] as const;

export class CreateInsurancePolicyDto {
  @IsString()
  patientId!: string;

  @IsString()
  payerId!: string;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsString()
  @MaxLength(64)
  policyNumber!: string;

  @IsString()
  @MaxLength(64)
  memberId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  groupId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  employerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  planName?: string;

  @IsOptional()
  @IsIn(POLICY_RELATIONSHIPS as any)
  relationship?: (typeof POLICY_RELATIONSHIPS)[number];

  @IsOptional()
  @IsIn(POLICY_STATUSES as any)
  status?: (typeof POLICY_STATUSES)[number];

  @IsString()
  validFrom!: string;

  @IsString()
  validTo!: string;

  @IsOptional()
  @IsNumber()
  sumInsured?: number;

  @IsOptional()
  @IsNumber()
  balanceRemaining?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cardNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cardImageUrl?: string;
}
