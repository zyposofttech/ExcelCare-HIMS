// ---------------------------------------------------------------------------
// DTO: Reconcile a Payment Advice
// ---------------------------------------------------------------------------
import { IsOptional, IsString } from "class-validator";

export class ReconcileDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
