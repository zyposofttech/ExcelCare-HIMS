import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDocumentTemplateDto {
  @IsString()
  payerId!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  caseTypes?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}
