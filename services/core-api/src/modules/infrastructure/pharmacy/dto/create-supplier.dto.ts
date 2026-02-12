import { Type } from "class-transformer";
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateSupplierDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  supplierCode?: string;

  @IsString()
  @MaxLength(255)
  supplierName!: string;

  @IsOptional()
  @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/i, { message: "Invalid GSTIN format" })
  gstin?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  drugLicenseNumber?: string | null;

  @IsOptional()
  @IsDateString()
  drugLicenseExpiry?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactPerson?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  paymentTermsDays?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  discountTerms?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deliveryLeadTimeDays?: number | null;

  @IsOptional()
  productCategories?: any;
}
