"use client";

import * as React from "react";
import { AppLink as Link } from "@/components/app-link";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";

import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

import {
  AlertTriangle,
  ExternalLink,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Wrench,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  Eye,
  BadgePercent,
  Layers,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type BranchRow = { id: string; code: string; name: string; city: string };

type ServiceChargeUnit =
  | "PER_UNIT"
  | "PER_VISIT"
  | "PER_TEST"
  | "PER_HOUR"
  | "PER_DAY"
  | "PER_SIDE"
  | "PER_LEVEL"
  | "PER_SESSION"
  | "PER_PROCEDURE"
  | "PER_PACKAGE";

type TaxType = "GST" | "TDS" | "OTHER";

type TaxCodeRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  taxType: TaxType;
  ratePercent: string | number;
  isActive: boolean;
};

type ChargeMasterRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  chargeUnit?: ServiceChargeUnit | null;
  taxCodeId?: string | null;
  taxCode?: TaxCodeRow | null;
  isActive: boolean;
};

type TariffPlanRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  description?: string | null;

  isActive: boolean;
  isDefault?: boolean | null;

  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  version?: number | null;

  createdAt?: string;
  updatedAt?: string;

  _count?: {
    rates?: number;
    payerContracts?: number;
  };
};

type TariffRateRow = {
  id: string;
  tariffPlanId: string;
  chargeMasterItemId: string;

  rateAmount: string | number; // Decimal
  currency?: string | null;

  // optional overrides
  taxCodeId?: string | null;
  taxCode?: TaxCodeRow | null;
  isTaxInclusive?: boolean | null;

  isActive: boolean;

  chargeUnit?: ServiceChargeUnit | null; // may be derived in API
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  version?: number | null;

  notes?: string | null;

  chargeMasterItem?: {
    id: string;
    code: string;
    name: string;
    chargeUnit?: ServiceChargeUnit | null;
    taxCodeId?: string | null;
    taxCode?: TaxCodeRow | null;
    isActive: boolean;
  } | null;

  createdAt?: string;
  updatedAt?: string;
};

/* -------------------------------------------------------------------------- */
/*                                   Utils                                    */
/* -------------------------------------------------------------------------- */

const LS_BRANCH = "zc.superadmin.infrastructure.branchId";

function readLS(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function buildQS(params: Record<string, any>) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v);
    if (!s || s === "all") return;
    usp.set(k, s);
  });
  return usp.toString();
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-zc-panel/30", className)} />;
}

function drawerClassName(extra?: string) {
  return cn(
    "left-auto right-0 top-0 h-screen w-[95vw] max-w-[980px] translate-x-0 translate-y-0",
    "rounded-2xl",
    "border border-indigo-200/50 dark:border-indigo-800/50 bg-zc-card",
    "shadow-2xl shadow-indigo-500/10",
    "overflow-y-auto",
    extra,
  );
}

function activeBadge(isActive: boolean) {
  return isActive ? <Badge variant="ok">ACTIVE</Badge> : <Badge variant="secondary">INACTIVE</Badge>;
}

function unitLabel(u?: ServiceChargeUnit | null) {
  const x = u || "PER_UNIT";
  switch (x) {
    case "PER_UNIT":
      return "Per Unit";
    case "PER_VISIT":
      return "Per Visit";
    case "PER_TEST":
      return "Per Test";
    case "PER_HOUR":
      return "Per Hour";
    case "PER_DAY":
      return "Per Day";
    case "PER_SIDE":
      return "Per Side";
    case "PER_LEVEL":
      return "Per Level";
    case "PER_SESSION":
      return "Per Session";
    case "PER_PROCEDURE":
      return "Per Procedure";
    case "PER_PACKAGE":
      return "Per Package";
    default:
      return x;
  }
}

async function apiTry<T>(primary: string, fallback: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(primary, init as any);
  } catch (e: any) {
    if (e instanceof ApiError && e.status === 404) {
      return await apiFetch<T>(fallback, init as any);
    }
    throw e;
  }
}

/**
 * Try a sequence of URLs. Useful when your backend may expose either:
 * - /api/billing/tariff-plans/:id/rates
 * - /api/billing/tariff-rates?tariffPlanId=...
 * - /api/infrastructure/... variants
 */
async function apiTryMany<T>(urls: { url: string; init?: RequestInit }[]) {
  let lastErr: any = null;
  for (const u of urls) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await apiFetch<T>(u.url, u.init as any);
    } catch (e: any) {
      lastErr = e;
      // keep trying if 404; otherwise break early
      if (!(e instanceof ApiError && e.status === 404)) break;
    }
  }
  throw lastErr || new Error("Request failed");
}

function looksLikeWhitelistError(msg?: string) {
  const s = (msg || "").toLowerCase();
  return (
    (s.includes("property") && s.includes("should not exist")) ||
    s.includes("whitelist") ||
    s.includes("non-whitelisted")
  );
}

