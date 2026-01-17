import { PartialType } from "@nestjs/swagger";
import { CreateEquipmentAssetDto } from "./create-equipment-asset.dto";

export class UpdateEquipmentAssetDto extends PartialType(CreateEquipmentAssetDto) {}
