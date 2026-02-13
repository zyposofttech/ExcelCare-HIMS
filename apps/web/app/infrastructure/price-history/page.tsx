"use client";

import * as React from "react";
import { AppShell } from "@/components/AppShell";
import { RequirePerm } from "@/components/RequirePerm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowDown,
  ArrowUp,
  History,
  RefreshCw,
  Search,
} from "lucide-react";

/* Types */
type BranchRow = { id: string; code: string; name: string; city: string };
type PriceHistoryRow = {
  id: string;
  branchId: string;
  serviceItemId?: string | null;
  chargeMasterItemId?: string | null;
  tariffRateId?: string | null;
  oldPrice: number;
  newPrice: number;
  changeAmount: number;
  changePercent: number;
  changeReason?: string | null;
  effectiveFrom: string;
  effectiveTill?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  serviceItem?: { id: string; code: string; name: string } | null;
  chargeMasterItem?: { id: string; code: string; name: string } | null;
  approvedByUser?: { id: string; name: string } | null;
  createdByUser?: { id: string; name: string } | null;
};

/* Utils */
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

function fmtDate(d?: string | null) {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

function fmtCurrency(v: number | null | undefined) {
  if (v === null || v === undefined) return "-";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(v);
}

function fmtPercent(v: number | null | undefined) {
  if (v === null || v === undefined) return "-";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
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

/* Page */
export default function PriceHistoryPage() {
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
  const [rows, setRows] = React.useState<PriceHistoryRow[]>([]);
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  // AI Copilot
  const { insights, loading: insightsLoading, dismiss: dismissInsight } = usePageInsights({
    module: "price-history",
    enabled: !!branchId,
  });

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

  async function loadHistory(showToast = false, targetBranchId?: string) {
    const target = targetBranchId || branchId;
    if (!target) return;
    setErr(null);
    setLoading(true);
    try {
      const qs = buildQS({
        branchId: target,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        take: 200,
      });
      const res = await apiTry<any>(
        `/api/infrastructure/price-history?${qs}`,
        `/api/infra/price-history?${qs}`,
      );
      const list: PriceHistoryRow[] = Array.isArray(res) ? res : res?.rows || [];
      setRows(list);
      if (showToast) toast({ title: "History refreshed" });
    } catch (e: any) {
      const msg = e?.message || "Failed to load price history";
      setErr(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll(showToast = false) {
    setLoading(true);
    setErr(null);
    try {
      const bid = branchId || (await loadBranches());
      if (!bid) { setLoading(false); return; }
      await loadHistory(false, bid);
      if (showToast) toast({ title: "Ready" });
    } catch (e: any) {
      setErr(e?.message || "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { void refreshAll(false); }, []);
  React.useEffect(() => { if (branchId) void loadHistory(false); }, [branchId]);
  React.useEffect(() => {
    if (!branchId) return;
    const t = setTimeout(() => void loadHistory(false), 400);
    return () => clearTimeout(t);
  }, [dateFrom, dateTo]);

  function onBranchChange(nextId: string) {
    setBranchId(nextId);
    if (isGlobalScope) setActiveBranchId(nextId || null);
    setDateFrom("");
    setDateTo("");
    void loadHistory(false, nextId);
  }

  const stats = React.useMemo(() => {
    const total = rows.length;
    const increases = rows.filter((r) => r.newPrice > r.oldPrice).length;
    const decreases = rows.filter((r) => r.newPrice < r.oldPrice).length;
    const avgChange = total > 0 ? rows.reduce((s, r) => s + r.changePercent, 0) / total : 0;
    return { total, increases, decreases, avgChange };
  }, [rows]);

  return (
    <AppShell title="Infrastructure - Price History">
      <RequirePerm perm="INFRA_PRICE_HISTORY_READ">
        <div className="grid gap-6">
          {/* Header */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
                <History className="h-5 w-5 text-zc-accent" />
              </span>
              <div className="min-w-0">
                <div className="text-3xl font-semibold tracking-tight">Price History</div>
                <div className="mt-1 text-sm text-zc-muted">
                  Track all price changes across services and charge master items.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="px-5 gap-2" onClick={() => refreshAll(true)} disabled={loading}>
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh
              </Button>
            </div>
          </div>

          {err && (
            <Card className="border-zc-danger/40">
              <CardHeader className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-zc-danger" />
                  <div>
                    <CardTitle className="text-base">Could not load price history</CardTitle>
                    <CardDescription className="mt-1">{err}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          <PageInsightBanner insights={insights} loading={insightsLoading} onDismiss={dismissInsight} />

          {/* Filters & Stats */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Filters</CardTitle>
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

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>From Date</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={!branchId} />
                </div>
                <div className="grid gap-2">
                  <Label>To Date</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={!branchId} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Changes</div>
                  <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{stats.total}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Price Increases</div>
                  <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{stats.increases}</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-900/10">
                  <div className="text-xs font-medium text-rose-600 dark:text-rose-400">Price Decreases</div>
                  <div className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">{stats.decreases}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-900/50 dark:bg-slate-900/10">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Avg Change %</div>
                  <div className="mt-1 text-lg font-bold text-slate-700 dark:text-slate-300">{stats.avgChange.toFixed(2)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Change Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-zc-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-[110px]">Old Price</TableHead>
                      <TableHead className="w-[110px]">New Price</TableHead>
                      <TableHead className="w-[90px]">Change</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="w-[110px]">Effective</TableHead>
                      <TableHead className="w-[120px]">Changed By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                      ))
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                            <History className="h-4 w-4" /> No price changes found.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => {
                        const isIncrease = r.newPrice > r.oldPrice;
                        const isDecrease = r.newPrice < r.oldPrice;
                        const itemName = r.serviceItem?.name || r.chargeMasterItem?.name || "-";
                        const itemCode = r.serviceItem?.code || r.chargeMasterItem?.code || "";
                        const itemType = r.serviceItem ? "Service" : r.chargeMasterItem ? "Charge" : "-";

                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <div className="font-semibold text-zc-text">{itemName}</div>
                              <div className="flex items-center gap-2 text-xs text-zc-muted">
                                {itemCode && <span className="font-mono">{itemCode}</span>}
                                <Badge variant="secondary" className="text-[10px]">{itemType}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{fmtCurrency(r.oldPrice)}</TableCell>
                            <TableCell className="font-mono text-sm">{fmtCurrency(r.newPrice)}</TableCell>
                            <TableCell>
                              <div className={cn(
                                "flex items-center gap-1 text-sm font-semibold",
                                isIncrease && "text-emerald-600 dark:text-emerald-400",
                                isDecrease && "text-rose-600 dark:text-rose-400",
                                !isIncrease && !isDecrease && "text-zc-muted",
                              )}>
                                {isIncrease && <ArrowUp className="h-3 w-3" />}
                                {isDecrease && <ArrowDown className="h-3 w-3" />}
                                {fmtPercent(r.changePercent)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[180px] truncate text-sm text-zc-muted">
                                {r.changeReason || "-"}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{fmtDate(r.effectiveFrom)}</TableCell>
                            <TableCell className="text-sm text-zc-muted">{r.createdByUser?.name || "-"}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-zc-border p-4">
                  <div className="text-sm text-zc-muted">
                    Total: <span className="font-semibold text-zc-text">{rows.length}</span>
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
