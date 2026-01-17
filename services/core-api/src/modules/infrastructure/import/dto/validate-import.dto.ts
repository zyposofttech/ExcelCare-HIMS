import { IsIn, IsOptional, IsString } from "class-validator";

export class ValidateImportDto {
  @IsIn(["LOCATIONS", "UNITS", "ROOMS", "RESOURCES", "EQUIPMENT", "SERVICE_ITEMS", "CHARGE_MASTER"])
  entityType!: any;

  @IsOptional()
  @IsString()
  fileName?: string;

  // Raw rows from UI parser (CSV/XLS)
  rows!: any[];
}
