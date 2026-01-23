import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";

// NOTE: Add your auth guards / permissions here to match your project.
// Example:
// @UseGuards(AuthGuard)
// @Permissions(PERM.INFRA_DIAGNOSTICS_READ)

import { DiagnosticsConfigService } from "./diagnostics-config.service";
import type { Principal } from "./diagnostics.principal";
import {
  CreateSectionDto,
  UpdateSectionDto,
  ListSectionsQuery,
  CreateCategoryDto,
  UpdateCategoryDto,
  ListCategoriesQuery,
  CreateSpecimenDto,
  UpdateSpecimenDto,
  ListSpecimensQuery,
  CreateDiagnosticItemDto,
  UpdateDiagnosticItemDto,
  ListItemsQuery,
  ReplacePanelItemsDto,
  CreateParameterDto,
  UpdateParameterDto,
  CreateReferenceRangeDto,
  UpdateReferenceRangeDto,
  CreateTemplateDto,
  UpdateTemplateDto,
} from "./dto";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("infrastructure/diagnostics")
@Controller("infrastructure/diagnostics")
export class DiagnosticsConfigController {
  constructor(private readonly svc: DiagnosticsConfigService) {}

  private principalFrom(req: any): Principal {
    // Adjust to your auth pipeline. Common: req.user
    return (req?.user ?? req?.principal ?? {}) as Principal;
  }

  // ---------------------- Sections ----------------------
  @Get("sections")
  listSections(@Req() req: any, @Query() q: ListSectionsQuery) {
    return this.svc.listSections(this.principalFrom(req), q);
  }

  @Post("sections")
  createSection(@Req() req: any, @Body() dto: CreateSectionDto) {
    return this.svc.createSection(this.principalFrom(req), dto);
  }

  @Put("sections/:id")
  updateSection(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateSectionDto) {
    return this.svc.updateSection(this.principalFrom(req), id, dto);
  }

  @Delete("sections/:id")
  deleteSection(@Req() req: any, @Param("id") id: string) {
    return this.svc.deleteSection(this.principalFrom(req), id);
  }

  // ---------------------- Categories ----------------------
  @Get("categories")
  listCategories(@Req() req: any, @Query() q: ListCategoriesQuery) {
    return this.svc.listCategories(this.principalFrom(req), q);
  }

  @Post("categories")
  createCategory(@Req() req: any, @Body() dto: CreateCategoryDto) {
    return this.svc.createCategory(this.principalFrom(req), dto);
  }

  @Put("categories/:id")
  updateCategory(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.svc.updateCategory(this.principalFrom(req), id, dto);
  }

  @Delete("categories/:id")
  deleteCategory(@Req() req: any, @Param("id") id: string) {
    return this.svc.deleteCategory(this.principalFrom(req), id);
  }

  // ---------------------- Specimens ----------------------
  @Get("specimens")
  listSpecimens(@Req() req: any, @Query() q: ListSpecimensQuery) {
    return this.svc.listSpecimens(this.principalFrom(req), q);
  }

  @Post("specimens")
  createSpecimen(@Req() req: any, @Body() dto: CreateSpecimenDto) {
    return this.svc.createSpecimen(this.principalFrom(req), dto);
  }

  @Put("specimens/:id")
  updateSpecimen(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateSpecimenDto) {
    return this.svc.updateSpecimen(this.principalFrom(req), id, dto);
  }

  @Delete("specimens/:id")
  deleteSpecimen(@Req() req: any, @Param("id") id: string) {
    return this.svc.deleteSpecimen(this.principalFrom(req), id);
  }

  // ---------------------- Items ----------------------
  @Get("items")
  listItems(@Req() req: any, @Query() q: ListItemsQuery) {
    return this.svc.listItems(this.principalFrom(req), q);
  }

  @Post("items")
  createItem(@Req() req: any, @Body() dto: CreateDiagnosticItemDto) {
    return this.svc.createItem(this.principalFrom(req), dto);
  }

  @Put("items/:id")
  updateItem(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateDiagnosticItemDto) {
    return this.svc.updateItem(this.principalFrom(req), id, dto);
  }

  @Delete("items/:id")
  deleteItem(@Req() req: any, @Param("id") id: string) {
    return this.svc.deleteItem(this.principalFrom(req), id);
  }

  // ---------------------- Panels ----------------------
  @Get("items/:id/panel-items")
  getPanelItems(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.getPanelItems(this.principalFrom(req), id, branchId);
  }

  @Put("items/:id/panel-items")
  replacePanelItems(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: ReplacePanelItemsDto) {
    return this.svc.replacePanelItems(this.principalFrom(req), id, branchId, dto);
  }

  // ---------------------- Parameters (Lab) ----------------------
  @Get("items/:id/parameters")
  listParameters(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Query("includeInactive") includeInactive?: string) {
    return this.svc.listParameters(this.principalFrom(req), id, branchId, includeInactive === "true");
  }

  @Post("items/:id/parameters")
  createParameter(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: CreateParameterDto) {
    return this.svc.createParameter(this.principalFrom(req), id, dto, branchId);
  }

  @Put("parameters/:id")
  updateParameter(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateParameterDto) {
    return this.svc.updateParameter(this.principalFrom(req), id, dto);
  }

  @Delete("parameters/:id")
  deleteParameter(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.deleteParameter(this.principalFrom(req), id, branchId);
  }

  // ---------------------- Reference ranges ----------------------
  @Get("parameters/:id/ranges")
  listRanges(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Query("includeInactive") includeInactive?: string) {
    return this.svc.listRanges(this.principalFrom(req), id, branchId, includeInactive === "true");
  }

  @Post("parameters/:id/ranges")
  createRange(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: CreateReferenceRangeDto) {
    return this.svc.createRange(this.principalFrom(req), id, dto, branchId);
  }

  @Put("ranges/:id")
  updateRange(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateReferenceRangeDto) {
    return this.svc.updateRange(this.principalFrom(req), id, dto);
  }

  @Delete("ranges/:id")
  deleteRange(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string) {
    return this.svc.deleteRange(this.principalFrom(req), id, branchId);
  }

  // ---------------------- Templates (Imaging) ----------------------
  @Get("items/:id/templates")
  listTemplates(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Query("includeInactive") includeInactive?: string) {
    return this.svc.listTemplates(this.principalFrom(req), id, branchId, includeInactive === "true");
  }

  @Post("items/:id/templates")
  createTemplate(@Req() req: any, @Param("id") id: string, @Query("branchId") branchId: string, @Body() dto: CreateTemplateDto) {
    return this.svc.createTemplate(this.principalFrom(req), id, dto, branchId);
  }

  @Put("templates/:id")
  updateTemplate(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateTemplateDto) {
    return this.svc.updateTemplate(this.principalFrom(req), id, dto);
  }

  @Delete("templates/:id")
  deleteTemplate(@Req() req: any, @Param("id") id: string) {
    return this.svc.deleteTemplate(this.principalFrom(req), id);
  }

}
