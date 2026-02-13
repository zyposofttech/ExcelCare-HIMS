// ---------------------------------------------------------------------------
// DTO: Create Payment Advice
// ---------------------------------------------------------------------------
import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

const PAYMENT_MODES = ["NEFT", "RTGS", "CHEQUE", "UPI", "CASH_PAYMENT", "OTHER_MODE"] as const;
export type PaymentModeType = (typeof PAYMENT_MODES)[number];

export class CreatePaymentAdviceDto {
  @IsNotEmpty()
  @IsString()
  claimId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  adviceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  utrNumber?: string;

  @IsNotEmpty()
  @IsDateString()
  paymentDate!: string;

  @IsNotEmpty()
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsIn(PAYMENT_MODES as any)
  paymentMode?: PaymentModeType;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  bankReference?: string;

  @IsOptional()
  @IsString()
  shortPaymentReason?: string;
}
