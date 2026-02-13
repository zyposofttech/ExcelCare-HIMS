import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const PAYER_KINDS = [
  "INSURANCE",
  "TPA",
  "CORPORATE",
  "GOVERNMENT",
  "TRUST",
  "EMPLOYEE",
  "SELF_PAY",
] as const;

const PAYER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "BLOCKED"] as const;

export class UpdatePayerDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsIn(PAYER_KINDS as any)
  kind?: (typeof PAYER_KINDS)[number];

  @IsOptional()
  @IsIn(PAYER_STATUSES as any)
  status?: (typeof PAYER_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  irdaiRegistration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  licenseNumber?: string | null;

  @IsOptional()
  @IsString()
  licenseValidTill?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  panNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  gstinNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(21)
  cinNumber?: string | null;

  @IsOptional()
  addresses?: any;

  @IsOptional()
  contacts?: any;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  portalUrl?: string | null;

  @IsOptional()
  @IsNumber()
  creditDays?: number | null;

  @IsOptional()
  @IsNumber()
  creditLimit?: number | null;

  @IsOptional()
  @IsNumber()
  gracePeriodDays?: number | null;

  @IsOptional()
  @IsNumber()
  interestRate?: number | null;

  @IsOptional()
  @IsNumber()
  earlyPaymentDiscount?: number | null;

  @IsOptional()
  settlementTerms?: any;

  @IsOptional()
  @IsBoolean()
  requiresPreauth?: boolean;

  @IsOptional()
  @IsNumber()
  preauthThreshold?: number | null;

  @IsOptional()
  @IsArray()
  supportingDocs?: string[];

  @IsOptional()
  @IsArray()
  claimSubmissionMethod?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  networkType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  empanelmentLevel?: string | null;

  @IsOptional()
  @IsNumber()
  roomRentLimit?: number | null;

  @IsOptional()
  @IsNumber()
  icuRentLimit?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiEndpoint?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  authMethod?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  webhookUrl?: string | null;

  @IsOptional()
  @IsString()
  empanelmentStartDate?: string | null;

  @IsOptional()
  @IsString()
  empanelmentEndDate?: string | null;

  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
