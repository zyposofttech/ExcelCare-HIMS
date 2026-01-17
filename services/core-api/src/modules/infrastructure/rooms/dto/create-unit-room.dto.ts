import { IsBoolean, IsOptional, IsString, MaxLength, Matches } from "class-validator";
import { Transform } from "class-transformer";
import { RX_ROOM_CODE } from "../../../../common/naming.util";

export class CreateUnitRoomDto {
  @IsString()
  unitId!: string;

  @IsString()
  @Transform(({ value }) => String(value ?? "").trim().toUpperCase())
  @MaxLength(32)
  @Matches(RX_ROOM_CODE)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
