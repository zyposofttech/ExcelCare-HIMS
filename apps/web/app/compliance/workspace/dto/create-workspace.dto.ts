import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateWorkspaceDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsIn(["ORG_TEMPLATE", "BRANCH"])
  type!: "ORG_TEMPLATE" | "BRANCH";

  @IsString()
  @IsOptional()
  orgId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}

export class UpdateWorkspaceDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsIn(["DRAFT", "ACTIVE", "ARCHIVED"])
  @IsOptional()
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
}

export class CloneWorkspaceDto {
  @IsString()
  branchId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;
}
