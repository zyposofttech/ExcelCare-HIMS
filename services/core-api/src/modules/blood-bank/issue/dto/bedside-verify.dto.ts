import { IsOptional, IsString } from "class-validator";

export class BedsideVerifyDto {
  /**
   * Wristband scan value. Accepts either Patient.id or Patient.uhid.
   * (Many hospitals encode UHID on the band.)
   */
  @IsOptional() @IsString() scannedPatientId?: string;

  /**
   * Unit scan value. Accepts either BloodUnit.barcode (ISBT/linear) or unitNumber.
   */
  @IsOptional() @IsString() scannedUnitBarcode?: string;

  /**
   * Second verifier (two-person check). Prefer staffId; UI may pass a name.
   */
  @IsOptional() @IsString() verifier2StaffId?: string;
}
