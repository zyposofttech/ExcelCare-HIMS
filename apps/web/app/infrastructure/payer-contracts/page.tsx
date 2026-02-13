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
import { Textarea } from "@/components/ui/textarea";
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
import { useBranchContext } from "@/lib/branch/useBranchContext";
import { useActiveBranchStore } from "@/lib/branch/active-branch";
import { usePageInsights } from "@/lib/copilot/usePageInsights";
import { PageInsightBanner } from "@/components/copilot/PageInsightBanner";
import {
  AlertTriangle,
  DollarSign,
  Eye,
  FileText,
  Layers,
  MoreHorizontal,
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

type PayerRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  status: string;
  isActive: boolean;
};

type PricingStrategy = "GLOBAL_DISCOUNT" | "CATEGORY_WISE" | "SERVICE_SPECIFIC";

type PayerContractRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  priority: number;
  startAt?: string | null;
  endAt?: string | null;
  pricingStrategy?: PricingStrategy | string | null;
  globalDiscountPercent?: number | string | null;
  emergencyLoadingPercent?: number | string | null;
  afterHoursLoadingPercent?: number | string | null;
  weekendLoadingPercent?: number | string | null;
  statLoadingPercent?: number | string | null;
  copaymentRules?: any | null;
  excludedServiceIds?: string[];
  excludedCategories?: string[];
  approvalStatus?: string | null;
  gracePeriodDays?: number | null;
  autoRenewal: boolean;
  payerId: string;
  payer?: { id: string; name: string; code: string; kind: string } | null;
  tariffPlans?: { id: string; name: string }[];
  _count?: { contractRates: number };
};

type ContractServiceRateRow = {
  id: string;
  contractId: string;
  serviceItemId?: string | null;
  serviceItem?: { id: string; code: string; name: string } | null;
  packageId?: string | null;
  pkg?: { id: string; code: string; name: string } | null;
  chargeMasterItemId?: string | null;
  chargeMasterItem?: { id: string; code: string; name: string } | null;
  category?: string | null;
  rateType: string;
  fixedPrice?: number | string | null;
  percentageOfBase?: number | string | null;
  discountPercent?: number | string | null;
  minPrice?: number | string | null;
  maxPrice?: number | string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive: boolean;
  version: number;
};

type RateFormData = {
  serviceItemId: string;
  category: string;
  rateType: string;
  fixedPrice: string;
  percentageOfBase: string;
  discountPercent: string;
  minPrice: string;
  maxPrice: string;
};

type ContractFormData = {
  code: string;
  name: string;
  description: string;
  payerId: string;
  status: string;
  priority: string;
  startAt: string;
  endAt: string;
  pricingStrategy: string;
  globalDiscountPercent: string;
  emergencyLoadingPercent: string;
  afterHoursLoadingPercent: string;
  weekendLoadingPercent: string;
  statLoadingPercent: string;
  copayDefaultPercent: string;
  copayMaxAmount: string;
  copayAppliesTo: string;
  copayExemptCategories: string;
  excludedCategoriesText: string;
  gracePeriodDays: string;
  autoRenewal: boolean;
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

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE": return <Badge variant="ok">ACTIVE</Badge>;
    case "DRAFT": return <Badge variant="secondary">DRAFT</Badge>;
    case "EXPIRED": return <Badge variant="warning">EXPIRED</Badge>;
    case "SUSPENDED": return <Badge variant="destructive">SUSPENDED</Badge>;
    case "TERMINATED": return <Badge variant="destructive">TERMINATED</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
}

function approvalBadge(s?: string | null) {
  if (!s) return <Badge variant="secondary">—</Badge>;
  switch (s) {
    case "APPROVED": return <Badge variant="ok">APPROVED</Badge>;
    case "PENDING": return <Badge variant="warning">PENDING</Badge>;
    case "REJECTED": return <Badge variant="destructive" className="bg-red-600 text-white">REJECTED</Badge>;
    default: return <Badge variant="secondary">{s}</Badge>;
  }
}

function strategyLabel(s?: string | null): string {
  if (!s) return "—";
  switch (s) {
    case "GLOBAL_DISCOUNT": return "Global Discount";
    case "CATEGORY_WISE": return "Category-wise";
    case "SERVICE_SPECIFIC": return "Service-specific";
    default: return s.replace(/_/g, " ");
  }
}

function fmtPercent(v?: number | string | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? `${n}%` : "—";
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString(); } catch { return String(v); }
}