function toAmountString(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  // keep as string to preserve Decimal precision; backend will validate
  return s;
}

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function SuperAdminTariffPlansPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<"plans" | "guide">("plans");
  const [showFilters, setShowFilters] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState<string>("");

  const [plans, setPlans] = React.useState<TariffPlanRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string>("");
  const [selectedPlan, setSelectedPlan] = React.useState<TariffPlanRow | null>(null);

  // rates
  const [ratesLoading, setRatesLoading] = React.useState(false);
  const [ratesErr, setRatesErr] = React.useState<string | null>(null);
  const [rates, setRates] = React.useState<TariffRateRow[]>([]);
  const [ratesQ, setRatesQ] = React.useState("");

  // reference lists for rate editor
  const [chargeMaster, setChargeMaster] = React.useState<ChargeMasterRow[]>([]);
  const [taxCodes, setTaxCodes] = React.useState<TaxCodeRow[]>([]);

  // filters
  const [q, setQ] = React.useState("");
  const [includeInactive, setIncludeInactive] = React.useState(false);

  // modals
  const [planEditOpen, setPlanEditOpen] = React.useState(false);
  const [planEditMode, setPlanEditMode] = React.useState<"create" | "edit">("create");
  const [planEditing, setPlanEditing] = React.useState<TariffPlanRow | null>(null);

  const [rateEditOpen, setRateEditOpen] = React.useState(false);
  const [rateEditMode, setRateEditMode] = React.useState<"create" | "edit">("create");
  const [rateEditing, setRateEditing] = React.useState<TariffRateRow | null>(null);

  const [policyOpen, setPolicyOpen] = React.useState(false);
  const [policyPayload, setPolicyPayload] = React.useState<any>(null);

  const mustSelectBranch = !branchId;

  async function loadBranches(): Promise<string | null> {
    const list = (await apiFetch<BranchRow[]>("/api/branches")) || [];
    setBranches(list);

    const stored = readLS(LS_BRANCH);
    const first = list[0]?.id || null;
    const next = (stored && list.some((b) => b.id === stored) ? stored : null) || first;

    if (next) writeLS(LS_BRANCH, next);
    setBranchId(next || "");
    return next;
  }

  async function loadTaxCodesForBranch(bid: string) {
    try {
      const qs = buildQS({ branchId: bid, includeInactive: "true" });
      const res = await apiTry<any>(`/api/billing/tax-codes?${qs}`, `/api/infrastructure/tax-codes?${qs}`);
      const list: TaxCodeRow[] = Array.isArray(res) ? res : (res?.rows || []);
      setTaxCodes(list);
    } catch {
      setTaxCodes([]);
    }
  }

  async function loadChargeMasterForBranch(bid: string) {
    try {
      const qs = buildQS({ branchId: bid, includeInactive: "true" });
      const res = await apiTry<any>(`/api/infrastructure/charge-master?${qs}`, `/api/infra/charge-master?${qs}`);
      const list: ChargeMasterRow[] = Array.isArray(res) ? res : (res?.rows || []);
      setChargeMaster(list);
    } catch {
      setChargeMaster([]);
    }
  }

  async function loadPlans(showToast = false) {
    if (!branchId) return;
    setErr(null);
    setLoading(true);
    try {
      const qs = buildQS({
        branchId,
        q: q.trim() || undefined,
        includeInactive: includeInactive ? "true" : undefined,
        includeCounts: "true",
      });

      // billing module primary, infra fallback
      const res = await apiTry<any>(`/api/billing/tariff-plans?${qs}`, `/api/infrastructure/tariff-plans?${qs}`);
      const list: TariffPlanRow[] = Array.isArray(res) ? res : (res?.rows || []);
      setPlans(list);

      const nextSelected =
        selectedPlanId && list.some((x) => x.id === selectedPlanId) ? selectedPlanId : list[0]?.id || "";
      setSelectedPlanId(nextSelected);
      setSelectedPlan(nextSelected ? list.find((x) => x.id === nextSelected) || null : null);

      if (showToast) toast({ title: "Tariff plans refreshed", description: "Loaded latest plans for this branch." });
    } catch (e: any) {
      const msg = e?.message || "Failed to load tariff plans";
      setErr(msg);
      setPlans([]);
      setSelectedPlanId("");
      setSelectedPlan(null);
      if (showToast) toast({ title: "Refresh failed", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  async function loadRatesForPlan(planId: string, showToast = false) {
    if (!planId) return;
    setRatesErr(null);
    setRatesLoading(true);
    try {
      const qs = buildQS({ tariffPlanId: planId, includeInactive: "true", includeRefs: "true" });

      const res = await apiTryMany<any>([
        { url: `/api/billing/tariff-plans/${encodeURIComponent(planId)}/rates?${buildQS({ includeInactive: "true", includeRefs: "true" })}` },
        { url: `/api/billing/tariff-rates?${qs}` },
        { url: `/api/infrastructure/tariff-plans/${encodeURIComponent(planId)}/rates?${buildQS({ includeInactive: "true", includeRefs: "true" })}` },
        { url: `/api/infrastructure/tariff-rates?${qs}` },
      ]);

      const list: TariffRateRow[] = Array.isArray(res) ? res : (res?.rows || []);
      setRates(list);

      if (showToast) toast({ title: "Rates refreshed", description: "Loaded latest rates for this plan." });
    } catch (e: any) {
      const msg = e?.message || "Failed to load tariff rates";
      setRatesErr(msg);
      setRates([]);
      if (showToast) toast({ title: "Rates refresh failed", description: msg, variant: "destructive" as any });
    } finally {
      setRatesLoading(false);
    }
  }

  async function refreshAll(showToast = false) {
    setLoading(true);
    setErr(null);
    try {
      const bid = branchId || (await loadBranches());
      if (!bid) {
        setLoading(false);
        return;
      }
      await Promise.all([loadTaxCodesForBranch(bid), loadChargeMasterForBranch(bid)]);
      await loadPlans(false);

      // load rates for selected plan if any
      const plan = selectedPlanId || (plans[0]?.id ?? "");
      if (plan) await loadRatesForPlan(plan, false);

      if (showToast) toast({ title: "Ready", description: "Tariff plans and rates are up to date." });
    } catch (e: any) {
      const msg = e?.message || "Refresh failed";
      setErr(msg);
      if (showToast) toast({ title: "Refresh failed", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void refreshAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!branchId) return;

    setSelectedPlanId("");
    setSelectedPlan(null);
    setRates([]);
    setRatesQ("");

    void loadTaxCodesForBranch(branchId);
    void loadChargeMasterForBranch(branchId);
    void loadPlans(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, includeInactive]);

  React.useEffect(() => {
    if (!branchId) return;
    const t = setTimeout(() => void loadPlans(false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  React.useEffect(() => {
    if (!selectedPlanId) {
      setSelectedPlan(null);
      setRates([]);
      return;
    }
    const p = plans.find((x) => x.id === selectedPlanId) || null;
    setSelectedPlan(p);
    if (p) void loadRatesForPlan(p.id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanId]);

  async function onBranchChange(nextId: string) {
    setBranchId(nextId);
    writeLS(LS_BRANCH, nextId);

    setQ("");
    setIncludeInactive(false);

    setSelectedPlanId("");
    setSelectedPlan(null);
    setRates([]);
    setRatesQ("");
    setErr(null);

    setLoading(true);
    try {
      await Promise.all([loadTaxCodesForBranch(nextId), loadChargeMasterForBranch(nextId)]);
      await loadPlans(false);
      toast({ title: "Branch scope changed", description: "Loaded tariff plans for selected branch." });
    } catch (e: any) {
      toast({ title: "Load failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  const stats = React.useMemo(() => {
    const total = plans.length;
    const active = plans.filter((p) => p.isActive).length;
    const inactive = total - active;
    const defaults = plans.filter((p) => p.isDefault).length;

    const rateCount = rates.length;
    const activeRates = rates.filter((r) => r.isActive).length;

    // quick heuristic for “coverage”: how many active charge master items have a rate in this plan
    const activeCM = chargeMaster.filter((c) => c.isActive);
    const rateItemIds = new Set(rates.filter((r) => r.isActive).map((r) => r.chargeMasterItemId));
    const covered = activeCM.filter((c) => rateItemIds.has(c.id)).length;
    const coveragePct = activeCM.length ? Math.round((covered / activeCM.length) * 100) : 0;

    return { total, active, inactive, defaults, rateCount, activeRates, covered, activeCM: activeCM.length, coveragePct };
  }, [plans, rates, chargeMaster]);

  const filteredRates = React.useMemo(() => {
    const term = ratesQ.trim().toLowerCase();
    if (!term) return rates;
    return rates.filter((r) => {
      const cm = r.chargeMasterItem;
      const hay = [
        r.id,
        String(r.rateAmount ?? ""),
        cm?.code,
        cm?.name,
        r.taxCode?.code,
        r.taxCode?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rates, ratesQ]);

  function openCreatePlan() {
    setPlanEditMode("create");
    setPlanEditing(null);
    setPlanEditOpen(true);
  }
  function openEditPlan(row: TariffPlanRow) {
    setPlanEditMode("edit");
    setPlanEditing(row);
    setPlanEditOpen(true);
  }

  function openCreateRate() {
    if (!selectedPlan) return;
    setRateEditMode("create");
    setRateEditing(null);
    setRateEditOpen(true);
  }
  function openEditRate(row: TariffRateRow) {
    setRateEditMode("edit");
    setRateEditing(row);
    setRateEditOpen(true);
  }

  async function removePlan(row: TariffPlanRow) {
    if (!row?.id) return;
    const ok = window.confirm("Delete this tariff plan? (Only safe if not referenced by payer contracts/orders.)");
    if (!ok) return;

    setBusy(true);
    try {
      await apiTry(
        `/api/billing/tariff-plans/${encodeURIComponent(row.id)}`,
        `/api/infrastructure/tariff-plans/${encodeURIComponent(row.id)}`,
        { method: "DELETE" },
      );
      toast({ title: "Deleted", description: "Tariff plan deleted." });
      await loadPlans(false);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function togglePlan(row: TariffPlanRow, nextActive: boolean) {
    const ok = window.confirm(nextActive ? "Activate this plan?" : "Deactivate this plan?");
    if (!ok) return;

    setBusy(true);
    try {
      await apiTry(
        `/api/billing/tariff-plans/${encodeURIComponent(row.id)}`,
        `/api/infrastructure/tariff-plans/${encodeURIComponent(row.id)}`,
        { method: "PATCH", body: JSON.stringify({ isActive: nextActive }) },
      );
      toast({ title: "Updated", description: `Plan is now ${nextActive ? "ACTIVE" : "INACTIVE"}.` });
      await loadPlans(false);
    } catch (e: any) {
      toast({ title: "Update failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function removeRate(row: TariffRateRow) {
    if (!row?.id) return;
    const ok = window.confirm("Delete this rate row? (Prefer closing effectiveTo instead of delete.)");
    if (!ok) return;

    setBusy(true);
    try {
      await apiTryMany([
        { url: `/api/billing/tariff-rates/${encodeURIComponent(row.id)}`, init: { method: "DELETE" } },
        { url: `/api/infrastructure/tariff-rates/${encodeURIComponent(row.id)}`, init: { method: "DELETE" } },
      ]);
      toast({ title: "Deleted", description: "Rate deleted." });
      if (selectedPlan) await loadRatesForPlan(selectedPlan.id, false);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function closeRate(row: TariffRateRow) {
    if (!row?.id) return;
    const ok = window.confirm("Close this rate by setting effectiveTo now? (Recommended vs delete)");
    if (!ok) return;

    setBusy(true);
    try {
      await apiTryMany([
        { url: `/api/billing/tariff-rates/${encodeURIComponent(row.id)}/close`, init: { method: "POST" } },
        { url: `/api/billing/tariff-rates/${encodeURIComponent(row.id)}`, init: { method: "PATCH", body: JSON.stringify({ close: true }) } },
        { url: `/api/infrastructure/tariff-rates/${encodeURIComponent(row.id)}/close`, init: { method: "POST" } },
        { url: `/api/infrastructure/tariff-rates/${encodeURIComponent(row.id)}`, init: { method: "PATCH", body: JSON.stringify({ close: true }) } },
      ]);
      toast({ title: "Closed", description: "Rate closed (effectiveTo set)." });
      if (selectedPlan) await loadRatesForPlan(selectedPlan.id, false);
    } catch (e: any) {
      toast({ title: "Close failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Infrastructure • Tariff Plans">
      <div className="grid gap-6">
        {/* Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
              <Layers className="h-5 w-5 text-zc-accent" />
            </span>
            <div className="min-w-0">
              <div className="text-3xl font-semibold tracking-tight">Tariff Plans</div>
              <div className="mt-1 text-sm text-zc-muted">
                Branch-specific price books. Rates always reference <span className="font-semibold text-zc-text">ChargeMasterItem</span> (no serviceCode).
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
            <Button
              variant="outline"
              className="px-5 gap-2 whitespace-nowrap shrink-0"
              onClick={() => refreshAll(true)}
              disabled={loading || busy}
            >
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>

            <Button variant="outline" asChild className="px-5 gap-2 whitespace-nowrap shrink-0">
              <Link href="/superadmin/infrastructure/fixit">
                <Wrench className="h-4 w-4" />
                FixIt Inbox
              </Link>
            </Button>

            <Button variant="outline" asChild className="px-5 gap-2 whitespace-nowrap shrink-0">
              <Link href="/superadmin/infrastructure/golive">
                <CheckCircle2 className="h-4 w-4" />
                GoLive
              </Link>
            </Button>

            <Button
              variant="primary"
              className="px-5 gap-2 whitespace-nowrap shrink-0"
              onClick={openCreatePlan}
              disabled={mustSelectBranch}
            >
              <Plus className="h-4 w-4" />
              New Plan
            </Button>
          </div>
        </div>

        {err ? (
          <Card className="border-zc-danger/40">
            <CardHeader className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-zc-danger" />
                <div>
                  <CardTitle className="text-base">Could not load tariff plans</CardTitle>
                  <CardDescription className="mt-1">{err}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ) : null}

        {/* Overview */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Overview</CardTitle>
            <CardDescription className="text-sm">
              A tariff plan becomes “GoLive-ready” when it covers the required Charge Master items for your facility scope.
              FixIt rules should open gaps and auto-resolve when rates are added/updated.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Branch</Label>
              <Select value={branchId || ""} onValueChange={onBranchChange}>
                <SelectTrigger className="h-11 w-full rounded-xl border-zc-border bg-zc-card">
                  <SelectValue placeholder="Select branch..." />
                </SelectTrigger>
                <SelectContent className="max-h-[320px] overflow-y-auto">
                  {branches.filter((b) => b.id).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.code} - {b.name} ({b.city})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 md:grid-cols-6">
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Plans</div>
                <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{stats.total}</div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Active</div>
                <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{stats.active}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-900/50 dark:bg-slate-900/10">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Defaults</div>
                <div className="mt-1 text-lg font-bold text-slate-700 dark:text-slate-300">{stats.defaults}</div>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-900/10">
                <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Rates (selected)</div>
                <div className="mt-1 text-lg font-bold text-indigo-800 dark:text-indigo-200">{stats.rateCount}</div>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-900/10">
                <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Active rates</div>
                <div className="mt-1 text-lg font-bold text-indigo-800 dark:text-indigo-200">{stats.activeRates}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
                <div className="text-xs font-medium text-amber-700 dark:text-amber-300">Coverage (heuristic)</div>
                <div className="mt-1 text-lg font-bold text-amber-800 dark:text-amber-200">
                  {stats.coveragePct}%{" "}
                  <span className="text-xs font-semibold opacity-80">
                    ({stats.covered}/{stats.activeCM})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search plans by code/name…"
                  className="pl-10"
                  disabled={mustSelectBranch}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                  <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} disabled={mustSelectBranch} />
                  <div className="text-sm">
                    <div className="font-semibold text-zc-text">Include inactive</div>
                    <div className="text-xs text-zc-muted">Usually keep off</div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setShowFilters((s) => !s)}
                  disabled={mustSelectBranch}
                >
                  <Filter className="h-4 w-4" />
                  {showFilters ? "Hide Help" : "Show Help"}
                </Button>
              </div>
            </div>

            {showFilters ? (
              <div className="grid gap-3 rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                  <Filter className="h-4 w-4 text-zc-accent" />
                  Recommended structure
                </div>
                <div className="text-sm text-zc-muted">
                  Create plans like <b>SELF</b>, <b>CORPORATE</b>, <b>TPA-A</b>, <b>TPA-B</b>, <b>STAFF</b>, etc.
                  Keep one default plan per branch. Rates must be aligned with Charge Master units and active tax codes.
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Branch scoped</Badge>
              <Badge variant="ok">Rates reference Charge Master</Badge>
              <Badge variant="warning">Coverage gaps → FixIt</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Workspace */}
        <Card>
          <CardHeader className="py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Tariff Workspace</CardTitle>
                <CardDescription>Create plans and maintain rates for the selected plan.</CardDescription>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className={cn("h-10 rounded-2xl border border-zc-border bg-zc-panel/20 p-1")}>
                  <TabsTrigger
                    value="plans"
                    className={cn(
                      "rounded-xl px-3 data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm",
                    )}
                  >
                    <Layers className="mr-2 h-4 w-4" />
                    Plans + Rates
                  </TabsTrigger>
                  <TabsTrigger
                    value="guide"
                    className={cn(
                      "rounded-xl px-3 data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm",
                    )}
                  >
                    <Wrench className="mr-2 h-4 w-4" />
                    Guide
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <CardContent className="pb-6">
            <Tabs value={activeTab}>
              <TabsContent value="plans" className="mt-0">
                <div className="grid gap-4 lg:grid-cols-12">
                  {/* Left: plans list */}
                  <div className="lg:col-span-5">
                    <div className="rounded-xl border border-zc-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[130px]">Status</TableHead>
                            <TableHead className="w-[56px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            Array.from({ length: 10 }).map((_, i) => (
                              <TableRow key={i}>
                                <TableCell colSpan={4}>
                                  <Skeleton className="h-6 w-full" />
                                </TableCell>
                              </TableRow>
                            ))
                          ) : plans.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <div className="flex items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                                  <Layers className="h-4 w-4" />
                                  No plans found. Create one to begin.
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            plans.map((p) => {
                              const isSelected = selectedPlanId === p.id;
                              const rateCount = p._count?.rates ?? undefined;

                              return (
                                <TableRow
                                  key={p.id}
                                  className={cn("cursor-pointer", isSelected ? "bg-zc-panel/30" : "")}
                                  onClick={() => setSelectedPlanId(p.id)}
                                >
                                  <TableCell className="font-mono text-xs">
                                    <div className="flex flex-col gap-1">
                                      <span className="font-semibold text-zc-text">{p.code}</span>
                                      <span className="text-[11px] text-zc-muted">
                                        {p.isDefault ? "Default plan" : "—"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <span className="font-semibold text-zc-text">{p.name}</span>
                                      <span className="text-xs text-zc-muted">
                                        {rateCount != null ? (
                                          <>
                                            Rates: <span className="font-semibold text-zc-text">{rateCount}</span>
                                            <span className="mx-2">•</span>
                                          </>
                                        ) : null}
                                        From: <span className="font-semibold text-zc-text">{fmtDate(p.effectiveFrom || null)}</span>
                                        <span className="mx-2">•</span>
                                        To: <span className="font-semibold text-zc-text">{fmtDate(p.effectiveTo || null)}</span>
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      {activeBadge(p.isActive)}
                                      {p.isDefault ? <Badge variant="secondary">DEFAULT</Badge> : null}
                                    </div>
                                  </TableCell>
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-[220px]">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => openEditPlan(p)}>
                                          <Wrench className="mr-2 h-4 w-4" />
                                          Edit plan
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => togglePlan(p, !p.isActive)}>
                                          <CheckCircle2 className="mr-2 h-4 w-4" />
                                          {p.isActive ? "Deactivate" : "Activate"}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => removePlan(p)}>
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete plan
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>

                      <div className="flex flex-col gap-3 border-t border-zc-border p-4 md:flex-row md:items-center md:justify-between">
                        <div className="text-sm text-zc-muted">
                          Total: <span className="font-semibold text-zc-text">{plans.length}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" className="gap-2" asChild>
                            <Link href="/superadmin/infrastructure/charge-master">
                              Charge Master <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2" asChild>
                            <Link href="/superadmin/infrastructure/tax-codes">
                              Tax Codes <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: plan detail + rates */}
                  <div className="lg:col-span-7">
                    {!selectedPlan ? (
                      <Card className="border-zc-border">
                        <CardHeader className="py-4">
                          <CardTitle className="text-base">Select a plan</CardTitle>
                          <CardDescription>Pick a tariff plan on the left to view and manage its rates.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4 text-sm text-zc-muted">
                            Tip: Keep one default plan per branch and make sure it has maximum coverage to avoid GoLive blocks.
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <PlanDetail
                        plan={selectedPlan}
                        busy={busy}
                        ratesLoading={ratesLoading}
                        ratesErr={ratesErr}
                        rates={filteredRates}
                        ratesQ={ratesQ}
                        onRatesQ={setRatesQ}
                        onRefreshRates={() => loadRatesForPlan(selectedPlan.id, true)}
                        onAddRate={openCreateRate}
                        onEditPlan={() => openEditPlan(selectedPlan)}
                        onTogglePlan={() => togglePlan(selectedPlan, !selectedPlan.isActive)}
                        onViewPolicy={() => {
                          setPolicyPayload(null);
                          setPolicyOpen(true);
                        }}
                        onEditRate={openEditRate}
                        onDeleteRate={removeRate}
                        onCloseRate={closeRate}
                      />
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="guide" className="mt-0">
                <Card className="border-zc-border">
                  <CardHeader className="py-4">
                    <CardTitle className="text-base">How Tariffs work</CardTitle>
                    <CardDescription>Tariff Plans are branch-specific price books.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="text-sm font-semibold text-zc-text">1) Charge Master is the anchor</div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Tariff rates must reference <b>ChargeMasterItem</b>. No serviceCode anywhere.
                        </div>
                      </div>
                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="text-sm font-semibold text-zc-text">2) Enforce charge unit</div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Rate must honor the charge unit (per day/per session/per procedure etc.) from Charge Master.
                        </div>
                      </div>
                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="text-sm font-semibold text-zc-text">3) Taxes are governed</div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Tax codes must be active. If deactivated while in use, FixIt should flag it.
                        </div>
                      </div>
                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="text-sm font-semibold text-zc-text">4) Version/effectiveTo</div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Prefer “closing” rates (effectiveTo) instead of deleting for audit-safe history.
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4 text-sm text-zc-muted">
                      If any action (create/update/close) fails due to missing endpoints, tell me the route you have and I’ll align the UI to it.
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Plan create/edit drawer */}
      <TariffPlanEditModal
        open={planEditOpen}
        onOpenChange={setPlanEditOpen}
        mode={planEditMode}
        branchId={branchId}
        editing={planEditing}
        onSaved={async () => {
          toast({ title: "Saved", description: "Tariff plan saved successfully." });
          await loadPlans(false);
        }}
      />

      {/* Rate create/edit drawer */}
      <TariffRateEditModal
        open={rateEditOpen}
        onOpenChange={setRateEditOpen}
        mode={rateEditMode}
        branchId={branchId}
        plan={selectedPlan}
        editing={rateEditing}
        chargeMaster={chargeMaster}
        taxCodes={taxCodes}
        onSaved={async () => {
          toast({ title: "Saved", description: "Tariff rate saved successfully." });
          if (selectedPlan) await loadRatesForPlan(selectedPlan.id, false);
        }}
      />

      {/* Policy viewer placeholder (kept to match style; wire later if you store planPolicy JSON) */}
      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="sm:max-w-[980px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-zc-accent" />
              Plan Policy JSON (optional)
            </DialogTitle>
            <DialogDescription>Optional JSON for plan-level rules (payer contracts, caps, discounts). Wire later if needed.</DialogDescription>
          </DialogHeader>

          <div className="mt-3 rounded-xl border border-zc-border bg-zc-panel/10 p-4">
            <pre className="max-h-[60vh] overflow-auto text-xs leading-relaxed text-zc-text">
              {JSON.stringify(policyPayload ?? {}, null, 2)}
            </pre>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPolicyOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Plan Detail + Rates Panel                           */
/* -------------------------------------------------------------------------- */

function PlanDetail(props: {
  plan: TariffPlanRow;
  busy: boolean;

  ratesLoading: boolean;
  ratesErr: string | null;
  rates: TariffRateRow[];
  ratesQ: string;
  onRatesQ: (v: string) => void;

  onRefreshRates: () => void;
  onAddRate: () => void;

  onEditPlan: () => void;
  onTogglePlan: () => void;
  onViewPolicy: () => void;

  onEditRate: (r: TariffRateRow) => void;
  onDeleteRate: (r: TariffRateRow) => void;
  onCloseRate: (r: TariffRateRow) => void;
}) {
  const {
    plan,
    busy,
    ratesLoading,
    ratesErr,
    rates,
    ratesQ,
    onRatesQ,
    onRefreshRates,
    onAddRate,
    onEditPlan,
    onTogglePlan,
    onViewPolicy,
    onEditRate,
    onDeleteRate,
    onCloseRate,
  } = props;

  return (
    <div className="grid gap-4">
      <Card className="border-zc-border">
        <CardHeader className="py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-base">
                <span className="font-mono">{plan.code}</span> • {plan.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {activeBadge(plan.isActive)}{" "}
                {plan.isDefault ? (
                  <>
                    <span className="mx-2 text-zc-muted">•</span>
                    <Badge variant="secondary">DEFAULT</Badge>
                  </>
                ) : null}
                <span className="mx-2 text-zc-muted">•</span>
                From: <span className="font-semibold text-zc-text">{fmtDate(plan.effectiveFrom || null)}</span>
                <span className="mx-2 text-zc-muted">•</span>
                To: <span className="font-semibold text-zc-text">{fmtDate(plan.effectiveTo || null)}</span>
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={onEditPlan} disabled={busy}>
                <Wrench className="h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline" className="gap-2" onClick={onViewPolicy} disabled={busy}>
                <Eye className="h-4 w-4" />
                Policy
              </Button>
              <Button variant={plan.isActive ? "outline" : "primary"} className="gap-2" onClick={onTogglePlan} disabled={busy}>
                <CheckCircle2 className="h-4 w-4" />
                {plan.isActive ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          {plan.description ? (
            <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4 text-sm text-zc-muted">
              <div className="text-sm font-semibold text-zc-text">Description</div>
              <div className="mt-1">{plan.description}</div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4">
              <div className="text-xs font-semibold text-zc-muted">Audit</div>
              <div className="mt-2 grid gap-1 text-sm text-zc-muted">
                <div>
                  Version: <span className="font-semibold text-zc-text">{plan.version ?? "—"}</span>
                </div>
                <div>
                  Updated: <span className="font-semibold text-zc-text">{fmtDateTime(plan.updatedAt || null)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4">
              <div className="text-xs font-semibold text-zc-muted">Counts</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">Rates: {plan._count?.rates ?? "—"}</Badge>
                <Badge variant="secondary">Payer contracts: {plan._count?.payerContracts ?? "—"}</Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Rates header */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-zc-accent" />
              <div className="text-sm font-semibold text-zc-text">Tariff Rates</div>
              <Badge variant="secondary">{rates.length}</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={onRefreshRates} disabled={ratesLoading || busy}>
                <RefreshCw className={ratesLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh rates
              </Button>
              <Button variant="primary" size="sm" className="gap-2" onClick={onAddRate} disabled={busy}>
                <Plus className="h-4 w-4" />
                Add rate
              </Button>
            </div>
          </div>

          {/* Rates search */}
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
            <Input
              value={ratesQ}
              onChange={(e) => onRatesQ(e.target.value)}
              placeholder="Search rates by Charge Master code/name…"
              className="pl-10"
              disabled={ratesLoading}
            />
          </div>

          {ratesErr ? (
            <div className="rounded-xl border border-zc-danger/40 bg-zc-danger/5 p-4 text-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-zc-danger" />
                <div>
                  <div className="font-semibold text-zc-text">Could not load rates</div>
                  <div className="mt-1 text-zc-muted">{ratesErr}</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-zc-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Charge Master</TableHead>
                  <TableHead className="w-[140px]">Rate</TableHead>
                  <TableHead className="w-[180px]">Tax</TableHead>
                  <TableHead className="w-[150px]">Effective</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[56px]" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {ratesLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                        <FileSpreadsheet className="h-4 w-4" />
                        No rates found. Add rates to cover the Charge Master.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rates.map((r) => {
                    const cm = r.chargeMasterItem;
                    const displayUnit = cm?.chargeUnit || r.chargeUnit;
                    const tax = r.taxCode || cm?.taxCode;
                    const taxLabel = tax ? `${tax.code} (${String(tax.ratePercent)}%)` : "—";

                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-zc-text">{cm?.code || "—"}</span>
                              {displayUnit ? <Badge variant="secondary">{unitLabel(displayUnit)}</Badge> : null}
                            </div>
                            <div className="text-sm font-semibold text-zc-text">{cm?.name || "—"}</div>
                            {!cm?.isActive ? (
                              <div className="text-xs text-amber-700 dark:text-amber-300">Charge master item is inactive</div>
                            ) : null}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-semibold text-zc-text">₹ {String(r.rateAmount)}</div>
                            <div className="text-xs text-zc-muted">Currency: {r.currency || "INR"}</div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <BadgePercent className="h-4 w-4 text-zc-accent" />
                              <span className="text-sm font-semibold text-zc-text">{taxLabel}</span>
                            </div>
                            <div className="text-xs text-zc-muted">
                              Inclusive: <span className="font-semibold text-zc-text">{r.isTaxInclusive ? "Yes" : "No"}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm text-zc-muted">
                            <div>
                              From: <span className="font-semibold text-zc-text">{fmtDate(r.effectiveFrom || null)}</span>
                            </div>
                            <div>
                              To: <span className="font-semibold text-zc-text">{fmtDate(r.effectiveTo || null)}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>{activeBadge(r.isActive)}</TableCell>

                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[240px]">
                              <DropdownMenuLabel>Rate actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onEditRate(r)}>
                                <Wrench className="mr-2 h-4 w-4" />
                                Edit rate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onCloseRate(r)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Close (effectiveTo)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onDeleteRate(r)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Plan Create/Edit                               */
/* -------------------------------------------------------------------------- */

function TariffPlanEditModal({
  open,
  onOpenChange,
  mode,
  branchId,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  branchId: string;
  editing: TariffPlanRow | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState<any>({
    code: "",
    name: "",
    description: "",
    isActive: true,
    isDefault: false,
    effectiveFrom: "",
  });

  React.useEffect(() => {
    if (!open) return;
    if (mode === "edit" && editing) {
      setForm({
        code: editing.code || "",
        name: editing.name || "",
        description: editing.description || "",
        isActive: Boolean(editing.isActive),
        isDefault: Boolean(editing.isDefault),
        effectiveFrom: editing.effectiveFrom ? new Date(editing.effectiveFrom).toISOString().slice(0, 10) : "",
      });
    } else {
      setForm({
        code: "",
        name: "",
        description: "",
        isActive: true,
        isDefault: false,
        effectiveFrom: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, mode, editing]);

  function patch(p: Partial<any>) {
    setForm((prev: any) => ({ ...prev, ...p }));
  }

  async function save() {
    if (!branchId) return;

    const code = String(form.code || "").trim();
    const name = String(form.name || "").trim();
    if (!code || !name) {
      toast({ title: "Missing fields", description: "Code and Name are required." });
      return;
    }

    const payload: any = {
      branchId, // ensures branch-specific only
      code,
      name,
      description: String(form.description || "").trim() || null,
      isActive: Boolean(form.isActive),
      isDefault: Boolean(form.isDefault),
      effectiveFrom: form.effectiveFrom ? new Date(String(form.effectiveFrom)).toISOString() : null,
    };

    // Minimal payload if backend currently accepts only code/name/isActive
    const payloadMin: any = {
      branchId,
      code,
      name,
      isActive: payload.isActive,
    };

    setSaving(true);
    try {
      if (mode === "create") {
        try {
          await apiTry(`/api/billing/tariff-plans`, `/api/infrastructure/tariff-plans`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } catch (e: any) {
          const msg = e?.message || "";
          if (e instanceof ApiError && e.status === 400 && looksLikeWhitelistError(msg)) {
            await apiTry(`/api/billing/tariff-plans`, `/api/infrastructure/tariff-plans`, {
              method: "POST",
              body: JSON.stringify(payloadMin),
            });
            toast({
              title: "Saved (basic only)",
              description: "Backend DTO currently accepts only basic fields. We’ll align plan DTO later.",
            });
          } else {
            throw e;
          }
        }
      } else {
        if (!editing?.id) throw new Error("Invalid editing row");
        try {
          await apiTry(`/api/billing/tariff-plans/${encodeURIComponent(editing.id)}`, `/api/infrastructure/tariff-plans/${encodeURIComponent(editing.id)}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        } catch (e: any) {
          const msg = e?.message || "";
          if (e instanceof ApiError && e.status === 400 && looksLikeWhitelistError(msg)) {
            await apiTry(`/api/billing/tariff-plans/${encodeURIComponent(editing.id)}`, `/api/infrastructure/tariff-plans/${encodeURIComponent(editing.id)}`, {
              method: "PATCH",
              body: JSON.stringify(payloadMin),
            });
            toast({
              title: "Updated (basic only)",
              description: "Backend update endpoint rejects advanced fields. Align DTO next.",
            });
          } else {
            throw e;
          }
        }
      }

      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={drawerClassName()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            {mode === "create" ? "New Tariff Plan" : "Edit Tariff Plan"}
          </DialogTitle>
          <DialogDescription>Branch-specific. Use plans like SELF / CORPORATE / TPA to represent payer pricing.</DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="px-6 pb-6 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input value={form.code || ""} onChange={(e) => patch({ code: e.target.value })} placeholder="e.g., SELF" />
            </div>

            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={form.name || ""} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g., Self Pay" />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description || ""}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Who this plan is for, what it covers, any policy notes…"
                className="min-h-[110px]"
              />
            </div>

            <div className="grid gap-2">
              <Label>Effective From (optional)</Label>
              <Input
                type="date"
                value={form.effectiveFrom || ""}
                onChange={(e) => patch({ effectiveFrom: e.target.value })}
              />
              <div className="text-xs text-zc-muted">For compliance/history. Backend may enforce in GoLive.</div>
            </div>

            <div className="grid gap-2">
              <Label>Flags</Label>
              <div className="grid gap-2">
                <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                  <Switch checked={Boolean(form.isDefault)} onCheckedChange={(v) => patch({ isDefault: v })} />
                  <div className="text-sm">
                    <div className="font-semibold text-zc-text">Default plan</div>
                    <div className="text-xs text-zc-muted">Only one should be default per branch</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                  <Switch checked={Boolean(form.isActive)} onCheckedChange={(v) => patch({ isActive: v })} />
                  <div className="text-sm">
                    <div className="font-semibold text-zc-text">{form.isActive ? "Active" : "Inactive"}</div>
                    <div className="text-xs text-zc-muted">Inactive plans shouldn’t be used for new billing</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Rate Create/Edit                               */
/* -------------------------------------------------------------------------- */

function TariffRateEditModal({
  open,
  onOpenChange,
  mode,
  branchId,
  plan,
  editing,
  chargeMaster,
  taxCodes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  branchId: string;
  plan: TariffPlanRow | null;
  editing: TariffRateRow | null;
  chargeMaster: ChargeMasterRow[];
  taxCodes: TaxCodeRow[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const activeCM = React.useMemo(() => chargeMaster.filter((c) => c.isActive), [chargeMaster]);
  const activeTax = React.useMemo(() => taxCodes.filter((t) => t.isActive), [taxCodes]);

  const [form, setForm] = React.useState<any>({
    chargeMasterItemId: "",
    rateAmount: "",
    currency: "INR",
    taxCodeId: "",
    isTaxInclusive: false,
    isActive: true,
    effectiveFrom: "",
    notes: "",
  });

  React.useEffect(() => {
    if (!open) return;

    if (mode === "edit" && editing) {
      setForm({
        chargeMasterItemId: editing.chargeMasterItemId || "",
        rateAmount: String(editing.rateAmount ?? ""),
        currency: editing.currency || "INR",
        taxCodeId: editing.taxCodeId || "",
        isTaxInclusive: Boolean(editing.isTaxInclusive),
        isActive: Boolean(editing.isActive),
        effectiveFrom: editing.effectiveFrom ? new Date(editing.effectiveFrom).toISOString().slice(0, 10) : "",
        notes: editing.notes || "",
      });
    } else {
      setForm({
        chargeMasterItemId: "",
        rateAmount: "",
        currency: "INR",
        taxCodeId: "",
        isTaxInclusive: false,
        isActive: true,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        notes: "",
      });
    }
  }, [open, mode, editing]);

  function patch(p: Partial<any>) {
    setForm((prev: any) => ({ ...prev, ...p }));
  }

  const selectedCM = React.useMemo(() => {
    const id = String(form.chargeMasterItemId || "").trim();
    return id ? activeCM.find((c) => c.id === id) || null : null;
  }, [form.chargeMasterItemId, activeCM]);

  async function save() {
    if (!branchId || !plan?.id) return;

    const cmId = String(form.chargeMasterItemId || "").trim();
    const amt = toAmountString(form.rateAmount);
    if (!cmId) {
      toast({ title: "Missing item", description: "Select a Charge Master item." });
      return;
    }
    if (!amt) {
      toast({ title: "Missing rate", description: "Enter the rate amount." });
      return;
    }

    // Enforce active tax code if override is provided
    const taxCodeId = String(form.taxCodeId || "").trim() || null;
    if (taxCodeId) {
      const tc = taxCodes.find((x) => x.id === taxCodeId);
      if (tc && !tc.isActive) {
        toast({ title: "Inactive tax code", description: "Select an active tax code.", variant: "destructive" as any });
        return;
      }
    }

    // Show unit as read-only (enforced by Charge Master)
    if (!selectedCM?.chargeUnit) {
      toast({
        title: "Charge unit missing",
        description: "This Charge Master item has no chargeUnit. Fix it in Charge Master first.",
        variant: "destructive" as any,
      });
      return;
    }

    const payloadFull: any = {
      tariffPlanId: plan.id,
      chargeMasterItemId: cmId,
      rateAmount: amt,
      currency: String(form.currency || "INR").trim() || "INR",
      taxCodeId,
      isTaxInclusive: Boolean(form.isTaxInclusive),
      isActive: Boolean(form.isActive),
      effectiveFrom: form.effectiveFrom ? new Date(String(form.effectiveFrom)).toISOString() : null,
      notes: String(form.notes || "").trim() || null,
    };

    // Minimal payload fallback
    const payloadMin: any = {
      tariffPlanId: plan.id,
      chargeMasterItemId: cmId,
      rateAmount: amt,
      isActive: Boolean(form.isActive),
    };

    setSaving(true);
    try {
      if (mode === "create") {
        try {
          await apiTry(`/api/billing/tariff-rates`, `/api/infrastructure/tariff-rates`, {
            method: "POST",
            body: JSON.stringify(payloadFull),
          });
        } catch (e: any) {
          const msg = e?.message || "";
          if (e instanceof ApiError && e.status === 400 && looksLikeWhitelistError(msg)) {
            await apiTry(`/api/billing/tariff-rates`, `/api/infrastructure/tariff-rates`, {
              method: "POST",
              body: JSON.stringify(payloadMin),
            });
            toast({
              title: "Saved (basic only)",
              description: "Backend DTO accepts only basic fields. We’ll align rate DTO for tax/effectiveFrom next.",
            });
          } else {
            throw e;
          }
        }
      } else {
        if (!editing?.id) throw new Error("Invalid editing row");
        try {
          await apiTry(`/api/billing/tariff-rates/${encodeURIComponent(editing.id)}`, `/api/infrastructure/tariff-rates/${encodeURIComponent(editing.id)}`, {
            method: "PATCH",
            body: JSON.stringify(payloadFull),
          });
        } catch (e: any) {
          const msg = e?.message || "";
          if (e instanceof ApiError && e.status === 400 && looksLikeWhitelistError(msg)) {
            await apiTry(`/api/billing/tariff-rates/${encodeURIComponent(editing.id)}`, `/api/infrastructure/tariff-rates/${encodeURIComponent(editing.id)}`, {
              method: "PATCH",
              body: JSON.stringify(payloadMin),
            });
            toast({
              title: "Updated (basic only)",
              description: "Backend update endpoint rejects advanced fields. Align DTO next.",
            });
          } else {
            throw e;
          }
        }
      }

      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={drawerClassName()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            {mode === "create" ? "Add Tariff Rate" : "Edit Tariff Rate"}
          </DialogTitle>
          <DialogDescription>
            Rates must reference Charge Master and respect its charge unit. Use effectiveFrom for versioning history.
          </DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="px-6 pb-6 grid gap-4">
          <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4 text-sm">
            <div className="font-semibold text-zc-text">Plan</div>
            <div className="mt-1 text-zc-muted">
              <span className="font-mono font-semibold text-zc-text">{plan?.code || "—"}</span> • {plan?.name || "—"}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label>Charge Master Item</Label>
              <Select
                value={form.chargeMasterItemId || ""}
                onValueChange={(v) => patch({ chargeMasterItemId: v })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select charge master item..." />
                </SelectTrigger>
                <SelectContent className="max-h-[360px] overflow-y-auto">
                  {activeCM.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} • {c.name} • {c.chargeUnit ? unitLabel(c.chargeUnit) : "Unit missing"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCM ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant={selectedCM.chargeUnit ? "secondary" : "warning"}>
                    Unit: {selectedCM.chargeUnit ? unitLabel(selectedCM.chargeUnit) : "MISSING"}
                  </Badge>
                  <Badge variant={selectedCM.taxCodeId ? "secondary" : "warning"}>
                    Default tax: {selectedCM.taxCode?.code || (selectedCM.taxCodeId ? "Linked" : "MISSING")}
                  </Badge>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Rate Amount</Label>
              <Input
                value={form.rateAmount || ""}
                onChange={(e) => patch({ rateAmount: e.target.value })}
                placeholder="e.g., 1500.00"
              />
              <div className="text-xs text-zc-muted">Stored as Decimal. Currency assumed INR unless overridden.</div>
            </div>

            <div className="grid gap-2">
              <Label>Currency</Label>
              <Input value={form.currency || "INR"} onChange={(e) => patch({ currency: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <Label>Tax Override (optional)</Label>
              <Select value={form.taxCodeId || ""} onValueChange={(v) => patch({ taxCodeId: v === "none" ? "" : v })}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Use charge master tax code (default)" />
                </SelectTrigger>
                <SelectContent className="max-h-[360px] overflow-y-auto">
                  <SelectItem value="none">No override (use Charge Master default)</SelectItem>
                  {activeTax.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.code} • {t.name} • {String(t.ratePercent)}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-zc-muted">Override must be active, otherwise FixIt should block.</div>
            </div>

            <div className="grid gap-2">
              <Label>Tax Inclusive</Label>
              <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                <Switch checked={Boolean(form.isTaxInclusive)} onCheckedChange={(v) => patch({ isTaxInclusive: v })} />
                <div className="text-sm">
                  <div className="font-semibold text-zc-text">{form.isTaxInclusive ? "Inclusive" : "Exclusive"}</div>
                  <div className="text-xs text-zc-muted">Backend must compute accordingly</div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Effective From</Label>
              <Input type="date" value={form.effectiveFrom || ""} onChange={(e) => patch({ effectiveFrom: e.target.value })} />
              <div className="text-xs text-zc-muted">Used for history + versioning. Closing uses effectiveTo.</div>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label>Notes (optional)</Label>
              <Textarea value={form.notes || ""} onChange={(e) => patch({ notes: e.target.value })} className="min-h-[90px]" />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label>Status</Label>
              <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                <Switch checked={Boolean(form.isActive)} onCheckedChange={(v) => patch({ isActive: v })} />
                <div className="text-sm">
                  <div className="font-semibold text-zc-text">{form.isActive ? "Active" : "Inactive"}</div>
                  <div className="text-xs text-zc-muted">Inactive rates shouldn’t be used for new billing</div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
