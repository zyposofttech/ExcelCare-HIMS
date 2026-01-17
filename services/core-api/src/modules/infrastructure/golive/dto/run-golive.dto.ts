import { IsBoolean, IsOptional } from "class-validator";

export class RunGoLiveDto {
  @IsOptional()
  @IsBoolean()
  persist?: boolean; // default true
}
