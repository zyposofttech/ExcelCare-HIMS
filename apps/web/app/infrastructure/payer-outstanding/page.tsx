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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useBranchContext } from "@/lib/branch/useBranchContext";
import { useActiveBranchStore } from "@/lib/branch/active-branch";
import { usePageInsights } from "@/lib/copilot/usePageInsights";
import { PageInsightBanner } from "@/components/copilot/PageInsightBanner";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  DollarSign,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type BranchRow = { id: string; code: string; name: string; city: string };

type PayerRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  status: string;
  isActive: boolean;
  creditDays?: number | null;
  creditLimit?: number | string | null;
  gracePeriodDays?: number | null;
};

type PayerContractRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  payerId: string;
  payer?: { id: string; name: string; code: string } | null;
  _count?: { contractRates: number };
};

/* Computed outstanding row (derived from payer + contracts data) */
type OutstandingRow = {
  payerId: string;
  payerCode: string;
  payerName: string;
  payerKind: string;
  payerStatus: string;
  creditLimit: number;
  creditDays: number;
  gracePeriod: number;
  activeContracts: number;
  totalRates: number;
  // NOTE: Actual outstanding amounts would come from billing module.
  // Since PayerOutstanding model doesn't exist in schema yet,
  // we show payer credit configuration and contract summary.
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

function fmtCurrency(v?: number | string | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

function kindBadge(kind: string) {
  switch (kind) {
    case "INSURANCE": return <Badge variant="info">Insurance</Badge>;
    case "TPA": return <Badge variant="secondary">TPA</Badge>;
    case "CORPORATE": return <Badge variant="ok">Corporate</Badge>;
    case "GOVERNMENT": return <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800">Govt</Badge>;
    case "TRUST": return <Badge variant="warning">Trust</Badge>;
    case "EMPLOYEE": return <Badge variant="secondary">Employee</Badge>;
    default: return <Badge variant="secondary">{kind}</Badge>;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE": return <Badge variant="ok">Active</Badge>;
    case "INACTIVE": return <Badge variant="secondary">Inactive</Badge>;
    case "SUSPENDED": return <Badge variant="warning">Suspended</Badge>;
    case "BLOCKED": return <Badge variant="destructive">Blocked</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
}

function creditUtilBadge(utilPercent: number) {
  if (utilPercent >= 90) return <Badge variant="destructive">{utilPercent.toFixed(0)}%</Badge>;
  if (utilPercent >= 70) return <Badge variant="warning">{utilPercent.toFixed(0)}%</Badge>;
  return <Badge variant="ok">{utilPercent.toFixed(0)}%</Badge>;
}

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function PayerOutstandingPage() {
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
  const [payers, setPayers] = React.useState<PayerRow[]>([]);
  const [contracts, setContracts] = React.useState<PayerContractRow[]>([]);
  const [q, setQ] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState<string>("all");

  // AI Copilot
  const { insights, loading: insightsLoading, dismiss: dismissInsight } = usePageInsights({
    module: "payer-outstanding",
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

  async function loadPayers(bid: string) {
    try {
      const qs = buildQS({ branchId: bid, take: 500 });
      const res = await apiTry<any>(
        `/api/infrastructure/payers?${qs}`,
        `/api/infra/payers?${qs}`,
      );
      const list: PayerRow[] = Array.isArray(res) ? res : res?.rows || [];
      setPayers(list);
    } catch {
      setPayers([]);
    }
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

  async function refreshAll(showToast = false) {
    setLoading(true);
    setErr(null);
    try {
      const bid = branchId || (await loadBranches());
      if (!bid) { setLoading(false); return; }
      await Promise.all([loadPayers(bid), loadContracts(bid)]);
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
      Promise.all([loadPayers(branchId), loadContracts(branchId)]).finally(() => setLoading(false));
    }
  }, [branchId]);

  function onBranchChange(nextId: string) {
    setBranchId(nextId);
    if (isGlobalScope) setActiveBranchId(nextId || null);
    setQ("");
    setKindFilter("all");
  }

  /* ---- Compute outstanding rows ---- */

  const outstandingRows = React.useMemo<OutstandingRow[]>(() => {
    return payers.map((p) => {
      const payerContracts = contracts.filter((c) => c.payerId === p.id);
      const activeContracts = payerContracts.filter((c) => c.status === "ACTIVE").length;
      const totalRates = payerContracts.reduce((sum, c) => sum + (c._count?.contractRates ?? 0), 0);
      return {
        payerId: p.id,
        payerCode: p.code,
        payerName: p.name,
        payerKind: p.kind,
        payerStatus: p.status,
        creditLimit: typeof p.creditLimit === "number" ? p.creditLimit : Number(p.creditLimit) || 0,
        creditDays: p.creditDays ?? 0,
        gracePeriod: p.gracePeriodDays ?? 0,
        activeContracts,
        totalRates,
      };
    });
  }, [payers, contracts]);

  const filtered = React.useMemo(() => {
    let list = outstandingRows;
    if (q.trim()) {
      const lq = q.toLowerCase();
      list = list.filter((r) => r.payerName.toLowerCase().includes(lq) || r.payerCode.toLowerCase().includes(lq));
    }
    if (kindFilter !== "all") {
      list = list.filter((r) => r.payerKind === kindFilter);
    }
    return list;
  }, [outstandingRows, q, kindFilter]);

  /* ---- Stats ---- */

  const stats = React.useMemo(() => {
    const totalPayers = outstandingRows.length;
    const withCredit = outstandingRows.filter((r) => r.creditLimit > 0).length;
    const totalCreditLimit = outstandingRows.reduce((s, r) => s + r.creditLimit, 0);
    const totalActiveContracts = outstandingRows.reduce((s, r) => s + r.activeContracts, 0);
    const avgCreditDays = totalPayers > 0
      ? Math.round(outstandingRows.reduce((s, r) => s + r.creditDays, 0) / totalPayers)
      : 0;
    const blockedOrSuspended = outstandingRows.filter((r) => r.payerStatus === "BLOCKED" || r.payerStatus === "SUSPENDED").length;
    return { totalPayers, withCredit, totalCreditLimit, totalActiveContracts, avgCreditDays, blockedOrSuspended };
  }, [outstandingRows]);

  /* ---- Render ---- */

  return (
    <AppShell title="Infrastructure - Payer Outstanding & Credit">
      <RequirePerm perm="INFRA_PAYER_READ">
        <div className="grid gap-6">
          {/* Header */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
                <CreditCard className="h-5 w-5 text-zc-accent" />
              </span>
              <div className="min-w-0">
                <div className="text-3xl font-semibold tracking-tight">Payer Outstanding & Credit</div>
                <div className="mt-1 text-sm text-zc-muted">
                  Monitor payer credit limits, outstanding balances, and aging analysis.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="px-5 gap-2" onClick={() => refreshAll(true)} disabled={loading}>
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh
              </Button>
              <Button variant="outline" asChild className="px-5 gap-2">
                <Link href="/infrastructure/payers">Payers</Link>
              </Button>
              <Button variant="outline" asChild className="px-5 gap-2">
                <Link href="/infrastructure/payer-contracts">Contracts</Link>
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
              <CardTitle className="text-base">Credit Overview</CardTitle>
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

              {/* Stats cards */}
              <div className="grid gap-3 md:grid-cols-6">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Payers</div>
                  <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{stats.totalPayers}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">With Credit</div>
                  <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{stats.withCredit}</div>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-900/10">
                  <div className="text-xs font-medium text-violet-600 dark:text-violet-400">Total Credit Limit</div>
                  <div className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-300">{fmtCurrency(stats.totalCreditLimit)}</div>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900/50 dark:bg-sky-900/10">
                  <div className="text-xs font-medium text-sky-600 dark:text-sky-400">Active Contracts</div>
                  <div className="mt-1 text-lg font-bold text-sky-700 dark:text-sky-300">{stats.totalActiveContracts}</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
                  <div className="text-xs font-medium text-amber-700 dark:text-amber-300">Avg Credit Days</div>
                  <div className="mt-1 text-lg font-bold text-amber-800 dark:text-amber-200">{stats.avgCreditDays}</div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-900/50 dark:bg-red-900/10">
                  <div className="text-xs font-medium text-red-600 dark:text-red-400">Blocked/Suspended</div>
                  <div className="mt-1 text-lg font-bold text-red-700 dark:text-red-300">{stats.blockedOrSuspended}</div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search payers..." className="pl-10" disabled={!branchId} />
                </div>
                <div className="flex items-center gap-3">
                  <Select value={kindFilter} onValueChange={setKindFilter}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="INSURANCE">Insurance</SelectItem>
                      <SelectItem value="TPA">TPA</SelectItem>
                      <SelectItem value="CORPORATE">Corporate</SelectItem>
                      <SelectItem value="GOVERNMENT">Government</SelectItem>
                      <SelectItem value="TRUST">Trust</SelectItem>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credit Monitoring Table */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Payer Credit & Contract Summary</CardTitle>
              <CardDescription>
                View credit configuration, active contracts, and contract rate counts per payer.
                Actual outstanding amounts and aging analysis will be computed from billing data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-zc-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Code</TableHead>
                      <TableHead>Payer</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[130px] text-right">Credit Limit</TableHead>
                      <TableHead className="w-[90px] text-center">Credit Days</TableHead>
                      <TableHead className="w-[80px] text-center">Grace</TableHead>
                      <TableHead className="w-[100px] text-center">Contracts</TableHead>
                      <TableHead className="w-[80px] text-center">Rates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                      ))
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                            <CreditCard className="h-4 w-4" /> No payers found.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((r) => (
                        <TableRow key={r.payerId} className="hover:bg-zc-panel/20">
                          <TableCell className="font-mono text-xs font-semibold">{r.payerCode}</TableCell>
                          <TableCell>
                            <div className="font-semibold text-zc-text">{r.payerName}</div>
                          </TableCell>
                          <TableCell>{kindBadge(r.payerKind)}</TableCell>
                          <TableCell>{statusBadge(r.payerStatus)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {r.creditLimit > 0 ? (
                              <span className="font-semibold">{fmtCurrency(r.creditLimit)}</span>
                            ) : (
                              <span className="text-zc-muted">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.creditDays > 0 ? (
                              <span className="font-semibold">{r.creditDays}d</span>
                            ) : (
                              <span className="text-zc-muted">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.gracePeriod > 0 ? `${r.gracePeriod}d` : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.activeContracts > 0 ? (
                              <Badge variant="ok" className="text-xs">{r.activeContracts}</Badge>
                            ) : (
                              <span className="text-zc-muted text-xs">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.totalRates > 0 ? (
                              <span className="font-mono text-sm font-semibold">{r.totalRates}</span>
                            ) : (
                              <span className="text-zc-muted text-xs">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-zc-border p-4">
                  <div className="text-sm text-zc-muted">
                    Showing <span className="font-semibold text-zc-text">{filtered.length}</span> of{" "}
                    <span className="font-semibold text-zc-text">{outstandingRows.length}</span> payers
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-blue-200/50 bg-blue-50/20 dark:border-blue-900/50 dark:bg-blue-900/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <DollarSign className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    Aging Analysis Coming Soon
                  </div>
                  <div className="mt-1 text-xs text-blue-600/70 dark:text-blue-400/70">
                    Once billing transactions are recorded, this page will show real-time outstanding amounts,
                    aging buckets (0-30, 31-60, 61-90, 90+ days), credit utilization percentages,
                    and automated payment reminder capabilities. Currently showing payer credit configuration
                    and contract summary.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </RequirePerm>
    </AppShell>
  );
}
