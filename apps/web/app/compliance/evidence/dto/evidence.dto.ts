import { IsArray, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UploadEvidenceDto {
  @IsString()
  workspaceId!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  expiresAt?: string;
}

export class UpdateEvidenceDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  expiresAt?: string;

  @IsIn(["ACTIVE", "ARCHIVED"])
  @IsOptional()
  status?: "ACTIVE" | "ARCHIVED";
}

export class LinkEvidenceDto {
  /**
   * UI v1 links evidence primarily to a workspace.
   * Provide either workspaceId OR (targetType + targetId).
   */
  @IsString()
  @IsOptional()
  workspaceId?: string;

  @IsString()
  @IsOptional()
  targetType?: string;

  @IsString()
  @IsOptional()
  targetId?: string;
}
