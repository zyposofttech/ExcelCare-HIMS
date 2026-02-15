import { IsNumber, IsOptional, IsString } from "class-validator";

export class RecordVitalsDto {
  /**
   * If omitted, service will auto-place vitals into the next interval bucket.
   * Allowed: PRE, 15MIN, 30MIN, 1HR, END, or "AUTO".
   */
  @IsOptional() @IsString() interval?: string;

  // Either provide a complete vitals object...
  @IsOptional() vitals?: any;

  // ...or provide fields directly (frontend form)
  @IsOptional() @IsNumber() temperature?: number;
  @IsOptional() @IsNumber() pulseRate?: number;
  @IsOptional() @IsString() bloodPressure?: string;
  @IsOptional() @IsNumber() respiratoryRate?: number;
  @IsOptional() @IsString() notes?: string;

  @IsOptional() @IsNumber() volumeTransfused?: number;
}
