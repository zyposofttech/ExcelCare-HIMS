import { IsIn, IsOptional, IsString } from "class-validator";

export class RunValidatorDto {
  @IsString()
  workspaceId!: string;
}

export class ExportPackDto {
  @IsString()
  workspaceId!: string;

  @IsIn(["json", "csv"])
  @IsOptional()
  format?: "json" | "csv" = "json";
}
