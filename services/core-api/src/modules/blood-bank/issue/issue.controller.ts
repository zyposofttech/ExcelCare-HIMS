import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permissions } from "../../auth/permissions.decorator";
import { PERM } from "../../iam/iam.constants";
import { IssueService } from "./issue.service";
import {
  IssueBloodDto, BedsideVerifyDto, StartTransfusionDto,
  RecordVitalsDto, EndTransfusionDto, ReportReactionDto,
  ReturnUnitDto, ActivateMTPDto,
  ReleaseMtpPackDto,
} from "./dto";

@ApiTags("blood-bank/issue")
@Controller("blood-bank")
export class IssueController {
  constructor(private readonly svc: IssueService) {}

  private principal(req: any) { return req.principal; }
  private truthy(v: unknown): boolean {
    if (typeof v === "boolean") return v;
    if (typeof v !== "string") return false;
    const s = v.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on";
  }
  private optionalNumber(v: unknown): number | undefined {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }

  @Get("issue")
  @Permissions(PERM.BB_ISSUE_READ)
  listIssues(
    @Req() req: any,
    @Query("branchId") branchId?: string,
    @Query("transfusing") transfusing?: string,
    @Query("transfused_today") transfusedToday?: string,
  ) {
    return this.svc.listIssues(this.principal(req), {
      branchId: branchId ?? null,
      transfusing: this.truthy(transfusing),
      transfusedToday: this.truthy(transfusedToday),
    });
  }

  @Post("issue")
  @Permissions(PERM.BB_ISSUE_CREATE)
  issue(@Req() req: any, @Body() dto: any) {
    const issuedTo = String(dto?.issuedToPerson ?? dto?.issuedTo ?? "").trim();
    const payload: IssueBloodDto = {
      crossMatchId: String(dto?.crossMatchId ?? "").trim(),
      issuedToPerson: issuedTo || undefined,
      issuedToWard: dto?.issuedToWard ? String(dto.issuedToWard) : undefined,
      transportBoxTemp: this.optionalNumber(dto?.transportBoxTemp ?? dto?.transportTemp),
      notes: dto?.notes ? String(dto.notes) : undefined,
    };
    return this.svc.issueBlood(this.principal(req), payload);
  }

  @Post("issue/:id/bedside-verify")
  @Permissions(PERM.BB_TRANSFUSION_CREATE)
  bedsideVerify(@Req() req: any, @Param("id") issueId: string, @Body() dto: BedsideVerifyDto) {
    return this.svc.bedsideVerify(this.principal(req), issueId, dto);
  }

  @Post("issue/:id/transfusion/start")
  @Permissions(PERM.BB_TRANSFUSION_CREATE)
  startTransfusion(@Req() req: any, @Param("id") issueId: string, @Body() dto: any) {
    const payload: StartTransfusionDto = {
      vitals: dto?.vitals ?? {},
      verifiedBy: dto?.verifiedBy ? String(dto.verifiedBy) : undefined,
      startNotes: dto?.startNotes ? String(dto.startNotes) : undefined,
    };
    return this.svc.startTransfusion(this.principal(req), issueId, payload);
  }

  @Post("issue/:id/transfusion/vitals")
  @Permissions(PERM.BB_TRANSFUSION_CREATE)
  recordVitals(@Req() req: any, @Param("id") issueId: string, @Body() dto: any) {
    const payload: RecordVitalsDto = {
      interval: dto?.interval ?? "AUTO",
      vitals: dto?.vitals,
      temperature: this.optionalNumber(dto?.temperature),
      pulseRate: this.optionalNumber(dto?.pulseRate),
      bloodPressure: dto?.bloodPressure ? String(dto.bloodPressure) : undefined,
      respiratoryRate: this.optionalNumber(dto?.respiratoryRate),
      notes: dto?.notes ? String(dto.notes) : undefined,
      volumeTransfused: this.optionalNumber(dto?.volumeTransfused),
    };
    return this.svc.recordVitals(this.principal(req), issueId, payload);
  }

  @Post("issue/:id/transfusion/end")
  @Permissions(PERM.BB_TRANSFUSION_CREATE)
  endTransfusion(@Req() req: any, @Param("id") issueId: string, @Body() dto: EndTransfusionDto) {
    return this.svc.endTransfusion(this.principal(req), issueId, dto);
  }

  @Post("issue/:id/reaction")
  @Permissions(PERM.BB_TRANSFUSION_REACTION)
  reaction(@Req() req: any, @Param("id") issueId: string, @Body() dto: ReportReactionDto) {
    return this.svc.reportReaction(this.principal(req), issueId, dto);
  }

  @Post("issue/:id/return")
  @Permissions(PERM.BB_ISSUE_RETURN)
  returnUnit(@Req() req: any, @Param("id") issueId: string, @Body() dto: ReturnUnitDto) {
    return this.svc.returnUnit(this.principal(req), issueId, dto);
  }

  @Get("issue/mtp")
  @Permissions(PERM.BB_MTP_READ)
  listMTP(@Req() req: any, @Query("branchId") branchId?: string) {
    return this.svc.listMtpSessions(this.principal(req), branchId ?? null);
  }

  @Post("mtp/activate")
  @Post("issue/mtp/activate")
  @Permissions(PERM.BB_MTP_ACTIVATE)
  activateMTP(@Req() req: any, @Body() dto: any) {
    const payload: ActivateMTPDto & { notes?: string } = {
      branchId: dto?.branchId ? String(dto.branchId) : undefined,
      patientId: String(dto?.patientId ?? "").trim(),
      encounterId: dto?.encounterId ? String(dto.encounterId) : undefined,
      clinicalIndication: dto?.clinicalIndication ?? dto?.indication ?? undefined,
      notes: dto?.notes ? String(dto.notes) : undefined,
    };
    return this.svc.activateMTP(this.principal(req), payload);
  }

  @Post("mtp/:id/deactivate")
  @Post("issue/mtp/:id/deactivate")
  @Permissions(PERM.BB_MTP_ACTIVATE)
  deactivateMTP(@Req() req: any, @Param("id") id: string) {
    return this.svc.deactivateMTP(this.principal(req), id);
  }

  @Get("mtp/:id")
  @Get("issue/mtp/:id")
  @Permissions(PERM.BB_MTP_READ)
  getMTP(@Req() req: any, @Param("id") id: string) {
    return this.svc.getMTP(this.principal(req), id);
  }

  @Post("mtp/:id/release-pack")
  @Post("issue/mtp/:id/release-pack")
  @Permissions(PERM.BB_MTP_ACTIVATE)
  releaseMtpPack(@Req() req: any, @Param("id") mtpId: string, @Body() dto: any) {
    const payload: ReleaseMtpPackDto = {
      branchId: dto?.branchId ? String(dto.branchId) : undefined,
      prbcUnits: this.optionalNumber(dto?.prbcUnits ?? dto?.prbc ?? dto?.rbcUnits),
      ffpUnits: this.optionalNumber(dto?.ffpUnits ?? dto?.ffp ?? dto?.plasmaUnits),
      plateletUnits: this.optionalNumber(dto?.plateletUnits ?? dto?.pltUnits ?? dto?.platelets),
      issuedToWard: dto?.issuedToWard ? String(dto.issuedToWard) : undefined,
      issuedToPerson: dto?.issuedToPerson ? String(dto.issuedToPerson) : undefined,
      transportBoxTemp: this.optionalNumber(dto?.transportBoxTemp ?? dto?.transportTemp),
      notes: dto?.notes ? String(dto.notes) : undefined,
    };
    return this.svc.releaseMtpEmergencyPack(this.principal(req), mtpId, payload);
  }
}
