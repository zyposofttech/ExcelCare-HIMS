"use client";

import * as React from "react";
import { AppLink as Link } from "@/components/app-link";
import { AppShell } from "@/components/AppShell";
import { RequirePerm } from "@/components/RequirePerm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useBranchContext } from "@/lib/branch/useBranchContext";
import { useActiveBranchStore } from "@/lib/branch/active-branch";
import { usePageInsights } from "@/lib/copilot/usePageInsights";
import { PageInsightBanner } from "@/components/copilot/PageInsightBanner";
import {
  AlertTriangle,
  Clock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type BranchRow = { id: string; code: string; name: string; city: string };

type PayerContractRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  payerId: string;
  payer?: { id: string; name: string; code: string } | null;
  pricingStrategy?: string | null;
  emergencyLoadingPercent?: number | string | null;
  afterHoursLoadingPercent?: number | string | null;
  weekendLoadingPercent?: number | string | null;
  statLoadingPercent?: number | string | null;
};

type PricingTierRow = {
  id: string;
  branchId: string;
  kind: string;
  name: string;
  code: string;
  description?: string | null;
  defaultDiscountPercent?: number | string | null;
  defaultMarkupPercent?: number | string | null;
  maxDiscountCap?: number | string | null;
  sortOrder: number;
  isActive: boolean;
  assignmentRules?: any;
  _count?: { rates: number };
};

/* -------------------------------------------------------------------------- */
/*                                   Utils                                    */
/* -------------------------------------------------------------------------- */

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

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-zc-panel/30", className)} />;
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

