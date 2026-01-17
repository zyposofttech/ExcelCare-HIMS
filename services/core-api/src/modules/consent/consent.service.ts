import { Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";
import { AuditService } from "../audit/audit.service";

type GrantConsentDto = {
  patientId: string;
  scope: "VIEW" | "STORE" | "SHARE";
  purpose: string;
};

type RtbfRequestDto = {
  patientId: string;
  reason: string;
};

@Injectable()
export class ConsentService {
  constructor(
    @Inject("PRISMA") private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async list(patientId: string) {
    return this.prisma.consentRecord.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });
  }

 // ✅ add actorUserId param
async grant(dto: GrantConsentDto, actorUserId: string | null) {
  const rec = await this.prisma.consentRecord.create({
    data: {
      patientId: dto.patientId,
      scope: dto.scope as any,
      purpose: dto.purpose,
      status: "GRANTED" as any,
    },
  });

  await this.audit.log({
    actorUserId, // ✅ add
    action: "CONSENT_GRANT",
    entity: "ConsentRecord",
    entityId: rec.id,
    meta: { patientId: dto.patientId, scope: dto.scope, purpose: dto.purpose },
  });

  return rec;
}

async rtbf(dto: RtbfRequestDto, actorUserId: string | null) {
  const req = await this.prisma.rtbfRequest.create({
    data: {
      patientId: dto.patientId,
      reason: dto.reason,
    },
  });

  await this.audit.log({
    actorUserId, // ✅ add
    action: "RTBF_REQUEST",
    entity: "RtbfRequest",
    entityId: req.id,
    meta: { patientId: dto.patientId, reason: dto.reason },
  });

  return req;
}

}
