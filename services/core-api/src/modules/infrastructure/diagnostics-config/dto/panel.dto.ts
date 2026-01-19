import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class PanelItemInput {
  @IsString()
  itemId!: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class ReplacePanelItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PanelItemInput)
  items!: PanelItemInput[];
}
