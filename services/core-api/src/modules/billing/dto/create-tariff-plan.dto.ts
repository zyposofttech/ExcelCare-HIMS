import { IsBoolean, IsIn, IsOptional, IsString, Length } from "class-validator";

const TARIFF_PLAN_KINDS = ["PRICE_LIST", "PAYER_CONTRACT"] as const;
export type TariffPlanKind = (typeof TARIFF_PLAN_KINDS)[number];

export class CreateTariffPlanDto {
  /**
   * Required for GLOBAL principals (Super Admin).
   * Optional for BRANCH principals (Branch Admin) — will auto-resolve from principal.
   */
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  @Length(2, 48)
  code?: string;

  @IsString()
  @Length(2, 160)
  name!: string;

  @IsOptional()
  @IsIn(TARIFF_PLAN_KINDS as any)
  kind?: TariffPlanKind;

  /**
   * Only required when kind = PAYER_CONTRACT
   */
  @IsOptional()
  @IsString()
  payerId?: string;

  /**
   * Only required when kind = PAYER_CONTRACT
   */
  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsString()
  currency?: string; // default INR

  @IsOptional()
  @IsBoolean()
  isTaxInclusive?: boolean; // default false
}
