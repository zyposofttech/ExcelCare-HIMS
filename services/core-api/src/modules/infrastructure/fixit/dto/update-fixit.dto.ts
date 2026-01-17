import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateFixItDto {
  @IsIn(["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"])
  status!: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

  @IsOptional()
  @IsString()
  assignedToUserId?: string | null;
}