function fmtPercent(v?: number | string | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `${n}%` : "—";
}

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function PricingRulesPage() {
  const { toast } = useToast();
  const branchCtx = useBranchContext();
  const activeBranchId = useActiveBranchStore((s) => s.activeBranchId);
  const setActiveBranchId = useActiveBranchStore((s) => s.setActiveBranchId);

  const isGlobalScope = branchCtx.scope === "GLOBAL";
  const effectiveBranchId = branchCtx.branchId ?? activeBranchId ?? "";

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState<string>("");
  const [contracts, setContracts] = React.useState<PayerContractRow[]>([]);
  const [tiers, setTiers] = React.useState<PricingTierRow[]>([]);

  // AI Copilot
  const { insights, loading: insightsLoading, dismiss: dismissInsight } = usePageInsights({
    module: "pricing-rules",
    enabled: !!branchId,
  });

  /* ---- Data loading ---- */

  async function loadBranches(): Promise<string | null> {
    const list = (await apiFetch<BranchRow[]>("/api/branches")) || [];
    setBranches(list);
    const stored = effectiveBranchId || null;
    const first = list[0]?.id || null;
    const next = (stored && list.some((b) => b.id === stored) ? stored : null) || first;
    if (next) if (isGlobalScope) setActiveBranchId(next || null);
    setBranchId(next || "");
    return next;
  }

  async function loadContracts(bid: string) {
    try {
      const qs = buildQS({ branchId: bid, includeRefs: "true" });
      const res = await apiTry<any>(
        `/api/infrastructure/payer-contracts?${qs}`,
        `/api/infra/payer-contracts?${qs}`,
      );
      const list: PayerContractRow[] = Array.isArray(res) ? res : res?.rows || [];
      setContracts(list);
    } catch {
      setContracts([]);
    }
  }

  async function loadTiers(bid: string) {
    try {
      const qs = buildQS({ branchId: bid });
      const res = await apiTry<any>(
        `/api/infrastructure/pricing-tiers?${qs}`,
        `/api/billing/pricing-tiers?${qs}`,
      );
      const list: PricingTierRow[] = Array.isArray(res) ? res : res?.rows || [];
      setTiers(list);
    } catch {
      setTiers([]);
    }
  }

  async function refreshAll(showToast = false) {
    setLoading(true);
    setErr(null);
    try {
      const bid = branchId || (await loadBranches());
      if (!bid) { setLoading(false); return; }
      await Promise.all([loadContracts(bid), loadTiers(bid)]);
      if (showToast) toast({ title: "Refreshed" });
    } catch (e: any) {
      setErr(e?.message || "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { void refreshAll(false); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (branchId) {
      setLoading(true);
      Promise.all([loadContracts(branchId), loadTiers(branchId)]).finally(() => setLoading(false));
    }
  }, [branchId]);

  function onBranchChange(nextId: string) {
    setBranchId(nextId);
    if (isGlobalScope) setActiveBranchId(nextId || null);
  }

  /* ---- Stats ---- */
  const stats = React.useMemo(() => {
    const withEmergencyLoading = contracts.filter((c) => Number(c.emergencyLoadingPercent) > 0).length;
    const withAfterHours = contracts.filter((c) => Number(c.afterHoursLoadingPercent) > 0).length;
    const withWeekend = contracts.filter((c) => Number(c.weekendLoadingPercent) > 0).length;
    const withStat = contracts.filter((c) => Number(c.statLoadingPercent) > 0).length;
    const activeTiers = tiers.filter((t) => t.isActive).length;
    return { withEmergencyLoading, withAfterHours, withWeekend, withStat, activeTiers, totalTiers: tiers.length, totalContracts: contracts.length };
  }, [contracts, tiers]);

  /* ---- Render ---- */

  return (
    <AppShell title="Infrastructure - Pricing Rules & Surcharges">
      <RequirePerm perm="INFRA_PRICING_TIER_READ">
        <div className="grid gap-6">
          {/* Header */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
                <Clock className="h-5 w-5 text-zc-accent" />
              </span>
              <div className="min-w-0">
                <div className="text-3xl font-semibold tracking-tight">Pricing Rules & Surcharges</div>
                <div className="mt-1 text-sm text-zc-muted">
                  Configure time-based surcharges, patient category discounts, and pricing tier rules.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="px-5 gap-2" onClick={() => refreshAll(true)} disabled={loading}>
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh
              </Button>
              <Button variant="outline" asChild className="px-5 gap-2">
                <Link href="/infrastructure/pricing-tiers">Pricing Tiers</Link>
              </Button>
              <Button variant="outline" asChild className="px-5 gap-2">
                <Link href="/infrastructure/payer-contracts">Payer Contracts</Link>
              </Button>
            </div>
          </div>

          {err && (
            <Card className="border-zc-danger/40">
              <CardHeader className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-zc-danger" />
                  <div>
                    <CardTitle className="text-base">Error</CardTitle>
                    <CardDescription className="mt-1">{err}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Overview */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Configuration Overview</CardTitle>
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

              <PageInsightBanner insights={insights} loading={insightsLoading} onDismiss={dismissInsight} />

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-900/50 dark:bg-red-900/10">
                  <div className="text-xs font-medium text-red-600 dark:text-red-400">Emergency Loading</div>
                  <div className="mt-1 text-lg font-bold text-red-700 dark:text-red-300">{stats.withEmergencyLoading} contracts</div>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-900/10">
                  <div className="text-xs font-medium text-violet-600 dark:text-violet-400">After-Hours</div>
                  <div className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-300">{stats.withAfterHours} contracts</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
                  <div className="text-xs font-medium text-amber-700 dark:text-amber-300">Weekend Loading</div>
                  <div className="mt-1 text-lg font-bold text-amber-800 dark:text-amber-200">{stats.withWeekend} contracts</div>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900/50 dark:bg-sky-900/10">
                  <div className="text-xs font-medium text-sky-600 dark:text-sky-400">STAT Surcharge</div>
                  <div className="mt-1 text-lg font-bold text-sky-700 dark:text-sky-300">{stats.withStat} contracts</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time-Based Surcharges (from Contracts) */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Time-Based Surcharges by Contract</CardTitle>
              <CardDescription>
                Surcharge percentages configured on each payer contract for emergency, after-hours, weekend, and STAT scenarios.
                Edit these values in the <Link href="/infrastructure/payer-contracts" className="text-blue-600 underline">Payer Contracts</Link> page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-zc-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Code</TableHead>
                      <TableHead>Contract / Payer</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[100px] text-center">Emergency</TableHead>
                      <TableHead className="w-[100px] text-center">After-Hours</TableHead>
                      <TableHead className="w-[100px] text-center">Weekend</TableHead>
                      <TableHead className="w-[100px] text-center">STAT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                      ))
                    ) : contracts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                            <Clock className="h-4 w-4" /> No contracts found.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      contracts.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs font-semibold">{c.code}</TableCell>
                          <TableCell>
                            <div className="font-semibold text-zc-text">{c.name}</div>
                            {c.payer && <div className="text-xs text-blue-600 dark:text-blue-400">{c.payer.name}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={c.status === "ACTIVE" ? "ok" : c.status === "DRAFT" ? "secondary" : "warning"}>
                              {c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(c.emergencyLoadingPercent) > 0 ? (
                              <Badge variant="destructive" className="text-xs">{fmtPercent(c.emergencyLoadingPercent)}</Badge>
                            ) : <span className="text-zc-muted text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(c.afterHoursLoadingPercent) > 0 ? (
                              <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800 text-xs">
                                {fmtPercent(c.afterHoursLoadingPercent)}
                              </Badge>
                            ) : <span className="text-zc-muted text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(c.weekendLoadingPercent) > 0 ? (
                              <Badge variant="warning" className="text-xs">{fmtPercent(c.weekendLoadingPercent)}</Badge>
                            ) : <span className="text-zc-muted text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(c.statLoadingPercent) > 0 ? (
                              <Badge variant="info" className="text-xs">{fmtPercent(c.statLoadingPercent)}</Badge>
                            ) : <span className="text-zc-muted text-xs">—</span>}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Patient Category Discounts (from Pricing Tiers) */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Patient Category Discounts</CardTitle>
              <CardDescription>
                Pricing tiers for different patient categories (Senior Citizen, Staff, BPL, etc.).
                Manage these in the <Link href="/infrastructure/pricing-tiers" className="text-blue-600 underline">Pricing Tiers</Link> page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-zc-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Code</TableHead>
                      <TableHead>Tier Name</TableHead>
                      <TableHead className="w-[100px]">Kind</TableHead>
                      <TableHead className="w-[100px] text-center">Discount %</TableHead>
                      <TableHead className="w-[100px] text-center">Markup %</TableHead>
                      <TableHead className="w-[120px] text-center">Max Cap</TableHead>
                      <TableHead className="w-[80px] text-center">Active</TableHead>
                      <TableHead className="w-[80px] text-center">Rates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                      ))
                    ) : tiers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                            No pricing tiers configured.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      tiers
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs font-semibold">{t.code}</TableCell>
                          <TableCell>
                            <div className="font-semibold text-zc-text">{t.name}</div>
                            {t.description && <div className="text-xs text-zc-muted truncate max-w-[200px]">{t.description}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {t.kind.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(t.defaultDiscountPercent) > 0 ? (
                              <span className="font-semibold text-emerald-600">{fmtPercent(t.defaultDiscountPercent)}</span>
                            ) : <span className="text-zc-muted">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(t.defaultMarkupPercent) > 0 ? (
                              <span className="font-semibold text-red-600">{fmtPercent(t.defaultMarkupPercent)}</span>
                            ) : <span className="text-zc-muted">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {t.maxDiscountCap != null && Number(t.maxDiscountCap) > 0 ? (
                              <span className="font-mono text-sm">₹{Number(t.maxDiscountCap).toLocaleString("en-IN")}</span>
                            ) : <span className="text-zc-muted">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {t.isActive ? (
                              <Badge variant="ok" className="text-xs">Yes</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">No</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {t._count?.rates ?? 0}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Time Slot Reference */}
          <Card className="border-blue-200/50 bg-blue-50/20 dark:border-blue-900/50 dark:bg-blue-900/5">
            <CardHeader className="py-4">
              <CardTitle className="text-base text-blue-700 dark:text-blue-300">Standard Time Slot Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-5 text-sm">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                  <div className="font-semibold text-emerald-700 dark:text-emerald-300">Office Hours</div>
                  <div className="text-xs text-emerald-600/80 dark:text-emerald-400/80">8 AM – 6 PM</div>
                  <div className="mt-1 font-mono font-bold text-emerald-700 dark:text-emerald-300">Normal Rate</div>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/40 dark:bg-violet-900/10">
                  <div className="font-semibold text-violet-700 dark:text-violet-300">After Hours</div>
                  <div className="text-xs text-violet-600/80 dark:text-violet-400/80">6 PM – 10 PM</div>
                  <div className="mt-1 font-mono font-bold text-violet-700 dark:text-violet-300">+15%</div>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-900/10">
                  <div className="font-semibold text-indigo-700 dark:text-indigo-300">Night</div>
                  <div className="text-xs text-indigo-600/80 dark:text-indigo-400/80">10 PM – 8 AM</div>
                  <div className="mt-1 font-mono font-bold text-indigo-700 dark:text-indigo-300">+25%</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-900/10">
                  <div className="font-semibold text-amber-700 dark:text-amber-300">Weekends</div>
                  <div className="text-xs text-amber-600/80 dark:text-amber-400/80">Sat / Sun</div>
                  <div className="mt-1 font-mono font-bold text-amber-700 dark:text-amber-300">+10%</div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-900/40 dark:bg-red-900/10">
                  <div className="font-semibold text-red-700 dark:text-red-300">Emergency</div>
                  <div className="text-xs text-red-600/80 dark:text-red-400/80">Any time</div>
                  <div className="mt-1 font-mono font-bold text-red-700 dark:text-red-300">+30%</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-blue-600/70 dark:text-blue-400/70">
                These are standard reference rates. Actual surcharges per payer are configured in individual Payer Contracts.
                Time-based surcharges can be cumulative (e.g., Emergency + Night = 30% + 25% = 55% surcharge).
              </div>
            </CardContent>
          </Card>
        </div>
      </RequirePerm>
    </AppShell>
  );
}
