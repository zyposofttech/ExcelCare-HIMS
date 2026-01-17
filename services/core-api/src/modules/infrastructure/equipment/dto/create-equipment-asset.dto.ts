import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateEquipmentAssetDto {
  @IsString()
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsIn(["GENERAL", "RADIOLOGY", "ULTRASOUND"])
  category!: "GENERAL" | "RADIOLOGY" | "ULTRASOUND";

  @IsString()
  make!: string;

  @IsString()
  model!: string;

  @IsString()
  serial!: string;

  @IsString()
  ownerDepartmentId!: string;

  @IsOptional()
  @IsString()
  unitId?: string | null;

  @IsOptional()
  @IsString()
  roomId?: string | null;

  @IsOptional()
  @IsString()
  locationNodeId?: string | null;

  @IsOptional()
  @IsIn(["OPERATIONAL", "DOWN", "MAINTENANCE", "RETIRED"])
  operationalStatus?: "OPERATIONAL" | "DOWN" | "MAINTENANCE" | "RETIRED";

  @IsOptional()
  @IsString()
  amcVendor?: string | null;

  @IsOptional()
  @IsDateString()
  amcValidFrom?: string | null;

  @IsOptional()
  @IsDateString()
  amcValidTo?: string | null;

  @IsOptional()
  @IsDateString()
  warrantyValidTo?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  pmFrequencyDays?: number | null;

  @IsOptional()
  @IsDateString()
  nextPmDueAt?: string | null;

  // Compliance
  @IsOptional()
  @IsString()
  aerbLicenseNo?: string | null;

  @IsOptional()
  @IsDateString()
  aerbValidTo?: string | null;

  @IsOptional()
  @IsString()
  pcpndtRegNo?: string | null;

  @IsOptional()
  @IsDateString()
  pcpndtValidTo?: string | null;

  @IsOptional()
  @IsBoolean()
  isSchedulable?: boolean;
}
