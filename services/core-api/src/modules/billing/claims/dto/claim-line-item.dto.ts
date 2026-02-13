import { IsArray, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class ClaimLineItemDto {
  @IsOptional()
  @IsString()
  serviceItemId?: string;

  @IsOptional()
  @IsString()
  chargeMasterItemId?: string;

  @IsString()
  @MaxLength(240)
  description!: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsNumber()
  unitPrice!: number;

  @IsNumber()
  totalPrice!: number;

  // Clinical coding fields (for NHCX/FHIR-compliant submissions)
  @IsOptional()
  @IsString()
  @MaxLength(16)
  icdCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  icdDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  cptCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  cptDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  snomedCode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifiers?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4)
  placeOfService?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  diagnosisRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  packageCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  hsnSac?: string;
}
