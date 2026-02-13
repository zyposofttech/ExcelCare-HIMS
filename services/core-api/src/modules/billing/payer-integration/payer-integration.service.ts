import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../../infrastructure/shared/infra-context.service";
import type { CreatePayerIntegrationDto, UpdatePayerIntegrationDto } from "./dto";

@Injectable()
export class PayerIntegrationService {
  constructor(private readonly ctx: InfraContextService) {}

  async create(principal: Principal, dto: CreatePayerIntegrationDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);

    // Validate payer exists in branch
    const payer = await this.ctx.prisma.payer.findFirst({
      where: { id: dto.payerId, branchId },
      select: { id: true },
    });
    if (!payer) throw new BadRequestException("Payer not found in this branch");

    // Check unique [branchId, payerId]
    const existing = await this.ctx.prisma.payerIntegrationConfig.findUnique({
      where: { branchId_payerId: { branchId, payerId: dto.payerId } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException("Integration config already exists for this payer in this branch");
    }

    const created = await this.ctx.prisma.payerIntegrationConfig.create({
      data: {
        branchId,
        payerId: dto.payerId,
        integrationMode: dto.integrationMode as any,

        // HCX / NHCX
        hcxParticipantCode: dto.hcxParticipantCode ?? null,
        hcxEndpointUrl: dto.hcxEndpointUrl ?? null,
        hcxAuthConfig: dto.hcxAuthConfig ?? undefined,

        // Direct API
        apiBaseUrl: dto.apiBaseUrl ?? null,
        apiAuthMethod: dto.apiAuthMethod ?? null,
        apiAuthConfig: dto.apiAuthConfig ?? undefined,

        // SFTP
        sftpHost: dto.sftpHost ?? null,
        sftpPort: dto.sftpPort ?? null,
        sftpPath: dto.sftpPath ?? null,
        sftpAuthConfig: dto.sftpAuthConfig ?? undefined,

        // Portal-assisted
        portalUrl: dto.portalUrl ?? null,
        portalNotes: dto.portalNotes ?? null,

        // Webhook
        webhookSecret: dto.webhookSecret ?? null,
        webhookUrl: dto.webhookUrl ?? null,

        // Retry config
        retryMaxAttempts: dto.retryMaxAttempts ?? 3,
        retryBackoffMs: dto.retryBackoffMs ?? 5000,
        pollingIntervalMs: dto.pollingIntervalMs ?? null,

        isActive: dto.isActive ?? true,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_INTEGRATION_CREATE",
      entity: "PayerIntegrationConfig",
      entityId: created.id,
      meta: { payerId: dto.payerId, integrationMode: dto.integrationMode },
    });

    return created;
  }

  async list(
    principal: Principal,
    filters: {
      branchId?: string | null;
      payerId?: string;
      integrationMode?: string;
      isActive?: boolean;
    },
  ) {
    const branchId = this.ctx.resolveBranchId(principal, filters.branchId ?? null);
    const where: any = { branchId };

    if (filters.payerId) where.payerId = filters.payerId;
    if (filters.integrationMode) where.integrationMode = filters.integrationMode;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    return this.ctx.prisma.payerIntegrationConfig.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: {
        payer: { select: { id: true, code: true, name: true, kind: true } },
      },
    });
  }

  async get(principal: Principal, id: string) {
    const row = await this.ctx.prisma.payerIntegrationConfig.findUnique({
      where: { id },
      include: {
        payer: { select: { id: true, code: true, name: true, kind: true } },
      },
    });
    if (!row) throw new NotFoundException("Payer integration config not found");

    this.ctx.resolveBranchId(principal, row.branchId);
    return row;
  }

  async update(principal: Principal, id: string, dto: UpdatePayerIntegrationDto) {
    const existing = await this.ctx.prisma.payerIntegrationConfig.findUnique({
      where: { id },
      select: { id: true, branchId: true },
    });
    if (!existing) throw new NotFoundException("Payer integration config not found");

    const branchId = this.ctx.resolveBranchId(principal, existing.branchId);

    const updated = await this.ctx.prisma.payerIntegrationConfig.update({
      where: { id },
      data: {
        payerId: dto.payerId ?? undefined,
        integrationMode: dto.integrationMode ? (dto.integrationMode as any) : undefined,

        // HCX / NHCX
        hcxParticipantCode:
          dto.hcxParticipantCode === undefined ? undefined : (dto.hcxParticipantCode ?? null),
        hcxEndpointUrl: dto.hcxEndpointUrl === undefined ? undefined : (dto.hcxEndpointUrl ?? null),
        hcxAuthConfig: dto.hcxAuthConfig === undefined ? undefined : (dto.hcxAuthConfig ?? undefined),

        // Direct API
        apiBaseUrl: dto.apiBaseUrl === undefined ? undefined : (dto.apiBaseUrl ?? null),
        apiAuthMethod: dto.apiAuthMethod === undefined ? undefined : (dto.apiAuthMethod ?? null),
        apiAuthConfig: dto.apiAuthConfig === undefined ? undefined : (dto.apiAuthConfig ?? undefined),

        // SFTP
        sftpHost: dto.sftpHost === undefined ? undefined : (dto.sftpHost ?? null),
        sftpPort: dto.sftpPort === undefined ? undefined : (dto.sftpPort ?? null),
        sftpPath: dto.sftpPath === undefined ? undefined : (dto.sftpPath ?? null),
        sftpAuthConfig: dto.sftpAuthConfig === undefined ? undefined : (dto.sftpAuthConfig ?? undefined),

        // Portal-assisted
        portalUrl: dto.portalUrl === undefined ? undefined : (dto.portalUrl ?? null),
        portalNotes: dto.portalNotes === undefined ? undefined : (dto.portalNotes ?? null),

        // Webhook
        webhookSecret: dto.webhookSecret === undefined ? undefined : (dto.webhookSecret ?? null),
        webhookUrl: dto.webhookUrl === undefined ? undefined : (dto.webhookUrl ?? null),

        // Retry config
        retryMaxAttempts: dto.retryMaxAttempts ?? undefined,
        retryBackoffMs: dto.retryBackoffMs ?? undefined,
        pollingIntervalMs: dto.pollingIntervalMs === undefined ? undefined : (dto.pollingIntervalMs ?? null),

        isActive: dto.isActive ?? undefined,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "BILLING_INTEGRATION_UPDATE",
      entity: "PayerIntegrationConfig",
      entityId: id,
      meta: dto,
    });

    return updated;
  }

  async testConnectivity(_principal: Principal, id: string) {
    const existing = await this.ctx.prisma.payerIntegrationConfig.findUnique({
      where: { id },
      select: { id: true, branchId: true, integrationMode: true },
    });
    if (!existing) throw new NotFoundException("Payer integration config not found");

    this.ctx.resolveBranchId(_principal, existing.branchId);

    // Stub: connectivity test not yet implemented
    return { success: true, message: "Connectivity test not yet implemented" };
  }
}
