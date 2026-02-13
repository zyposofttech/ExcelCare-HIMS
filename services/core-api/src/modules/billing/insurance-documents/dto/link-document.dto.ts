import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

const ENTITY_TYPES = [
  "INSURANCE_CASE",
  "PREAUTH",
  "CLAIM",
  "PATIENT_POLICY",
] as const;

export class LinkDocumentDto {
  @IsString()
  documentId!: string;

  @IsIn(ENTITY_TYPES as any)
  entityType!: (typeof ENTITY_TYPES)[number];

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
