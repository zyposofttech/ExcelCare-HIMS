import { IsString } from "class-validator";

export class CancelProcedureBookingDto {
  @IsString()
  reason!: string;
}
