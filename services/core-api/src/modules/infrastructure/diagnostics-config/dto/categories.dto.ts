import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class ListCategoriesQuery {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsUUID() sectionId?: string;
  @IsOptional() @IsBoolean() includeInactive?: boolean;
  @IsOptional() @IsString() q?: string;
}

export class CreateCategoryDto {
  @IsOptional() @IsString() branchId?: string;

  @IsUUID() sectionId!: string;
  @IsString() @MaxLength(32) code!: string;
  @IsString() @MaxLength(200) name!: string;

  @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() branchId?: string;

  @IsOptional() @IsUUID() sectionId?: string;
  @IsOptional() @IsString() @MaxLength(32) code?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;

  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
