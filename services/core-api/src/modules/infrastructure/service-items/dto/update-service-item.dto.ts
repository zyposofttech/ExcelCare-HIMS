import { PartialType } from "@nestjs/swagger";
import { CreateServiceItemDto } from "./create-service-item.dto";

export class UpdateServiceItemDto extends PartialType(CreateServiceItemDto) {}
