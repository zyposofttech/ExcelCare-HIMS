import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class ListSectionsQuery {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsBoolean() includeInactive?: boolean;
  @IsOptional() @IsString() q?: string;
}

export class CreateSectionDto {
  @IsOptional() @IsString() branchId?: string;
  @IsString() @MaxLength(32) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateSectionDto {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() @MaxLength(32) code?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
