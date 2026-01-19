import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";

export class ListSpecimensQuery {
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsBoolean() includeInactive?: boolean;
  @IsOptional() @IsString() q?: string;
}

export class CreateSpecimenDto {
  @IsOptional() @IsString() branchId?: string;

  @IsString() @MaxLength(32) code!: string;
  @IsString() @MaxLength(200) name!: string;

  @IsOptional() @IsString() container?: string;
  @IsOptional() @IsString() minVolume?: string;
  @IsOptional() @IsString() handlingNotes?: string;

  @IsOptional() @IsNumber() sortOrder?: number;
}

export class UpdateSpecimenDto {
  @IsOptional() @IsString() branchId?: string;

  @IsOptional() @IsString() @MaxLength(32) code?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;

  @IsOptional() @IsString() container?: string | null;
  @IsOptional() @IsString() minVolume?: string | null;
  @IsOptional() @IsString() handlingNotes?: string | null;

  @IsOptional() @IsNumber() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
