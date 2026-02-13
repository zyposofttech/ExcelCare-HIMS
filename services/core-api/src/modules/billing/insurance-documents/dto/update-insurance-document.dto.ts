import { IsArray, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const DOC_ROLES = [
  "PREAUTH_FORM",
  "DISCHARGE_SUMMARY",
  "INVESTIGATION_REPORT",
  "PRESCRIPTION",
  "BILL_SUMMARY",
  "CLAIM_FORM",
  "ID_PROOF",
  "INSURANCE_CARD",
  "QUERY_RESPONSE",
  "ENHANCEMENT_FORM",
  "DOC_OTHER",
] as const;

export class UpdateInsuranceDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  fileMime?: string | null;

  @IsOptional()
  @IsNumber()
  fileSizeBytes?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string | null;

  @IsOptional()
  @IsIn(DOC_ROLES as any)
  docRole?: (typeof DOC_ROLES)[number];

  @IsOptional()
  @IsNumber()
  version?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
