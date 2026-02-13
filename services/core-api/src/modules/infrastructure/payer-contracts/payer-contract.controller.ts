import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { CreatePayerContractDto, UpdatePayerContractDto, UpsertContractRateDto } from "./dto";
import { PayerContractService } from "./payer-contract.service";

@ApiTags("infrastructure/payer-contracts")
@Controller(["infrastructure", "infra"])
export class PayerContractController {
  constructor(private readonly svc: PayerContractService) {}

  private principal(req: any) {
    return req.principal;
  }

  // ── Contract CRUD ──

  @Post("payer-contracts")
  @Permissions(PERM.INFRA_PAYER_CONTRACT_CREATE)
  async createContract(
    @Req() req: any,
    @Body() dto: CreatePayerContractDto,
    @Query("branchId") branchId?: string,
  ) {
    return this.svc.createContract(this.principal(req), dto, branchId ?? null);
  }

  @Get("payer-contracts")
  @Permissions(PERM.INFRA_PAYER_CONTRACT_READ)
  async listContracts(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("q") q?: string,
    @Query("payerId") payerId?: string,
    @Query("status") status?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("take") take?: string,
  ) {
    return this.svc.listContracts(this.principal(req), {
      branchId: branchId ?? null,
      q,
      payerId,
      status,
      includeInactive: includeInactive === "true",
      take: take ? Number(take) : undefined,
    });
  }

  @Get("payer-contracts/:id")
  @Permissions(PERM.INFRA_PAYER_CONTRACT_READ)
  async getContract(@Req() req: any, @Param("id") id: string) {
    return this.svc.getContract(this.principal(req), id);
  }

  @Patch("payer-contracts/:id")
  @Permissions(PERM.INFRA_PAYER_CONTRACT_UPDATE)
  async updateContract(@Req() req: any, @Param("id") id: string, @Body() dto: UpdatePayerContractDto) {
    return this.svc.updateContract(this.principal(req), id, dto);
  }

  @Delete("payer-contracts/:id")
  @Permissions(PERM.INFRA_PAYER_CONTRACT_UPDATE)
  async deactivateContract(@Req() req: any, @Param("id") id: string) {
    return this.svc.deactivateContract(this.principal(req), id);
  }

  // ── Contract Rates (nested) ──

  @Post("payer-contracts/:id/rates")
  @Permissions(PERM.INFRA_PAYER_CONTRACT_CREATE)
  async addRate(@Req() req: any, @Param("id") id: string, @Body() dto: UpsertContractRateDto) {
    return this.svc.addContractRate(this.principal(req), id, dto);
  }

  @Get("payer-contracts/:id/rates")
  @Permissions(PERM.INFRA_PAYER_CONTRACT_READ)
  async listRates(@Req() req: any, @Param("id") id: string) {
    return this.svc.listContractRates(this.principal(req), id);
  }

  @Patch("payer-contracts/:id/rates/:rateId")
  @Permissions(PERM.INFRA_PAYER_CONTRACT_UPDATE)
  async updateRate(
    @Req() req: any,
    @Param("id") id: string,
    @Param("rateId") rateId: string,
    @Body() dto: UpsertContractRateDto,
  ) {
    return this.svc.updateContractRate(this.principal(req), id, rateId, dto);
  }

  @Delete("payer-contracts/:id/rates/:rateId")
  @Permissions(PERM.INFRA_PAYER_CONTRACT_UPDATE)
  async deleteRate(@Req() req: any, @Param("id") id: string, @Param("rateId") rateId: string) {
    return this.svc.deleteContractRate(this.principal(req), id, rateId);
  }
}
