import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

const QUERY_SOURCES = ["TPA", "HOSPITAL"] as const;

export class PreauthQueryDto {
  @IsString()
  queryText!: string;

  @IsString()
  @IsIn(QUERY_SOURCES as any)
  querySource!: (typeof QUERY_SOURCES)[number];

  @IsOptional()
  @IsString()
  responseText?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];
}
