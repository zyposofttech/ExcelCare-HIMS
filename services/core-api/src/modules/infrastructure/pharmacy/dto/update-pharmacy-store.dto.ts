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

export class UpdatePharmacyStoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  storeName?: string;

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

  @IsOptional()
  @IsIn(["ACTIVE", "INACTIVE", "UNDER_SETUP"])
  status?: string;
}
