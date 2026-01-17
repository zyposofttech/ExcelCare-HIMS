import { IsString } from "class-validator";

export class CommitImportDto {
  @IsString()
  jobId!: string;
}
