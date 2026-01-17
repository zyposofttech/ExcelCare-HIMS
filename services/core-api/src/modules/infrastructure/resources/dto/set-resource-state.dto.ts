import { IsIn } from "class-validator";

export class SetResourceStateDto {
  @IsIn(["AVAILABLE", "OCCUPIED", "CLEANING", "MAINTENANCE", "INACTIVE"])
  state!: "AVAILABLE" | "OCCUPIED" | "CLEANING" | "MAINTENANCE" | "INACTIVE";
}