function drawerClassName(extra?: string) {
  return cn(
    "left-auto right-0 top-0 h-screen w-[95vw] max-w-[1080px] translate-x-0 translate-y-0",
    "rounded-2xl",
    "border border-indigo-200/50 dark:border-indigo-800/50 bg-zc-card",
    "shadow-2xl shadow-indigo-500/10",
    "overflow-y-auto",
    extra,
  );
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

function emptyForm(): ContractFormData {
  return {
    code: "",
    name: "",
    description: "",
    payerId: "",
    status: "DRAFT",
    priority: "100",
    startAt: "",
    endAt: "",
    pricingStrategy: "",
    globalDiscountPercent: "",
    emergencyLoadingPercent: "",
    afterHoursLoadingPercent: "",
    weekendLoadingPercent: "",
    statLoadingPercent: "",
    copayDefaultPercent: "",
    copayMaxAmount: "",
    copayAppliesTo: "",
    copayExemptCategories: "",
    excludedCategoriesText: "",
    gracePeriodDays: "",
    autoRenewal: false,
  };
}

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function PayerContractsPage() {
  const { toast } = useToast();
  const branchCtx = useBranchContext();
  const activeBranchId = useActiveBranchStore((s) => s.activeBranchId);
  const setActiveBranchId = useActiveBranchStore((s) => s.setActiveBranchId);

  const isGlobalScope = branchCtx.scope === "GLOBAL";
  const effectiveBranchId = branchCtx.branchId ?? activeBranchId ?? "";

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState<string>("");
  const [rows, setRows] = React.useState<PayerContractRow[]>([]);
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Payers list for dropdowns
  const [payers, setPayers] = React.useState<PayerRow[]>([]);

  // Create/Edit modal
  const [editOpen, setEditOpen] = React.useState(false);
  const [editMode, setEditMode] = React.useState<"create" | "edit">("create");
  const [editingRow, setEditingRow] = React.useState<PayerContractRow | null>(null);

  // Detail viewer
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailRow, setDetailRow] = React.useState<PayerContractRow | null>(null);

  // AI Copilot
  const { insights, loading: insightsLoading, dismiss: dismissInsight } = usePageInsights({
    module: "payer-contracts",
    enabled: !!branchId,
  });

  // Contract Service Rates
  const [ratesOpen, setRatesOpen] = React.useState(false);
  const [ratesContract, setRatesContract] = React.useState<PayerContractRow | null>(null);
  const [rates, setRates] = React.useState<ContractServiceRateRow[]>([]);
  const [ratesLoading, setRatesLoading] = React.useState(false);
  const [serviceItems, setServiceItems] = React.useState<{id:string;code:string;name:string;category:string}[]>([]);

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
      const qs = buildQS({ branchId: bid });
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

  async function loadContracts(showToast = false, targetBranchId?: string) {
    const target = targetBranchId || branchId;
    if (!target) return;
    setErr(null);
    setLoading(true);
    try {
      const qs = buildQS({
        branchId: target,
        q: q.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        includeRefs: "true",
      });
      const res = await apiTry<any>(
        `/api/infrastructure/payer-contracts?${qs}`,
        `/api/infra/payer-contracts?${qs}`,
      );
      const list: PayerContractRow[] = Array.isArray(res) ? res : res?.rows || [];
      setRows(list);
      if (showToast) toast({ title: "Contracts refreshed" });
    } catch (e: any) {
      const msg = e?.message || "Failed to load contracts";
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
      await Promise.all([loadContracts(false, bid), loadPayers(bid)]);
      if (showToast) toast({ title: "Ready" });
    } catch (e: any) {
      setErr(e?.message || "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadContractRates(contractId: string) {
    setRatesLoading(true);
    try {
      const res = await apiTry<any>(
        `/api/infrastructure/payer-contracts/${contractId}/rates?includeRefs=true`,
        `/api/infra/payer-contracts/${contractId}/rates?includeRefs=true`,
      );
      const list: ContractServiceRateRow[] = Array.isArray(res) ? res : res?.rows || [];
      setRates(list);
    } catch {
      setRates([]);
    } finally {
      setRatesLoading(false);
    }
  }

  async function loadServiceItemsForRates() {
    try {
      const qs = buildQS({ branchId, take: 500 });
      const res = await apiTry<any>(
        `/api/infrastructure/service-items?${qs}`,
        `/api/billing/service-items?${qs}`,
      );
      const list = Array.isArray(res) ? res : res?.rows || [];
      setServiceItems(list.map((s: any) => ({ id: s.id, code: s.code, name: s.name, category: s.category || "" })));
    } catch {
      setServiceItems([]);
    }
  }

  function openRates(row: PayerContractRow) {
    setRatesContract(row);
    setRatesOpen(true);
    void loadContractRates(row.id);
    void loadServiceItemsForRates();
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { void refreshAll(false); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (branchId) void loadContracts(false); }, [branchId, statusFilter]);
  React.useEffect(() => {
    if (!branchId) return;
    const t = setTimeout(() => void loadContracts(false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function onBranchChange(nextId: string) {
    setBranchId(nextId);
    if (isGlobalScope) setActiveBranchId(nextId || null);
    setQ("");
    setStatusFilter("all");
    void loadContracts(false, nextId);
    void loadPayers(nextId);
  }

  /* ---- Actions ---- */

  function openCreate() {
    setEditMode("create");
    setEditingRow(null);
    setEditOpen(true);
  }

  function openEdit(row: PayerContractRow) {
    setEditMode("edit");
    setEditingRow(row);
    setEditOpen(true);
  }

  function openDetail(row: PayerContractRow) {
    setDetailRow(row);
    setDetailOpen(true);
  }

  async function deleteContract(row: PayerContractRow) {
    if (!row?.id) return;
    const ok = window.confirm(`Delete contract "${row.name}"? This cannot be undone.`);
    if (!ok) return;
    setBusy(true);
    try {
      await apiTry(
        `/api/infrastructure/payer-contracts/${encodeURIComponent(row.id)}`,
        `/api/infra/payer-contracts/${encodeURIComponent(row.id)}`,
        { method: "DELETE" },
      );
      toast({ title: "Deleted", description: "Contract deleted." });
      await loadContracts(false);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  /* ---- Stats ---- */

  const stats = React.useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === "ACTIVE").length;
    const draft = rows.filter((r) => r.status === "DRAFT").length;
    const expired = rows.filter((r) => r.status === "EXPIRED").length;
    const withDiscount = rows.filter((r) => r.pricingStrategy === "GLOBAL_DISCOUNT").length;
    return { total, active, draft, expired, withDiscount };
  }, [rows]);

  /* ---- Render ---- */

  return (
    <AppShell title="Infrastructure - Payer Contracts">
      <RequirePerm perm="INFRA_PAYER_CONTRACT_READ">
        <div className="grid gap-6">
          {/* Header */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
                <FileText className="h-5 w-5 text-zc-accent" />
              </span>
              <div className="min-w-0">
                <div className="text-3xl font-semibold tracking-tight">Payer Contracts</div>
                <div className="mt-1 text-sm text-zc-muted">
                  Manage contracts, pricing strategies, and service rates per payer.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="px-5 gap-2" onClick={() => refreshAll(true)} disabled={loading || busy}>
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh
              </Button>
              <Button variant="outline" asChild className="px-5 gap-2">
                <Link href="/infrastructure/payers">Payers</Link>
              </Button>
              <Button variant="primary" className="px-5 gap-2" onClick={openCreate} disabled={!branchId || busy || loading}>
                <Plus className="h-4 w-4" />
                New Contract
              </Button>
            </div>
          </div>

          {err && (
            <Card className="border-zc-danger/40">
              <CardHeader className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-zc-danger" />
                  <div>
                    <CardTitle className="text-base">Could not load contracts</CardTitle>
                    <CardDescription className="mt-1">{err}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Overview */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Overview</CardTitle>
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

              <div className="grid gap-3 md:grid-cols-5">
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Total</div>
                  <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{stats.total}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                  <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Active</div>
                  <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{stats.active}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-900/50 dark:bg-slate-900/10">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Draft</div>
                  <div className="mt-1 text-lg font-bold text-slate-700 dark:text-slate-300">{stats.draft}</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
                  <div className="text-xs font-medium text-amber-700 dark:text-amber-300">Expired</div>
                  <div className="mt-1 text-lg font-bold text-amber-800 dark:text-amber-200">{stats.expired}</div>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-900/10">
                  <div className="text-xs font-medium text-violet-600 dark:text-violet-400">Global Discount</div>
                  <div className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-300">{stats.withDiscount}</div>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contracts..." className="pl-10" disabled={!branchId} />
                </div>
                <div className="flex items-center gap-3">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="TERMINATED">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base">Contracts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-zc-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[130px]">Code</TableHead>
                      <TableHead>Name / Payer</TableHead>
                      <TableHead className="w-[130px]">Strategy</TableHead>
                      <TableHead className="w-[80px]">Priority</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[80px]">Rates</TableHead>
                      <TableHead className="w-[100px]" />
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
                            <FileText className="h-4 w-4" /> No contracts found.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow key={r.id} className="cursor-pointer hover:bg-zc-panel/20" onClick={() => openDetail(r)}>
                          <TableCell className="font-mono text-xs font-semibold">{r.code}</TableCell>
                          <TableCell>
                            <div className="font-semibold text-zc-text">{r.name}</div>
                            {r.payer ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-xs text-blue-600 dark:text-blue-400">{r.payer.name}</span>
                                <Badge variant="secondary" className="text-[10px]">{r.payer.kind}</Badge>
                              </div>
                            ) : null}
                            {r.description && <div className="text-xs text-zc-muted truncate max-w-[200px]">{r.description}</div>}
                          </TableCell>
                          <TableCell>
                            {r.pricingStrategy ? (
                              <Badge variant="secondary" className="text-[10px]">{strategyLabel(r.pricingStrategy)}</Badge>
                            ) : <span className="text-xs text-zc-muted">—</span>}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">{r.priority}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-center">{r._count?.contractRates ?? 0}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[200px]">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openRates(r)}>
                                  <DollarSign className="mr-2 h-4 w-4" /> Manage Rates
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDetail(r)}>
                                  <Eye className="mr-2 h-4 w-4" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(r)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => deleteContract(r)} className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
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

        {/* Create/Edit Dialog */}
        <ContractEditModal
          open={editOpen}
          onOpenChange={setEditOpen}
          mode={editMode}
          branchId={branchId}
          editing={editingRow}
          payers={payers}
          onSaved={async () => {
            toast({ title: "Saved", description: "Contract saved successfully." });
            await loadContracts(false);
          }}
        />

        {/* Detail Viewer */}
        <ContractDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          contract={detailRow}
        />

        {/* Contract Service Rates */}
        <ContractRatesDialog
          open={ratesOpen}
          onOpenChange={setRatesOpen}
          contract={ratesContract}
          rates={rates}
          ratesLoading={ratesLoading}
          serviceItems={serviceItems}
          branchId={branchId}
          onRatesChanged={async () => {
            if (ratesContract) await loadContractRates(ratesContract.id);
            await loadContracts(false);
          }}
        />
      </RequirePerm>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Create/Edit Dialog                               */
/* -------------------------------------------------------------------------- */

function ContractEditModal({
  open,
  onOpenChange,
  mode,
  branchId,
  editing,
  payers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  branchId: string;
  editing: PayerContractRow | null;
  payers: PayerRow[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<ContractFormData>(emptyForm());

  React.useEffect(() => {
    if (!open) return;
    if (mode === "edit" && editing) {
      setForm({
        code: editing.code || "",
        name: editing.name || "",
        description: editing.description || "",
        payerId: editing.payerId || "",
        status: editing.status || "DRAFT",
        priority: String(editing.priority ?? 100),
        startAt: editing.startAt ? editing.startAt.slice(0, 10) : "",
        endAt: editing.endAt ? editing.endAt.slice(0, 10) : "",
        pricingStrategy: editing.pricingStrategy || "",
        globalDiscountPercent: editing.globalDiscountPercent != null ? String(editing.globalDiscountPercent) : "",
        emergencyLoadingPercent: editing.emergencyLoadingPercent != null ? String(editing.emergencyLoadingPercent) : "",
        afterHoursLoadingPercent: editing.afterHoursLoadingPercent != null ? String(editing.afterHoursLoadingPercent) : "",
        weekendLoadingPercent: editing.weekendLoadingPercent != null ? String(editing.weekendLoadingPercent) : "",
        statLoadingPercent: editing.statLoadingPercent != null ? String(editing.statLoadingPercent) : "",
        copayDefaultPercent: editing.copaymentRules?.defaultPercent != null ? String(editing.copaymentRules.defaultPercent) : "",
        copayMaxAmount: editing.copaymentRules?.maxAmount != null ? String(editing.copaymentRules.maxAmount) : "",
        copayAppliesTo: editing.copaymentRules?.appliesTo || "",
        copayExemptCategories: (editing.copaymentRules?.exemptCategories || []).join(", "),
        excludedCategoriesText: (editing.excludedCategories || []).join(", "),
        gracePeriodDays: editing.gracePeriodDays != null ? String(editing.gracePeriodDays) : "",
        autoRenewal: Boolean(editing.autoRenewal),
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, mode, editing]);

  function patch(p: Partial<ContractFormData>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function toNumOrNull(v: string): number | null {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function save() {
    if (!branchId) return;
    const code = form.code.trim();
    const name = form.name.trim();
    if (!code || !name) {
      toast({ title: "Missing fields", description: "Code and Name are required." });
      return;
    }
    if (!form.payerId) {
      toast({ title: "Missing fields", description: "Payer is required." });
      return;
    }

    let copaymentRules: any = null;
    const copayDef = toNumOrNull(form.copayDefaultPercent);
    const copayMax = toNumOrNull(form.copayMaxAmount);
    const copayApplies = form.copayAppliesTo.trim();
    const copayExempt = form.copayExemptCategories.split(",").map((s) => s.trim()).filter(Boolean);
    if (copayDef != null || copayMax != null || copayApplies || copayExempt.length > 0) {
      copaymentRules = {
        ...(copayDef != null ? { defaultPercent: copayDef } : {}),
        ...(copayMax != null ? { maxAmount: copayMax } : {}),
        ...(copayApplies ? { appliesTo: copayApplies } : {}),
        ...(copayExempt.length > 0 ? { exemptCategories: copayExempt } : {}),
      };
    }

    const excludedCategories = form.excludedCategoriesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: any = {
      branchId,
      code,
      name,
      description: form.description.trim() || null,
      payerId: form.payerId,
      status: form.status || "DRAFT",
      priority: toNumOrNull(form.priority) ?? 100,
      startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
      endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      pricingStrategy: form.pricingStrategy || null,
      globalDiscountPercent: toNumOrNull(form.globalDiscountPercent),
      emergencyLoadingPercent: toNumOrNull(form.emergencyLoadingPercent),
      afterHoursLoadingPercent: toNumOrNull(form.afterHoursLoadingPercent),
      weekendLoadingPercent: toNumOrNull(form.weekendLoadingPercent),
      statLoadingPercent: toNumOrNull(form.statLoadingPercent),
      copaymentRules,
      excludedCategories,
      gracePeriodDays: toNumOrNull(form.gracePeriodDays),
      autoRenewal: form.autoRenewal,
    };

    setSaving(true);
    try {
      if (mode === "create") {
        await apiTry(
          `/api/infrastructure/payer-contracts`,
          `/api/infra/payer-contracts`,
          { method: "POST", body: JSON.stringify(payload) },
        );
      } else {
        if (!editing?.id) throw new Error("Invalid editing row");
        await apiTry(
          `/api/infrastructure/payer-contracts/${encodeURIComponent(editing.id)}`,
          `/api/infra/payer-contracts/${encodeURIComponent(editing.id)}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
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
              <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            {mode === "create" ? "New Payer Contract" : "Edit Payer Contract"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new pricing contract for a payer with strategy, loading %, and exclusions."
              : `Editing contract: ${editing?.code || ""}`}
          </DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="max-h-[65vh] overflow-y-auto px-1">
          <div className="grid gap-5">
            {/* Row 1: Code + Name */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Contract Code *</Label>
                <Input value={form.code} onChange={(e) => patch({ code: e.target.value })} placeholder="e.g., CON-INS-001" className="font-mono" />
              </div>
              <div className="grid gap-2">
                <Label>Contract Name *</Label>
                <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g., HDFC Ergo Standard" />
              </div>
            </div>

            {/* Row 2: Payer + Status */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Payer *</Label>
                <Select value={form.payerId} onValueChange={(v) => patch({ payerId: v })}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select payer..." /></SelectTrigger>
                  <SelectContent className="max-h-[280px] overflow-y-auto">
                    {payers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.code} — {p.name} ({p.kind})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => patch({ status: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="TERMINATED">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Priority + Validity */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Input type="number" min={1} value={form.priority} onChange={(e) => patch({ priority: e.target.value })} placeholder="100" />
                <span className="text-xs text-zc-muted">Lower = higher priority</span>
              </div>
              <div className="grid gap-2">
                <Label>Effective From</Label>
                <Input type="date" value={form.startAt} onChange={(e) => patch({ startAt: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Effective Till</Label>
                <Input type="date" value={form.endAt} onChange={(e) => patch({ endAt: e.target.value })} />
              </div>
            </div>

            {/* Row 4: Description */}
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Contract details, notes..." rows={2} />
            </div>

            <Separator />

            {/* Pricing Strategy Section */}
            <div className="rounded-xl border border-blue-200/50 bg-blue-50/30 p-4 dark:border-blue-900/50 dark:bg-blue-900/10">
              <div className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3">Pricing Strategy</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Strategy</Label>
                  <Select value={form.pricingStrategy} onValueChange={(v) => patch({ pricingStrategy: v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select strategy..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GLOBAL_DISCOUNT">Global Discount</SelectItem>
                      <SelectItem value="CATEGORY_WISE">Category-wise</SelectItem>
                      <SelectItem value="SERVICE_SPECIFIC">Service-specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Global Discount %</Label>
                  <Input type="number" min={0} max={100} step={0.01} value={form.globalDiscountPercent} onChange={(e) => patch({ globalDiscountPercent: e.target.value })} placeholder="e.g., 10" />
                </div>
              </div>
            </div>

            {/* Special Conditions (Loading %) */}
            <div className="rounded-xl border border-amber-200/50 bg-amber-50/30 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3">Special Conditions (Loading %)</div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="grid gap-2">
                  <Label className="text-xs">Emergency</Label>
                  <Input type="number" min={0} step={0.01} value={form.emergencyLoadingPercent} onChange={(e) => patch({ emergencyLoadingPercent: e.target.value })} placeholder="%" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">After-Hours</Label>
                  <Input type="number" min={0} step={0.01} value={form.afterHoursLoadingPercent} onChange={(e) => patch({ afterHoursLoadingPercent: e.target.value })} placeholder="%" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Weekend</Label>
                  <Input type="number" min={0} step={0.01} value={form.weekendLoadingPercent} onChange={(e) => patch({ weekendLoadingPercent: e.target.value })} placeholder="%" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">STAT</Label>
                  <Input type="number" min={0} step={0.01} value={form.statLoadingPercent} onChange={(e) => patch({ statLoadingPercent: e.target.value })} placeholder="%" />
                </div>
              </div>
            </div>

            {/* Exclusions */}
            <div className="grid gap-2">
              <Label>Excluded Categories</Label>
              <Input value={form.excludedCategoriesText} onChange={(e) => patch({ excludedCategoriesText: e.target.value })} placeholder="Comma-separated, e.g. Cosmetic, Dental, Implants" />
              <span className="text-xs text-zc-muted">Service categories excluded from this contract.</span>
            </div>

            {/* Co-payment Rules (structured) */}
            <div className="rounded-xl border border-green-200/50 bg-green-50/30 p-4 dark:border-green-900/50 dark:bg-green-900/10">
              <div className="text-sm font-semibold text-green-700 dark:text-green-300 mb-3">Co-payment Rules</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="text-xs">Default Co-pay %</Label>
                  <Input type="number" min={0} max={100} step={0.01} value={form.copayDefaultPercent} onChange={(e) => patch({ copayDefaultPercent: e.target.value })} placeholder="e.g., 10" />
                  <span className="text-xs text-zc-muted">Patient pays this % of the bill.</span>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Max Co-pay Amount</Label>
                  <Input type="number" min={0} step={1} value={form.copayMaxAmount} onChange={(e) => patch({ copayMaxAmount: e.target.value })} placeholder="e.g., 5000" />
                  <span className="text-xs text-zc-muted">Maximum co-pay amount cap (in ₹).</span>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Applies To</Label>
                  <Select value={form.copayAppliesTo || "none"} onValueChange={(v) => patch({ copayAppliesTo: v === "none" ? "" : v })}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Set</SelectItem>
                      <SelectItem value="ALL_SERVICES">All Services</SelectItem>
                      <SelectItem value="ROOM_RENT_ONLY">Room Rent Only</SelectItem>
                      <SelectItem value="DIAGNOSTICS_ONLY">Diagnostics Only</SelectItem>
                      <SelectItem value="PROCEDURES_ONLY">Procedures Only</SelectItem>
                      <SelectItem value="PHARMACY_ONLY">Pharmacy Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Exempt Categories</Label>
                  <Input value={form.copayExemptCategories} onChange={(e) => patch({ copayExemptCategories: e.target.value })} placeholder="e.g., ICU, Emergency" />
                  <span className="text-xs text-zc-muted">Comma-separated categories exempt from co-pay.</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Grace + Auto-renewal */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Grace Period (days)</Label>
                <Input type="number" min={0} value={form.gracePeriodDays} onChange={(e) => patch({ gracePeriodDays: e.target.value })} placeholder="e.g., 30" />
              </div>
              <div className="grid gap-2">
                <Label>Auto Renewal</Label>
                <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2 h-10">
                  <Switch checked={form.autoRenewal} onCheckedChange={(v) => patch({ autoRenewal: v })} />
                  <span className="text-sm">{form.autoRenewal ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "create" ? "Create Contract" : "Update Contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Detail Viewer Dialog                             */
/* -------------------------------------------------------------------------- */

function ContractDetailDialog({
  open,
  onOpenChange,
  contract,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: PayerContractRow | null;
}) {
  if (!contract) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={drawerClassName()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-zc-accent" />
            Contract Details
          </DialogTitle>
          <DialogDescription>
            {contract.code} — {contract.name}
          </DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="max-h-[65vh] overflow-y-auto grid gap-4">
          {/* Header info */}
          <div className="flex flex-wrap gap-2">
            {statusBadge(contract.status)}
            {approvalBadge(contract.approvalStatus)}
            {contract.pricingStrategy && (
              <Badge variant="info">{strategyLabel(contract.pricingStrategy)}</Badge>
            )}
            {contract.autoRenewal && <Badge variant="ok">Auto-Renew</Badge>}
          </div>

          {/* Basic info */}
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="text-xs text-zc-muted">Payer</div>
              <div className="font-semibold">{contract.payer?.name || "—"}</div>
              {contract.payer?.kind && <Badge variant="secondary" className="text-[10px] mt-1">{contract.payer.kind}</Badge>}
            </div>
            <div>
              <div className="text-xs text-zc-muted">Priority</div>
              <div className="font-semibold font-mono">{contract.priority}</div>
            </div>
            <div>
              <div className="text-xs text-zc-muted">Grace Period</div>
              <div className="font-semibold">{contract.gracePeriodDays != null ? `${contract.gracePeriodDays} days` : "—"}</div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs text-zc-muted">Effective From</div>
              <div className="font-semibold">{fmtDate(contract.startAt)}</div>
            </div>
            <div>
              <div className="text-xs text-zc-muted">Effective Till</div>
              <div className="font-semibold">{fmtDate(contract.endAt)}</div>
            </div>
          </div>

          {contract.description && (
            <div>
              <div className="text-xs text-zc-muted">Description</div>
              <div className="text-sm mt-1">{contract.description}</div>
            </div>
          )}

          <Separator />

          {/* Pricing Strategy + Discount */}
          <div className="rounded-xl border border-blue-200/50 bg-blue-50/30 p-4 dark:border-blue-900/50 dark:bg-blue-900/10">
            <div className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">Pricing Strategy</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-zc-muted">Strategy</div>
                <div className="font-semibold">{strategyLabel(contract.pricingStrategy)}</div>
              </div>
              <div>
                <div className="text-xs text-zc-muted">Global Discount</div>
                <div className="font-semibold">{fmtPercent(contract.globalDiscountPercent)}</div>
              </div>
            </div>
          </div>

          {/* Special Conditions */}
          <div className="rounded-xl border border-amber-200/50 bg-amber-50/30 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">Special Conditions (Loading %)</div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <div className="text-xs text-zc-muted">Emergency</div>
                <div className="font-semibold">{fmtPercent(contract.emergencyLoadingPercent)}</div>
              </div>
              <div>
                <div className="text-xs text-zc-muted">After-Hours</div>
                <div className="font-semibold">{fmtPercent(contract.afterHoursLoadingPercent)}</div>
              </div>
              <div>
                <div className="text-xs text-zc-muted">Weekend</div>
                <div className="font-semibold">{fmtPercent(contract.weekendLoadingPercent)}</div>
              </div>
              <div>
                <div className="text-xs text-zc-muted">STAT</div>
                <div className="font-semibold">{fmtPercent(contract.statLoadingPercent)}</div>
              </div>
            </div>
          </div>

          {/* Exclusions */}
          {((contract.excludedCategories?.length ?? 0) > 0 || (contract.excludedServiceIds?.length ?? 0) > 0) && (
            <div className="rounded-xl border border-red-200/50 bg-red-50/30 p-4 dark:border-red-900/50 dark:bg-red-900/10">
              <div className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Exclusions</div>
              {(contract.excludedCategories?.length ?? 0) > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-zc-muted">Excluded Categories</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contract.excludedCategories!.map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {(contract.excludedServiceIds?.length ?? 0) > 0 && (
                <div>
                  <div className="text-xs text-zc-muted">Excluded Services</div>
                  <div className="text-sm mt-1">{contract.excludedServiceIds!.length} service(s) excluded</div>
                </div>
              )}
            </div>
          )}

          {/* Co-payment Rules */}
          {contract.copaymentRules && (
            <div className="rounded-xl border border-green-200/50 bg-green-50/30 p-4 dark:border-green-900/50 dark:bg-green-900/10">
              <div className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">Co-payment Rules</div>
              <div className="grid gap-3 md:grid-cols-2">
                {contract.copaymentRules.defaultPercent != null && (
                  <div>
                    <div className="text-xs text-zc-muted">Default Co-pay</div>
                    <div className="font-semibold">{contract.copaymentRules.defaultPercent}%</div>
                  </div>
                )}
                {contract.copaymentRules.maxAmount != null && (
                  <div>
                    <div className="text-xs text-zc-muted">Max Co-pay Amount</div>
                    <div className="font-semibold">₹{Number(contract.copaymentRules.maxAmount).toLocaleString("en-IN")}</div>
                  </div>
                )}
                {contract.copaymentRules.appliesTo && (
                  <div>
                    <div className="text-xs text-zc-muted">Applies To</div>
                    <div className="font-semibold">{String(contract.copaymentRules.appliesTo).replace(/_/g, " ")}</div>
                  </div>
                )}
                {(contract.copaymentRules.exemptCategories?.length ?? 0) > 0 && (
                  <div>
                    <div className="text-xs text-zc-muted">Exempt Categories</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contract.copaymentRules.exemptCategories.map((c: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Linked Tariff Plans */}
          {(contract.tariffPlans?.length ?? 0) > 0 && (
            <div>
              <div className="text-xs text-zc-muted mb-1">Linked Tariff Plans</div>
              <div className="flex flex-wrap gap-1">
                {contract.tariffPlans!.map((tp) => (
                  <Badge key={tp.id} variant="info" className="text-xs">{tp.name}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Contract Service Rates Dialog                       */
/* -------------------------------------------------------------------------- */

function emptyRateForm(): RateFormData {
  return {
    serviceItemId: "",
    category: "",
    rateType: "FIXED_PRICE",
    fixedPrice: "",
    percentageOfBase: "",
    discountPercent: "",
    minPrice: "",
    maxPrice: "",
  };
}

function rateTypeLabel(rt: string): string {
  switch (rt) {
    case "FIXED_PRICE": return "Fixed Price";
    case "PERCENTAGE_OF_BASE": return "% of Base";
    case "DISCOUNT": return "Discount";
    default: return rt.replace(/_/g, " ");
  }
}

function fmtMoney(v?: number | string | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}

function ContractRatesDialog({
  open,
  onOpenChange,
  contract,
  rates,
  ratesLoading,
  serviceItems,
  branchId,
  onRatesChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contract: PayerContractRow | null;
  rates: ContractServiceRateRow[];
  ratesLoading: boolean;
  serviceItems: { id: string; code: string; name: string; category: string }[];
  branchId: string;
  onRatesChanged: () => void;
}) {
  const { toast } = useToast();
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<RateFormData>(emptyRateForm());

  React.useEffect(() => {
    if (!open) {
      setShowForm(false);
      setForm(emptyRateForm());
    }
  }, [open]);

  function patch(p: Partial<RateFormData>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function toNumOrNull(v: string): number | null {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function saveRate() {
    if (!contract?.id) return;
    if (!form.rateType) {
      toast({ title: "Missing fields", description: "Rate type is required." });
      return;
    }

    const payload: any = {
      contractId: contract.id,
      serviceItemId: form.serviceItemId || null,
      category: form.category.trim() || null,
      rateType: form.rateType,
      fixedPrice: toNumOrNull(form.fixedPrice),
      percentageOfBase: toNumOrNull(form.percentageOfBase),
      discountPercent: toNumOrNull(form.discountPercent),
      minPrice: toNumOrNull(form.minPrice),
      maxPrice: toNumOrNull(form.maxPrice),
      isActive: true,
    };

    setSaving(true);
    try {
      await apiTry(
        `/api/infrastructure/payer-contracts/${encodeURIComponent(contract.id)}/rates`,
        `/api/infra/payer-contracts/${encodeURIComponent(contract.id)}/rates`,
        { method: "POST", body: JSON.stringify(payload) },
      );
      toast({ title: "Rate added" });
      setShowForm(false);
      setForm(emptyRateForm());
      onRatesChanged();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRate(rateId: string) {
    if (!contract?.id) return;
    const ok = window.confirm("Delete this rate? This cannot be undone.");
    if (!ok) return;
    setDeleting(rateId);
    try {
      await apiTry(
        `/api/infrastructure/payer-contracts/${encodeURIComponent(contract.id)}/rates/${encodeURIComponent(rateId)}`,
        `/api/infra/payer-contracts/${encodeURIComponent(contract.id)}/rates/${encodeURIComponent(rateId)}`,
        { method: "DELETE" },
      );
      toast({ title: "Rate deleted" });
      onRatesChanged();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setDeleting(null);
    }
  }

  if (!contract) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={drawerClassName()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            Contract Service Rates
          </DialogTitle>
          <DialogDescription>
            {contract.code} — {contract.name}
          </DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="max-h-[65vh] overflow-y-auto grid gap-4 px-1">
          {/* Actions bar */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-zc-muted">
              {rates.length} rate{rates.length !== 1 ? "s" : ""} configured
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => { setShowForm(true); setForm(emptyRateForm()); }}
              disabled={showForm || saving}
            >
              <Plus className="h-4 w-4" /> Add Rate
            </Button>
          </div>

          {/* Inline add form */}
          {showForm && (
            <div className="rounded-xl border border-indigo-200/50 bg-indigo-50/30 p-4 dark:border-indigo-900/50 dark:bg-indigo-900/10">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">New Rate</span>
              </div>
              <div className="grid gap-4">
                {/* Row 1: Service Item + Category */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-xs">Service Item</Label>
                    <Select value={form.serviceItemId} onValueChange={(v) => patch({ serviceItemId: v })}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select service item..." /></SelectTrigger>
                      <SelectContent className="max-h-[280px] overflow-y-auto">
                        {serviceItems.map((si) => (
                          <SelectItem key={si.id} value={si.id}>
                            {si.code} — {si.name}{si.category ? ` (${si.category})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Category</Label>
                    <Input
                      value={form.category}
                      onChange={(e) => patch({ category: e.target.value })}
                      placeholder="e.g., Lab, Radiology"
                    />
                  </div>
                </div>

                {/* Row 2: Rate Type */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label className="text-xs">Rate Type *</Label>
                    <Select value={form.rateType} onValueChange={(v) => patch({ rateType: v })}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED_PRICE">Fixed Price</SelectItem>
                        <SelectItem value="PERCENTAGE_OF_BASE">% of Base Price</SelectItem>
                        <SelectItem value="DISCOUNT">Discount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.rateType === "FIXED_PRICE" && (
                    <div className="grid gap-2">
                      <Label className="text-xs">Fixed Price</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.fixedPrice}
                        onChange={(e) => patch({ fixedPrice: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  {form.rateType === "PERCENTAGE_OF_BASE" && (
                    <div className="grid gap-2">
                      <Label className="text-xs">% of Base</Label>
                      <Input
                        type="number"
                        min={0}
                        max={999}
                        step={0.01}
                        value={form.percentageOfBase}
                        onChange={(e) => patch({ percentageOfBase: e.target.value })}
                        placeholder="e.g., 80"
                      />
                    </div>
                  )}
                  {form.rateType === "DISCOUNT" && (
                    <div className="grid gap-2">
                      <Label className="text-xs">Discount %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={form.discountPercent}
                        onChange={(e) => patch({ discountPercent: e.target.value })}
                        placeholder="e.g., 15"
                      />
                    </div>
                  )}
                </div>

                {/* Row 3: Min / Max price */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-xs">Min Price</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.minPrice}
                      onChange={(e) => patch({ minPrice: e.target.value })}
                      placeholder="Optional floor"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Max Price</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.maxPrice}
                      onChange={(e) => patch({ maxPrice: e.target.value })}
                      placeholder="Optional ceiling"
                    />
                  </div>
                </div>

                {/* Form actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setForm(emptyRateForm()); }} disabled={saving}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveRate} disabled={saving}>
                    {saving ? <RefreshCw className="mr-2 h-3 w-3 animate-spin" /> : null}
                    Save Rate
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Rates table */}
          <div className="rounded-xl border border-zc-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service / Category</TableHead>
                  <TableHead className="w-[120px]">Rate Type</TableHead>
                  <TableHead className="w-[100px] text-right">Fixed Price</TableHead>
                  <TableHead className="w-[80px] text-right">Discount %</TableHead>
                  <TableHead className="w-[80px] text-right">Min</TableHead>
                  <TableHead className="w-[80px] text-right">Max</TableHead>
                  <TableHead className="w-[70px]">Active</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratesLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : rates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex flex-col items-center justify-center gap-3 py-8 text-sm text-zc-muted">
                        <DollarSign className="h-4 w-4" /> No rates configured for this contract.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rates.map((rate) => {
                    const serviceName = rate.serviceItem
                      ? `${rate.serviceItem.code} — ${rate.serviceItem.name}`
                      : rate.chargeMasterItem
                        ? `${rate.chargeMasterItem.code} — ${rate.chargeMasterItem.name}`
                        : rate.pkg
                          ? `${rate.pkg.code} — ${rate.pkg.name}`
                          : "—";
                    return (
                      <TableRow key={rate.id}>
                        <TableCell>
                          <div className="font-semibold text-sm">{serviceName}</div>
                          {rate.category && (
                            <Badge variant="secondary" className="text-[10px] mt-0.5">{rate.category}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="info" className="text-[10px]">{rateTypeLabel(rate.rateType)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {rate.rateType === "FIXED_PRICE" ? fmtMoney(rate.fixedPrice) : rate.rateType === "PERCENTAGE_OF_BASE" ? fmtPercent(rate.percentageOfBase) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtPercent(rate.discountPercent)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtMoney(rate.minPrice)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtMoney(rate.maxPrice)}</TableCell>
                        <TableCell>
                          {rate.isActive
                            ? <Badge variant="ok" className="text-[10px]">Yes</Badge>
                            : <Badge variant="secondary" className="text-[10px]">No</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            disabled={deleting === rate.id}
                            onClick={() => deleteRate(rate.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            {!ratesLoading && rates.length > 0 && (
              <div className="flex items-center justify-between border-t border-zc-border p-3">
                <div className="text-xs text-zc-muted">
                  Total rates: <span className="font-semibold text-zc-text">{rates.length}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
