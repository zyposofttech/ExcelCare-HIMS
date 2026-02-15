import { IsIn, IsOptional, IsString, ValidateIf } from "class-validator";

const TTI_RESULTS = ["REACTIVE", "NON_REACTIVE", "INDETERMINATE", "PENDING"] as const;

export class RecordTTIDto {
  @ValidateIf((o) => !o.bloodUnitId) @IsOptional() @IsString() unitId?: string;
  @ValidateIf((o) => !o.unitId) @IsOptional() @IsString() bloodUnitId?: string;

  @IsString() testName!: string;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() kitLotNumber?: string;
  @IsOptional() @IsIn(TTI_RESULTS as any) result?: string;
}
