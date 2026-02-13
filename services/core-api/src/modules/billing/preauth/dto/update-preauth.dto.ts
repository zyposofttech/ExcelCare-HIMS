import { IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePreauthDto {
  @IsOptional()
  @IsString()
  @MaxLength(48)
  requestNumber?: string;

  @IsOptional()
  @IsNumber()
  requestedAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  packageCode?: string;

  @IsOptional()
  @IsString()
  procedureSummary?: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string;
}
