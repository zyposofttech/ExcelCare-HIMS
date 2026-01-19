import { IsEnum, IsOptional, IsString, IsBoolean, MaxLength } from "class-validator";
import { DiagnosticTemplateKind } from "../diagnostics.types";

export class CreateTemplateDto {
  @IsOptional() @IsEnum(DiagnosticTemplateKind) kind?: DiagnosticTemplateKind;
  @IsString() @MaxLength(200) name!: string;
  @IsString() body!: string;
}

export class UpdateTemplateDto {
  @IsOptional() @IsEnum(DiagnosticTemplateKind) kind?: DiagnosticTemplateKind;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
