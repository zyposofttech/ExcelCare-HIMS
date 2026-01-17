import { IsBoolean, IsOptional, IsString, MaxLength, Matches } from "class-validator";
import { Transform } from "class-transformer";

const ROOM_CODE_REGEX = /^[A-Z0-9](?:[A-Z0-9]|-(?=[A-Z0-9])){0,31}$/;

export class UpdateUnitRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsString()
  @Transform(({ value }) => String(value ?? "").trim().toUpperCase())
  @MaxLength(32)
  @Matches(ROOM_CODE_REGEX, {
    message: "Invalid Room code. Use 1–32 chars: A–Z, 0–9, optional hyphen (e.g., TH01, OT-1, LAB1, 101).",
  })
  code!: string;
}
