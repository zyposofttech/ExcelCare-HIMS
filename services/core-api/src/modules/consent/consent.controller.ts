// src/consent/consent.controller.ts
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";

import { ApiTags } from "@nestjs/swagger";
import { IsIn, IsString } from "class-validator";
import { Roles } from "../auth/roles.decorator";
import { ConsentService } from "./consent.service"; // Import the service

// ... keep your DTO classes ...
class GrantConsentDto {
  @IsString() patientId!: string;
  @IsIn(["VIEW", "STORE", "SHARE"]) scope!: "VIEW" | "STORE" | "SHARE";
  @IsString() purpose!: string;
}

class RtbfRequestDto {
  @IsString() patientId!: string;
  @IsString() reason!: string;
}

@ApiTags("consent")
@Controller("consent")
export class ConsentController {
  // Inject ONLY the ConsentService. 
  // No Prisma or Audit needed here anymore; the Service handles them.
  constructor(private readonly consentService: ConsentService) {}

  @Roles("SUPER_ADMIN", "BRANCH_ADMIN", "FRONT_OFFICE", "DOCTOR", "NURSE", "BILLING")
  @Get(":patientId")
  async list(@Param("patientId") patientId: string) {
    return this.consentService.list(patientId);
  }

    @Roles("SUPER_ADMIN", "BRANCH_ADMIN", "FRONT_OFFICE")
  @Post("grant")
  async grant(@Body() dto: GrantConsentDto, @Req() req: any) {
    const actorUserId = req?.principal?.userId ?? req?.user?.sub ?? null;
    return this.consentService.grant(dto, actorUserId);
  }

  @Roles("SUPER_ADMIN", "BRANCH_ADMIN")
  @Post("rtbf")
  async rtbf(@Body() dto: RtbfRequestDto, @Req() req: any) {
    const actorUserId = req?.principal?.userId ?? req?.user?.sub ?? null;
    return this.consentService.rtbf(dto, actorUserId);
  }

}