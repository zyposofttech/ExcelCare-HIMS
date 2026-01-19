import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Length, Matches } from "class-validator";

export class UpdateUnitRoomDto {
  @IsOptional()
  @Transform(({ value }) => String(value ?? "").trim().toUpperCase())
  @IsString()
  @Length(2, 32, { message: "Room code must be between 2 and 32 characters." })
  @Matches(/^[A-Z0-9][A-Z0-9_-]*$/, {
    message: "Room code can contain only A–Z, 0–9, underscore (_) and hyphen (-), and must start with A–Z/0–9.",
  })
  code?: string;

  @IsOptional()
  @Transform(({ value }) => String(value ?? "").trim())
  @IsString()
  @Length(2, 120, { message: "Room name must be between 2 and 120 characters." })
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
