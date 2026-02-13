import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpsertPackageComponentDto {
  @IsString()
  serviceItemId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number | null;

  @IsOptional()
  @IsBoolean()
  isIncluded?: boolean;

  @IsOptional()
  rules?: any;
}
