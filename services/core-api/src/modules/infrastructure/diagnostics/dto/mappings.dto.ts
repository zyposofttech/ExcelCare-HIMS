import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export enum DiagnosticModality {
  XRAY = "XRAY",
  ULTRASOUND = "ULTRASOUND",
  CT = "CT",
  MRI = "MRI",
  MAMMOGRAPHY = "MAMMOGRAPHY",
  FLUOROSCOPY = "FLUOROSCOPY",

  ECG = "ECG",
  ECHO = "ECHO",
  TMT = "TMT",
  HOLTER = "HOLTER",
  PFT = "PFT",
  EEG = "EEG",
  EMG_NCV = "EMG_NCV",

  LAB = "LAB",
  SAMPLE_COLLECTION = "SAMPLE_COLLECTION",

  PROCEDURE_ROOM = "PROCEDURE_ROOM",
  OTHER = "OTHER",
}

export class AddRoomToServicePointDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @IsOptional()
  @IsEnum(DiagnosticModality)
  modality?: DiagnosticModality;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddResourceToServicePointDto {
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @IsOptional()
  @IsEnum(DiagnosticModality)
  modality?: DiagnosticModality;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddEquipmentToServicePointDto {
  @IsString()
  @IsNotEmpty()
  equipmentId!: string;

  @IsOptional()
  @IsEnum(DiagnosticModality)
  modality?: DiagnosticModality;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListMappingsQuery {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(DiagnosticModality)
  modality?: DiagnosticModality;

  @IsOptional()
  @IsString()
  servicePointId?: string;
}
