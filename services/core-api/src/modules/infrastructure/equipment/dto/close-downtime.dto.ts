import { IsOptional, IsString } from "class-validator";

export class CloseDowntimeDto {
  @IsString()
  ticketId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
