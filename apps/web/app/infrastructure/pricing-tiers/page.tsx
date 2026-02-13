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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

import { useBranchContext } from "@/lib/branch/useBranchContext";
import { useActiveBranchStore } from "@/lib/branch/active-branch";
import { usePageInsights } from "@/lib/copilot/usePageInsights";
import { PageInsightBanner } from "@/components/copilot/PageInsightBanner";
import {
  AlertTriangle,
  ExternalLink,
  Layers,
  Loader2,
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

type PricingTierKind =
  | "GENERAL"
  | "SENIOR_CITIZEN"
  | "STAFF"
  | "EMPLOYEE_FAMILY"
  | "BPL"
  | "MEDICAL_COUNCIL"
  | "CUSTOM";

type PricingTierRow = {
  id: string;
  branchId: string;
  kind: PricingTierKind;
  name: string;
  code: string;
  description?: string | null;
  assignmentRules?: any | null;
  defaultDiscountPercent?: number | null;
  defaultMarkupPercent?: number | null;
  maxDiscountCap?: number | null;
  sortOrder?: number | null;
  isActive: boolean;
  _count: { tierRates: number };
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

function kindLabel(k: PricingTierKind) {
  switch (k) {
    case "GENERAL":
      return "General";
    case "SENIOR_CITIZEN":
      return "Senior Citizen";
    case "STAFF":
      return "Staff";
    case "EMPLOYEE_FAMILY":
      return "Employee Family";
    case "BPL":
      return "BPL";
    case "MEDICAL_COUNCIL":
      return "Medical Council";
    case "CUSTOM":
      return "Custom";
    default:
      return k;
  }
}

function kindBadgeVariant(k: PricingTierKind): "ok" | "warning" | "secondary" | "destructive" {
  switch (k) {
    case "GENERAL":
      return "ok";
    case "SENIOR_CITIZEN":
      return "warning";
    case "STAFF":
      return "secondary";
    case "EMPLOYEE_FAMILY":
      return "secondary";
    case "BPL":
      return "destructive";
    case "MEDICAL_COUNCIL":
      return "warning";
    case "CUSTOM":
      return "secondary";
    default:
      return "secondary";
  }
}

const ALL_KINDS: PricingTierKind[] = [
  "GENERAL",
  "SENIOR_CITIZEN",
  "STAFF",
  "EMPLOYEE_FAMILY",
  "BPL",
  "MEDICAL_COUNCIL",
  "CUSTOM",
];

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

function fmtPct(v?: number | null) {
  if (v === undefined || v === null) return "-";
  return `${v}%`;
}

function fmtCap(v?: number | null) {
  if (v === undefined || v === null) return "-";
  return v.toLocaleString();
}

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function SuperAdminPricingTiersPage() {
  const { toast } = useToast();
  // Unified branch context
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

  const [rows, setRows] = React.useState<PricingTierRow[]>([]);

  // AI Copilot
  const { insights, loading: insightsLoading, dismiss: dismissInsight } = usePageInsights({
    module: "pricing-tiers",
    enabled: !!branchId,
  });

  // filters
  const [q, setQ] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState<string>("all");
  const [includeInactive, setIncludeInactive] = React.useState(false);

  // dialog
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<PricingTierRow | null>(null);

  // form fields
  const [fKind, setFKind] = React.useState<PricingTierKind>("GENERAL");
  const [fName, setFName] = React.useState("");
  const [fCode, setFCode] = React.useState("");
  const [fDescription, setFDescription] = React.useState("");
  const [fDefaultDiscount, setFDefaultDiscount] = React.useState("");
  const [fDefaultMarkup, setFDefaultMarkup] = React.useState("");
  const [fMaxDiscountCap, setFMaxDiscountCap] = React.useState("");
  const [fSortOrder, setFSortOrder] = React.useState("");
  const [fAssignmentRules, setFAssignmentRules] = React.useState("");

  const mustSelectBranch = !branchId;

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

  async function loadPricingTiers(showToast = false, targetBranchId?: string) {
    const target = targetBranchId || branchId;
    if (!target) return;
    setErr(null);
    setLoading(true);
    try {
      const qs = buildQS({
        branchId: target,
        q: q.trim() || undefined,
        kind: kindFilter !== "all" ? kindFilter : undefined,
        includeInactive: includeInactive ? "true" : undefined,
      });

      const res = await apiTry<any>(
        `/api/infrastructure/pricing-tiers?${qs}`,
        `/api/infra/pricing-tiers?${qs}`,
      );

      const list: PricingTierRow[] = Array.isArray(res) ? res : res?.rows || [];
      setRows(list);

      if (showToast) {
        toast({ title: "Pricing tiers refreshed", description: "Loaded latest tiers for this branch." });
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to load pricing tiers";
      setErr(msg);
      setRows([]);
      if (showToast) toast({ title: "Refresh failed", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
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
      await loadPricingTiers(false, bid);
      if (showToast) toast({ title: "Ready", description: "Branch scope and pricing tiers are up to date." });
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
    void loadPricingTiers(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, kindFilter, includeInactive]);

  React.useEffect(() => {
    if (!branchId) return;
    const t = setTimeout(() => void loadPricingTiers(false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function onBranchChange(nextId: string) {
    setBranchId(nextId);
    if (isGlobalScope) setActiveBranchId(nextId || null);
    setQ("");
    setKindFilter("all");
    setIncludeInactive(false);
    setErr(null);
    void loadPricingTiers(false, nextId);
  }

  /* ---------- Dialog helpers ---------- */

  function openCreate() {
    setEditingRow(null);
    setFKind("GENERAL");
    setFName("");
    setFCode("");
    setFDescription("");
    setFDefaultDiscount("");
    setFDefaultMarkup("");
    setFMaxDiscountCap("");
    setFSortOrder("0");
    setFAssignmentRules("");
    setDialogOpen(true);
  }

  function openEdit(row: PricingTierRow) {
    setEditingRow(row);
    setFKind(row.kind);
    setFName(row.name);
    setFCode(row.code);
    setFDescription(row.description || "");
    setFDefaultDiscount(row.defaultDiscountPercent != null ? String(row.defaultDiscountPercent) : "");
    setFDefaultMarkup(row.defaultMarkupPercent != null ? String(row.defaultMarkupPercent) : "");
    setFMaxDiscountCap(row.maxDiscountCap != null ? String(row.maxDiscountCap) : "");
    setFSortOrder(row.sortOrder != null ? String(row.sortOrder) : "0");
    setFAssignmentRules(row.assignmentRules ? JSON.stringify(row.assignmentRules, null, 2) : "");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!fName.trim() || !fCode.trim()) {
      toast({ title: "Validation", description: "Name and Code are required.", variant: "destructive" as any });
      return;
    }

    let parsedRules: any = null;
    if (fAssignmentRules.trim()) {
      try {
        parsedRules = JSON.parse(fAssignmentRules);
      } catch {
        toast({ title: "Invalid JSON", description: "Assignment rules must be valid JSON.", variant: "destructive" as any });
        return;
      }
    }

    const body: Record<string, any> = {
      branchId,
      kind: fKind,
      name: fName.trim(),
      code: fCode.trim(),
      description: fDescription.trim() || null,
      defaultDiscountPercent: fDefaultDiscount ? parseFloat(fDefaultDiscount) : null,
      defaultMarkupPercent: fDefaultMarkup ? parseFloat(fDefaultMarkup) : null,
      maxDiscountCap: fMaxDiscountCap ? parseFloat(fMaxDiscountCap) : null,
      sortOrder: fSortOrder ? parseInt(fSortOrder, 10) : 0,
      assignmentRules: parsedRules,
    };

    setBusy(true);
    try {
      if (editingRow) {
        await apiFetch(`/api/infrastructure/pricing-tiers/${editingRow.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        } as any);
        toast({ title: "Updated", description: `Pricing tier "${fName}" updated.` });
      } else {
        await apiFetch("/api/infrastructure/pricing-tiers", {
          method: "POST",
          body: JSON.stringify(body),
        } as any);
        toast({ title: "Created", description: `Pricing tier "${fName}" created.` });
      }
      setDialogOpen(false);
      void loadPricingTiers(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Unknown error", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(row: PricingTierRow) {
    if (!confirm(`Delete pricing tier "${row.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/api/infrastructure/pricing-tiers/${row.id}`, { method: "DELETE" } as any);
      toast({ title: "Deleted", description: `Pricing tier "${row.name}" removed.` });
      void loadPricingTiers(false);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "Unknown error", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Stats ---------- */

  const stats = React.useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.isActive).length;
    const inactive = total - active;

    const byKind: Record<string, number> = {};
    for (const r of rows) {
      byKind[r.kind] = (byKind[r.kind] || 0) + 1;
    }

    return { total, active, inactive, byKind };
  }, [rows]);

  /* ---------- Render ---------- */

  return (
    <AppShell title="Infrastructure - Pricing Tiers">
      <RequirePerm perm="INFRA_PRICING_TIER_READ">
      <div className="grid gap-6">
        {/* Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
              <Layers className="h-5 w-5 text-zc-accent" />
            </span>
            <div className="min-w-0">
              <div className="text-3xl font-semibold tracking-tight">Pricing Tiers</div>
              <div className="mt-1 text-sm text-zc-muted">
                Patient pricing tiers with discount, markup, and assignment rules per branch.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="px-5 gap-2" onClick={() => refreshAll(true)} disabled={loading || busy}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>

            <Button variant="primary" className="px-5 gap-2" onClick={openCreate} disabled={mustSelectBranch || busy}>
              <Plus className="h-4 w-4" />
              New Tier
            </Button>
          </div>
        </div>

        {err ? (
          <Card className="border-zc-danger/40">
            <CardHeader className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-zc-danger" />
                <div>
                  <CardTitle className="text-base">Could not load pricing tiers</CardTitle>
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
              Pick a branch, filter by kind, and review tier configuration.
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

            <PageInsightBanner insights={insights} loading={insightsLoading} onDismiss={dismissInsight} />

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Total</div>
                <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{stats.total}</div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Active</div>
                <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{stats.active}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-900/50 dark:bg-slate-900/10">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Inactive</div>
                <div className="mt-1 text-lg font-bold text-slate-700 dark:text-slate-300">{stats.inactive}</div>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-900/10">
                <div className="text-xs font-medium text-violet-600 dark:text-violet-400">By Kind</div>
                <div className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-300">
                  {Object.keys(stats.byKind).length}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by code or name..."
                  className="pl-10"
                  disabled={mustSelectBranch}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="grid gap-1">
                  <Select value={kindFilter} onValueChange={setKindFilter} disabled={mustSelectBranch}>
                    <SelectTrigger className="h-9 w-[180px] rounded-xl border-zc-border bg-zc-card text-sm">
                      <SelectValue placeholder="All kinds" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Kinds</SelectItem>
                      {ALL_KINDS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {kindLabel(k)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                  <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} disabled={mustSelectBranch} />
                  <div className="text-sm">
                    <div className="font-semibold text-zc-text">Include inactive</div>
                    <div className="text-xs text-zc-muted">Show disabled tiers</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Branch scoped</Badge>
              <Badge variant="ok">Tier rates linked</Badge>
              <Badge variant="warning">Discount &amp; markup per tier</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Create / Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            if (!v) {
              setDialogOpen(false);
              setEditingRow(null);
              setFKind("GENERAL");
              setFName("");
              setFCode("");
              setFDescription("");
              setFDefaultDiscount("");
              setFDefaultMarkup("");
              setFMaxDiscountCap("");
              setFSortOrder("0");
              setFAssignmentRules("");
            } else {
              setDialogOpen(true);
            }
          }}
        >
          <DialogContent className={drawerClassName()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                  <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                {editingRow ? "Edit Pricing Tier" : "Create Pricing Tier"}
              </DialogTitle>
              <DialogDescription>
                {editingRow
                  ? "Update pricing tier details, discounts, and assignment rules."
                  : "Create a pricing tier with discount, markup, and assignment rules for this branch."}
              </DialogDescription>
            </DialogHeader>

            <Separator className="my-4" />

            <div className="grid gap-6">
              {/* Basics */}
              <div className="grid gap-3">
                <div className="text-sm font-semibold text-zc-text">Basics</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Kind</Label>
                    <Select value={fKind} onValueChange={(v) => setFKind(v as PricingTierKind)}>
                      <SelectTrigger><SelectValue placeholder="Select kind" /></SelectTrigger>
                      <SelectContent>
                        {ALL_KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {kindLabel(k)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Code</Label>
                    <Input value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder="e.g. TIER-SC" />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="e.g. Senior Citizen Tier" />
                </div>

                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Input value={fDescription} onChange={(e) => setFDescription(e.target.value)} placeholder="Optional description" />
                </div>
              </div>

              <Separator />

              {/* Pricing Rules */}
              <div className="grid gap-3">
                <div className="text-sm font-semibold text-zc-text">Pricing Rules</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Default Discount %</Label>
                    <Input
                      type="number"
                      value={fDefaultDiscount}
                      onChange={(e) => setFDefaultDiscount(e.target.value)}
                      placeholder="e.g. 10"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Default Markup %</Label>
                    <Input
                      type="number"
                      value={fDefaultMarkup}
                      onChange={(e) => setFDefaultMarkup(e.target.value)}
                      placeholder="e.g. 5"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Max Discount Cap</Label>
                    <Input
                      type="number"
                      value={fMaxDiscountCap}
                      onChange={(e) => setFMaxDiscountCap(e.target.value)}
                      placeholder="e.g. 5000"
                      min="0"
                      step="1"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Sort Order</Label>
                    <Input
                      type="number"
                      value={fSortOrder}
                      onChange={(e) => setFSortOrder(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="1"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Assignment Rules */}
              <div className="grid gap-3">
                <div className="text-sm font-semibold text-zc-text">Assignment Rules</div>

                <div className="grid gap-2">
                  <Label>Assignment Rules (JSON)</Label>
                  <Textarea
                    value={fAssignmentRules}
                    onChange={(e) => setFAssignmentRules(e.target.value)}
                    placeholder='e.g. { "ageMin": 60, "category": "senior" }'
                    className="min-h-[84px] font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={busy || !fName.trim() || !fCode.trim()}
                  className="gap-2"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {busy ? "Saving..." : editingRow ? "Update Tier" : "Create Tier"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Table */}
        <Card>
          <CardHeader className="py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Manage Pricing Tiers</CardTitle>
                <CardDescription>View and manage patient pricing tiers for the selected branch.</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pb-6">
            <div className="rounded-xl border border-zc-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[130px]">Kind</TableHead>
                    <TableHead className="w-[100px] text-right">Discount%</TableHead>
                    <TableHead className="w-[100px] text-right">Markup%</TableHead>
                    <TableHead className="w-[100px] text-right">Max Cap</TableHead>
                    <TableHead className="w-[80px] text-center">Rates</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[140px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={9}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4" />
                            No pricing tiers found.
                          </div>
                          <Button size="sm" onClick={openCreate} disabled={mustSelectBranch}>
                            New Tier
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          <span className="font-semibold text-zc-text">{r.code}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-zc-text">{r.name}</span>
                            {r.description ? (
                              <span className="text-xs text-zc-muted line-clamp-1">{r.description}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={kindBadgeVariant(r.kind)}>{kindLabel(r.kind)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtPct(r.defaultDiscountPercent)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtPct(r.defaultMarkupPercent)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtCap(r.maxDiscountCap)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{r._count?.tierRates ?? 0}</Badge>
                        </TableCell>
                        <TableCell>{activeBadge(r.isActive)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(r)}>
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-zc-danger hover:text-zc-danger"
                              onClick={() => handleDelete(r)}
                              disabled={busy}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-3 border-t border-zc-border p-4 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-zc-muted">
                  Total: <span className="font-semibold text-zc-text">{rows.length}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <Link href="/infrastructure/charge-master">
                      Charge Master <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" asChild>
                    <Link href="/infrastructure/tariff-plans">
                      Tariff Plans <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
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

