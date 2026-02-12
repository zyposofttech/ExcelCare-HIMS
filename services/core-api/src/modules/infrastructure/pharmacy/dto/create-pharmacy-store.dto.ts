import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from "class-validator";

const STORE_TYPES = [
  "MAIN",
  "IP_PHARMACY",
  "OP_PHARMACY",
  "EMERGENCY",
  "OT_STORE",
  "ICU_STORE",
  "WARD_STORE",
  "NARCOTICS",
] as const;

export class CreatePharmacyStoreDto {
  @Matches(/^[A-Z0-9_-]{2,32}$/i)
  storeCode!: string;

  @IsString()
  @MaxLength(160)
  storeName!: string;

  @IsIn(STORE_TYPES)
  storeType!: string;

  @IsOptional()
  @IsString()
  parentStoreId?: string | null;

  @IsOptional()
  @IsString()
  locationNodeId?: string | null;

  @IsOptional()
  @IsString()
  pharmacistInChargeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  drugLicenseNumber?: string | null;

  @IsOptional()
  @IsDateString()
  drugLicenseExpiry?: string | null;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is24x7?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  canDispense?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  canIndent?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  canReceiveStock?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  canReturnVendor?: boolean;

  @IsOptional()
  operatingHours?: any;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  autoIndentEnabled?: boolean;
}
