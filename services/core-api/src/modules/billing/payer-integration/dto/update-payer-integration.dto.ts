import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const INTEGRATION_MODES = [
  "HCX",
  "NHCX",
  "DIRECT_API",
  "SFTP_BATCH",
  "PORTAL_ASSISTED",
  "MANUAL",
] as const;

export class UpdatePayerIntegrationDto {
  @IsOptional()
  @IsString()
  payerId?: string;

  @IsOptional()
  @IsIn(INTEGRATION_MODES as any)
  integrationMode?: (typeof INTEGRATION_MODES)[number];

  // HCX / NHCX
  @IsOptional()
  @IsString()
  @MaxLength(128)
  hcxParticipantCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  hcxEndpointUrl?: string | null;

  @IsOptional()
  hcxAuthConfig?: any;

  // Direct API
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiBaseUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  apiAuthMethod?: string | null;

  @IsOptional()
  apiAuthConfig?: any;

  // SFTP
  @IsOptional()
  @IsString()
  @MaxLength(256)
  sftpHost?: string | null;

  @IsOptional()
  @IsNumber()
  sftpPort?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  sftpPath?: string | null;

  @IsOptional()
  sftpAuthConfig?: any;

  // Portal-assisted
  @IsOptional()
  @IsString()
  @MaxLength(500)
  portalUrl?: string | null;

  @IsOptional()
  @IsString()
  portalNotes?: string | null;

  // Webhook
  @IsOptional()
  @IsString()
  @MaxLength(256)
  webhookSecret?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  webhookUrl?: string | null;

  // Retry config
  @IsOptional()
  @IsNumber()
  retryMaxAttempts?: number;

  @IsOptional()
  @IsNumber()
  retryBackoffMs?: number;

  @IsOptional()
  @IsNumber()
  pollingIntervalMs?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
