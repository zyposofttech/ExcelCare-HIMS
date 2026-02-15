import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreateDrugDto, UpdateDrugDto } from "./dto";
import { DrugMasterService } from "./drug-master.service";

@ApiTags("infrastructure/pharmacy/drugs")
@Controller(["infrastructure/pharmacy", "infra/pharmacy"])
export class DrugMasterController {
  constructor(private readonly svc: DrugMasterService) {}

  private principal(req: any) {
    return req.principal;
  }

  @Get("drugs")
  @Permissions(PERM.INFRA_PHARMACY_DRUG_READ)
  async listDrugs(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("q") q?: string,
    @Query("category") category?: string,
    @Query("route") route?: string,
    @Query("scheduleClass") scheduleClass?: string,
    @Query("formularyStatus") formularyStatus?: string,
    @Query("status") status?: string,
    @Query("isNarcotic") isNarcotic?: string,
    @Query("isHighAlert") isHighAlert?: string,
    @Query("isLasa") isLasa?: string,
    @Query("isAntibiotic") isAntibiotic?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.svc.listDrugs(this.principal(req), {
      branchId,
      q,
      category,
      route,
      scheduleClass,
      formularyStatus,
      status,
      isNarcotic: isNarcotic === "true" ? true : undefined,
      isHighAlert: isHighAlert === "true" ? true : undefined,
      isLasa: isLasa === "true" ? true : undefined,
      isAntibiotic: isAntibiotic === "true" ? true : undefined,
      page,
      pageSize,
    });
  }

  @Get("drugs/summary")
  @Permissions(PERM.INFRA_PHARMACY_DRUG_READ)
  async drugSummary(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.svc.drugSummary(this.principal(req), branchId);
  }

  @Get("drugs/:id")
  @Permissions(PERM.INFRA_PHARMACY_DRUG_READ)
  async getDrug(@Req() req: any, @Param("id") id: string) {
    return this.svc.getDrug(this.principal(req), id);
  }

  @Post("drugs")
  @Permissions(PERM.INFRA_PHARMACY_DRUG_CREATE)
  async createDrug(@Req() req: any, @Body() dto: CreateDrugDto, @Query("branchId") branchId?: string) {
    return this.svc.createDrug(this.principal(req), dto, branchId ?? null);
  }

  @Patch("drugs/:id")
  @Permissions(PERM.INFRA_PHARMACY_DRUG_UPDATE)
  async updateDrug(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateDrugDto) {
    return this.svc.updateDrug(this.principal(req), id, dto);
  }

  // Legacy JSON bulk import support
  @Post("drugs/bulk-import")
  @Permissions(PERM.INFRA_PHARMACY_DRUG_CREATE)
  async bulkImportDrugs(@Req() req: any, @Body() body: { rows: any[] }, @Query("branchId") branchId?: string) {
    return this.svc.bulkImportDrugs(this.principal(req), body.rows ?? [], branchId ?? null);
  }

  // Template download (xlsx/csv)
  @Get("drugs/template")
  @Permissions(PERM.INFRA_PHARMACY_DRUG_READ)
  async downloadTemplate(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query("format") format?: string,
  ) {
    // req used for auth guard pipeline, keep it
    const file = await this.svc.getDrugTemplate(format);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    return new StreamableFile(file.buffer);
  }

  // File import (xlsx/csv)
  @Post("drugs/import-file")
  @Permissions(PERM.INFRA_PHARMACY_DRUG_CREATE)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    }),
  )
  async importFile(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Query("branchId") branchId?: string,
    @Query("dryRun") dryRun?: string,
    @Query("mode") mode?: "CREATE_ONLY" | "UPSERT",
  ) {
    return this.svc.importDrugsFromFile(this.principal(req), file, {
      branchId: branchId ?? null,
      dryRun: dryRun === "true",
      mode: mode ?? "CREATE_ONLY",
    });
  }

  // Seed standard DB (sample now; you can replace/extend dataset later)
  @Post("drugs/seed")
  @Permissions(PERM.INFRA_PHARMACY_DRUG_CREATE)
  async seed(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Body() body?: { dryRun?: boolean; mode?: "CREATE_ONLY" | "UPSERT"; limit?: number },
  ) {
    return this.svc.seedStandardDrugDb(this.principal(req), {
      branchId: branchId ?? null,
      dryRun: body?.dryRun ?? false,
      mode: body?.mode ?? "UPSERT",
      limit: body?.limit ?? undefined,
    });
  }

  // Auto-suggest generic names (used by manual entry UI)
  @Get("drugs/suggest")
  @Permissions(PERM.INFRA_PHARMACY_DRUG_READ)
  async suggest(@Req() req: any, @Query("branchId") branchId?: string, @Query("term") term?: string) {
    return this.svc.suggestGenericNames(this.principal(req), term ?? "", branchId ?? null);
  }

  // Real-time duplicate check (used by manual entry UI)
  @Post("drugs/duplicate-check")
  @Permissions(PERM.INFRA_PHARMACY_DRUG_READ)
  async duplicateCheck(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Body()
    body?: { drugCode?: string; genericName?: string; strength?: string | null; dosageForm?: string | null; route?: string | null },
  ) {
    return this.svc.duplicateCheck(this.principal(req), body ?? {}, branchId ?? null);
  }
}
