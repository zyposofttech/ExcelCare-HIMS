import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDocumentRuleDto {
  @IsString()
  docRole!: string;

  @IsString()
  @MaxLength(160)
  label!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  requiredAt?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
