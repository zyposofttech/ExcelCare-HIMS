import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";
import { PERMISSIONS, normalizePermCode } from "./permission-catalog";

@Injectable()
export class RbacSyncService implements OnModuleInit {
  private readonly logger = new Logger(RbacSyncService.name);

  constructor(@Inject("PRISMA") private prisma: PrismaClient) {}

  async onModuleInit() {
    // Default ON (enterprise-safe: idempotent upsert)
    if (process.env.RBAC_SYNC_ON_BOOT === "false") return;
    await this.syncPermissions();
  }

  async syncPermissions(): Promise<{ created: number; updated: number; total: number }> {
    const items = PERMISSIONS.map((x) => ({
      code: normalizePermCode(x.code),
      name: x.name,
      category: x.category,
      description: x.description ?? null,
    }));

    let created = 0;
    let updated = 0;

    const forceMetadata = process.env.RBAC_SYNC_FORCE_METADATA === "true";

    for (const perm of items) {
      const existing = await this.prisma.permission.findUnique({
        where: { code: perm.code },
        select: { id: true, name: true, category: true, description: true },
      });

      if (!existing) {
        await this.prisma.permission.create({
          data: {
            code: perm.code,
            name: perm.name,
            category: perm.category,
            description: perm.description,
          },
        });
        created++;
        continue;
      }

      // Default behavior: do not override existing metadata unless:
      // - existing is blank/null, OR
      // - RBAC_SYNC_FORCE_METADATA=true
      const nextName = forceMetadata || !existing.name ? perm.name : existing.name;
      const nextCategory = forceMetadata || !existing.category ? perm.category : existing.category;
      const nextDescription =
        forceMetadata || existing.description == null ? perm.description : existing.description;

      const needsUpdate =
        existing.name !== nextName ||
        existing.category !== nextCategory ||
        (existing.description ?? null) !== (nextDescription ?? null);

      if (needsUpdate) {
        await this.prisma.permission.update({
          where: { code: perm.code },
          data: {
            name: nextName,
            category: nextCategory,
            description: nextDescription,
          },
        });
        updated++;
      }
    }

    const result = { created, updated, total: items.length };

    this.logger.log(
      `RBAC Permission Catalog sync complete: created=${result.created}, updated=${result.updated}, total=${result.total}`,
    );

    return result;
  }
}
