import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) name!: string;

  // Assign by template code (SUPER_ADMIN / BRANCH_ADMIN / IT_ADMIN)
  @IsString() roleCode!: string;

  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() staffId?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() roleCode?: string;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() staffId?: string | null;
}
