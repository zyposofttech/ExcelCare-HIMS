import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const INTEGRATION_MODES = [
  "HCX",
  "NHCX",
  "DIRECT_API",
  "SFTP_BATCH",
  "PORTAL_ASSISTED",
  "MANUAL",
] as const;

export class CreatePayerIntegrationDto {
  @IsString()
  payerId!: string;

  @IsIn(INTEGRATION_MODES as any)
  integrationMode!: (typeof INTEGRATION_MODES)[number];

  // HCX / NHCX
  @IsOptional()
  @IsString()
  @MaxLength(128)
  hcxParticipantCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  hcxEndpointUrl?: string;

  @IsOptional()
  hcxAuthConfig?: any;

  // Direct API
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiBaseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  apiAuthMethod?: string;

  @IsOptional()
  apiAuthConfig?: any;

  // SFTP
  @IsOptional()
  @IsString()
  @MaxLength(256)
  sftpHost?: string;

  @IsOptional()
  @IsNumber()
  sftpPort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  sftpPath?: string;

  @IsOptional()
  sftpAuthConfig?: any;

  // Portal-assisted
  @IsOptional()
  @IsString()
  @MaxLength(500)
  portalUrl?: string;

  @IsOptional()
  @IsString()
  portalNotes?: string;

  // Webhook
  @IsOptional()
  @IsString()
  @MaxLength(256)
  webhookSecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  webhookUrl?: string;

  // Retry config
  @IsOptional()
  @IsNumber()
  retryMaxAttempts?: number;

  @IsOptional()
  @IsNumber()
  retryBackoffMs?: number;

  @IsOptional()
  @IsNumber()
  pollingIntervalMs?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
