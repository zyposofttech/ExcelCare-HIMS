import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { PrismaClient } from "@zypocare/db";
import type { Principal } from "./diagnostics.principal";
import { assertCode, assertName, resolveBranchId } from "./diagnostics.util";
import type { ApplyTemplateDto, ListTemplatesQuery } from "./dto";

type TemplateDef = {
  code: string;
  name: string;
  servicePoints: Array<{
    code: string;
    name: string;
    type:
      | "LAB"
      | "RADIOLOGY"
      | "CARDIO_DIAGNOSTICS"
      | "NEURO_DIAGNOSTICS"
      | "PULMONARY_DIAGNOSTICS"
      | "ENDOSCOPY"
      | "OTHER";
    // required placement: locationNodeId supplied in request
  }>;
};

const TEMPLATES: TemplateDef[] = [
  {
    code: "BASIC_DIAGNOSTICS_V1",
    name: "Basic Lab + Radiology setup",
    servicePoints: [
      { code: "LAB", name: "Central Laboratory", type: "LAB" },
      { code: "RAD", name: "Radiology Department", type: "RADIOLOGY" },
    ],
  },
];

@Injectable()
export class DiagnosticsTemplatesService {
  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  async listTemplates(principal: Principal, q: ListTemplatesQuery) {
    // branch is still mandatory: template can be filtered/validated by branch facilities later
    resolveBranchId(principal, q.branchId);

    return TEMPLATES.map((t) => ({
      code: t.code,
      name: t.name,
      servicePoints: t.servicePoints.map((sp) => ({
        code: sp.code,
        name: sp.name,
        type: sp.type,
        requiresPlacement: true,
      })),
    }));
  }

  async applyTemplate(principal: Principal, dto: ApplyTemplateDto) {
    const branchId = resolveBranchId(principal, dto.branchId);

    const template = TEMPLATES.find((t) => t.code === dto.templateCode);
    if (!template) throw new BadRequestException("Invalid templateCode");

    // Build placement map
    const placementMap = new Map<string, string>();
    for (const p of dto.placements ?? []) placementMap.set(String(p.servicePointCode).toUpperCase(), p.locationNodeId);

    // Validate placements for all service points
    for (const sp of template.servicePoints) {
      const locId = placementMap.get(sp.code);
      if (!locId) {
        throw new BadRequestException(`Missing placement for servicePointCode=${sp.code}`);
      }
      const node = await this.prisma.locationNode.findFirst({
        where: { id: locId, branchId },
        select: { id: true },
      });
      if (!node) throw new BadRequestException(`Invalid locationNodeId for ${sp.code}`);
    }

    // Create/update service points in a transaction
    const created = await this.prisma.$transaction(async (tx) => {
      const results: any[] = [];

      for (const sp of template.servicePoints) {
        const locId = placementMap.get(sp.code)!;

        const code = assertCode(sp.code, "Service point");
        const name = assertName(sp.name, "Service point");

        const row = await tx.diagnosticServicePoint.upsert({
          where: { branchId_code: { branchId, code } },
          create: {
            branchId,
            code,
            name,
            type: sp.type,
            locationNodeId: locId,
            sortOrder: 0,
            isActive: true,
          },
          update: {
            name,
            type: sp.type,
            locationNodeId: locId,
            isActive: true,
          },
        });

        results.push(row);
      }

      // Optional: seed minimal catalog (sections/categories) later.
      // Intentionally no pricing / no charge mapping.
      if (dto.seedCatalog) {
        // Minimal starter sections (branch scoped)
        await tx.diagnosticSection.upsert({
          where: { branchId_code: { branchId, code: "LAB" } },
          create: { branchId, code: "LAB", name: "Laboratory", sortOrder: 10 },
          update: { isActive: true },
        });
        await tx.diagnosticSection.upsert({
          where: { branchId_code: { branchId, code: "RADIOLOGY" } },
          create: { branchId, code: "RADIOLOGY", name: "Radiology", sortOrder: 20 },
          update: { isActive: true },
        });
      }

      return results;
    });

    return {
      templateCode: template.code,
      branchId,
      createdOrUpdatedServicePoints: created,
    };
  }
}
