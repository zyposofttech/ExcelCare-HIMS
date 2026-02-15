import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

const TX_TYPES = ["RECEIPT", "ISSUE", "WASTAGE", "ADJUSTMENT"] as const;

export class AddNarcoticsEntryDto {
  @IsString()
  pharmacyStoreId!: string;

  @IsString()
  drugMasterId!: string;

  @IsIn(TX_TYPES)
  transactionType!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000000001)
  quantity!: number;

  @IsOptional()
  @IsString()
  batchNumber?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  balanceBefore!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  balanceAfter!: number;

  @IsOptional()
  @IsString()
  witnessName?: string | null;

  @IsOptional()
  @IsString()
  witnessSignature?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
