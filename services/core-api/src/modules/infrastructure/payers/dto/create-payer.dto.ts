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

export class CreatePayerDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsIn(PAYER_KINDS as any)
  kind!: (typeof PAYER_KINDS)[number];

  @IsOptional()
  @IsIn(PAYER_STATUSES as any)
  status?: (typeof PAYER_STATUSES)[number];

  // Regulatory
  @IsOptional()
  @IsString()
  @MaxLength(64)
  irdaiRegistration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  licenseValidTill?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  panNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  gstinNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(21)
  cinNumber?: string;

  // Contacts & Addresses (stored as JSON)
  @IsOptional()
  addresses?: any;

  @IsOptional()
  contacts?: any;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  portalUrl?: string;

  // Financial Terms
  @IsOptional()
  @IsNumber()
  creditDays?: number;

  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @IsOptional()
  @IsNumber()
  gracePeriodDays?: number;

  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @IsOptional()
  @IsNumber()
  earlyPaymentDiscount?: number;

  @IsOptional()
  settlementTerms?: any;

  // Operational Config
  @IsOptional()
  @IsBoolean()
  requiresPreauth?: boolean;

  @IsOptional()
  @IsNumber()
  preauthThreshold?: number;

  @IsOptional()
  @IsArray()
  supportingDocs?: string[];

  @IsOptional()
  @IsArray()
  claimSubmissionMethod?: string[];

  // Network Config
  @IsOptional()
  @IsString()
  @MaxLength(32)
  networkType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  empanelmentLevel?: string;

  @IsOptional()
  @IsNumber()
  roomRentLimit?: number;

  @IsOptional()
  @IsNumber()
  icuRentLimit?: number;

  // Integration
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiEndpoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  authMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  webhookUrl?: string;

  // Empanelment
  @IsOptional()
  @IsString()
  empanelmentStartDate?: string;

  @IsOptional()
  @IsString()
  empanelmentEndDate?: string;

  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
