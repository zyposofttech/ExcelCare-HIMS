import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Principal } from "../../auth/access-policy.service";
import { InfraContextService } from "../shared/infra-context.service";
import type { ValidateImportDto } from "./dto";
import { assertLocationCode, assertUnitCode, canonicalizeCode } from "../../../common/naming.util";

@Injectable()
export class ImportService {
  constructor(private readonly ctx: InfraContextService) {}

  async validateImport(principal: Principal, dto: ValidateImportDto, branchIdParam?: string | null) {
    const branchId = this.ctx.resolveBranchId(principal, branchIdParam ?? null);

    const rows = Array.isArray(dto.rows) ? dto.rows : [];
    if (!rows.length) throw new BadRequestException("No rows provided");

    const errors: Array<{ row: number; field?: string; message: string }> = [];

    if (dto.entityType === "LOCATIONS") {
      rows.forEach((r, idx) => {
        try {
          if (!r.kind || !r.code || !r.name) throw new Error("kind, code, name required");
          assertLocationCode(r.kind, canonicalizeCode(r.code), r.parentCode ? canonicalizeCode(r.parentCode) : undefined);
        } catch (e: any) {
          errors.push({ row: idx + 1, message: e?.message ?? "Invalid row" });
        }
      });
    }

    if (dto.entityType === "UNITS") {
      rows.forEach((r, idx) => {
        try {
          if (!r.departmentId || !r.unitTypeId || !r.code || !r.name) {
            throw new Error("departmentId, unitTypeId, code, name required");
          }
          assertUnitCode(r.code);
        } catch (e: any) {
          errors.push({ row: idx + 1, message: e?.message ?? "Invalid row" });
        }
      });
    }

    const validRows = rows.length - errors.length;

    const job = await this.ctx.prisma.bulkImportJob.create({
      data: {
        branchId,
        entityType: dto.entityType,
        status: "VALIDATED" as any,
        fileName: dto.fileName ?? null,
        payload: rows,
        errors,
        totalRows: rows.length,
        validRows,
        invalidRows: errors.length,
        createdByUserId: principal.userId,
      },
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_IMPORT_VALIDATE",
      entity: "BulkImportJob",
      entityId: job.id,
      meta: { entityType: dto.entityType, totalRows: rows.length, errors: errors.length },
    });

    return { jobId: job.id, totalRows: rows.length, validRows, invalidRows: errors.length, errors };
  }

  async commitImport(principal: Principal, jobId: string) {
    const job = await this.ctx.prisma.bulkImportJob.findUnique({
      where: { id: jobId },
      select: { id: true, branchId: true, status: true, entityType: true, payload: true, errors: true },
    });

    if (!job) throw new NotFoundException("Import job not found");

    const branchId = this.ctx.resolveBranchId(principal, job.branchId);

    if (job.status !== ("VALIDATED" as any)) {
      throw new BadRequestException("Import job must be VALIDATED before COMMIT");
    }

    const rows = (job.payload as any[]) || [];
    const errors = (job.errors as any[]) || [];
    if (errors.length) throw new BadRequestException("Fix validation errors before committing");

    const entityType = job.entityType as any;

    await this.ctx.prisma.$transaction(async (tx) => {
      if (entityType === "UNITS") {
        for (const r of rows) {
          await tx.unit.create({
            data: {
              branchId,
              departmentId: r.departmentId,
              unitTypeId: r.unitTypeId,
              code: assertUnitCode(r.code),
              name: String(r.name).trim(),
              usesRooms: r.usesRooms ?? true,
              isActive: r.isActive ?? true,
            },
          });
        }
      } else if (entityType === "CHARGE_MASTER") {
        for (const r of rows) {
          await tx.chargeMasterItem.upsert({
            where: { branchId_code: { branchId, code: canonicalizeCode(r.code) } } as any,
            update: {
              name: String(r.name).trim(),
              category: r.category ?? null,
              unit: r.unit ?? null,
              isActive: r.isActive ?? true,
            },
            create: {
              branchId,
              code: canonicalizeCode(r.code),
              name: String(r.name).trim(),
              category: r.category ?? null,
              unit: r.unit ?? null,
              isActive: r.isActive ?? true,
            },
          });
        }
      } else {
        throw new BadRequestException(`Unsupported import entityType: ${entityType}`);
      }

      await tx.bulkImportJob.update({ where: { id: jobId }, data: { status: "COMMITTED" as any, committedAt: new Date() } });
    });

    await this.ctx.audit.log({
      branchId,
      actorUserId: principal.userId,
      action: "INFRA_IMPORT_COMMIT",
      entity: "BulkImportJob",
      entityId: jobId,
      meta: { jobId, entityType },
    });

    return { jobId, status: "COMMITTED" };
  }
}
