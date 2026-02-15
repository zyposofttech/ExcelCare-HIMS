import { IsOptional, IsString } from "class-validator";

/**
 * Frontend payload:
 * { verifiedBy, startNotes, vitals }
 */
export class StartTransfusionDto {
  @IsOptional() vitals?: any;

  @IsOptional() @IsString() verifiedBy?: string;
  @IsOptional() @IsString() startNotes?: string;
}
