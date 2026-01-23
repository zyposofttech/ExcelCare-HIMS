import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class ListTemplatesQuery {
  @IsString()
  @IsNotEmpty()
  branchId!: string;
}

export class TemplatePlacementDto {
  @IsString()
  @IsNotEmpty()
  servicePointCode!: string; // e.g. LAB, RAD

  @IsString()
  @IsNotEmpty()
  locationNodeId!: string;
}

export class ApplyTemplateDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  templateCode!: string; // BASIC_DIAGNOSTICS_V1

  @ValidateNested({ each: true })
  @Type(() => TemplatePlacementDto)
  placements!: TemplatePlacementDto[];

  // Optional: also seed minimal catalog (sections/categories) – no pricing, no charges
  @IsOptional()
  @IsBoolean()
  seedCatalog?: boolean;
}
