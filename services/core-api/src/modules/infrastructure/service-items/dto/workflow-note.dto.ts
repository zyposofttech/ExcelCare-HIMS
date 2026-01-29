import { IsOptional, IsString, MaxLength } from "class-validator";

export class WorkflowNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
