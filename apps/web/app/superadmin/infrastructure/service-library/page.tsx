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

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

import {
  AlertTriangle,
  ClipboardList,
  ExternalLink,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type BranchRow = { id: string; code: string; name: string; city: string };

type ChargeMasterItemRow = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
};

type ServiceChargeMappingRow = {
  id: string;
  serviceItemId: string;
  chargeMasterItemId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  chargeMasterItem?: ChargeMasterItemRow | null;
};

type ServiceItemRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  category: string;
  unit?: string | null;
  isOrderable: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  mappings?: ServiceChargeMappingRow[];
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

function modalClassName(extra?: string) {
  return cn(
    "rounded-2xl border border-indigo-200/50 dark:border-indigo-800/50 bg-zc-card shadow-2xl shadow-indigo-500/10",
    extra,
  );
}

function ModalHeader({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
            {icon ?? <Wrench className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          </div>
          {title}
        </DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
      <Separator className="my-4" />
    </>
  );
}

type MappingStatusFilter = "all" | "mapped" | "missing";
type OrderableFilter = "all" | "yes" | "no";

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function SuperAdminServiceLibraryPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<"services" | "guide">("services");
  const [showFilters, setShowFilters] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState<string>("");

  const [allRows, setAllRows] = React.useState<ServiceItemRow[]>([]);

  // filters
  const [q, setQ] = React.useState("");
  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [category, setCategory] = React.useState<string | "all">("all");
  const [mappingStatus, setMappingStatus] = React.useState<MappingStatusFilter>("all");
  const [orderable, setOrderable] = React.useState<OrderableFilter>("all");

  // pagination (client-side)
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);

  // dialogs
  const [svcDialogOpen, setSvcDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ServiceItemRow | null>(null);

  const mustSelectBranch = !branchId;

  const categoryOptions = React.useMemo(() => {
    const set = new Set<string>();
    (allRows || []).forEach((r) => {
      const c = (r.category || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allRows]);

  function currentMapping(r: ServiceItemRow): ServiceChargeMappingRow | null {
    const ms = r.mappings || [];
    // Prefer open mapping (effectiveTo null); else latest (already sorted desc effectiveFrom by backend)
    const open = ms.find((m) => m && (m.effectiveTo === null || m.effectiveTo === undefined));
    return open || ms[0] || null;
  }

  function isMapped(r: ServiceItemRow) {
    const m = currentMapping(r);
    return Boolean(m?.chargeMasterItemId && (m.effectiveTo === null || m.effectiveTo === undefined));
  }

  function mappingBadge(r: ServiceItemRow) {
    const m = currentMapping(r);
    if (!m || !m.chargeMasterItemId) return <Badge variant="destructive">MAPPING MISSING</Badge>;
    if (m.effectiveTo) return <Badge variant="secondary">MAPPING CLOSED</Badge>;
    const cmCode = m.chargeMasterItem?.code || "CHARGE";
    return <Badge variant="ok">MAPPED • {cmCode}</Badge>;
  }

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

  async function loadServices(showToast = false) {
    if (!branchId) return;
    setErr(null);
    setLoading(true);
    try {
      const resp = await apiFetch<ServiceItemRow[]>(
        `/api/infrastructure/services?${buildQS({
          branchId,
          q: q.trim() || undefined,
          includeInactive: includeInactive ? "true" : undefined,
        })}`,
      );
      setAllRows(resp || []);
      if (showToast) toast({ title: "Service library refreshed", description: "Loaded latest service items." });
    } catch (e: any) {
      const msg = e?.message || "Failed to load service items";
      setErr(msg);
      setAllRows([]);
      if (showToast) toast({ title: "Refresh failed", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll(showToast = false) {
    setErr(null);
    setLoading(true);
    try {
      const bid = branchId || (await loadBranches());
      if (!bid) {
        setLoading(false);
        return;
      }
      await loadServices(false);
      if (showToast) toast({ title: "Service Library ready", description: "Branch scope and service items are up to date." });
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
    setPage(1);
    void loadServices(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, includeInactive]);

  React.useEffect(() => {
    if (!branchId) return;
    setPage(1);
    const t = setTimeout(() => void loadServices(false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function onBranchChange(nextId: string) {
    setBranchId(nextId);
    writeLS(LS_BRANCH, nextId);

    // reset filters
    setQ("");
    setIncludeInactive(false);
    setCategory("all");
    setMappingStatus("all");
    setOrderable("all");
    setPage(1);

    setErr(null);
    setLoading(true);
    try {
      await loadServices(false);
      toast({ title: "Branch scope changed", description: "Loaded service items for selected branch." });
    } catch (e: any) {
      const msg = e?.message || "Failed to load branch scope";
      setErr(msg);
      toast({ variant: "destructive", title: "Load failed", description: msg });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setSvcDialogOpen(true);
  }

  function openEdit(r: ServiceItemRow) {
    setEditing(r);
    setSvcDialogOpen(true);
  }

  const filtered = React.useMemo(() => {
    let rows = [...(allRows || [])];

    if (category !== "all") {
      rows = rows.filter((r) => (r.category || "").trim() === category);
    }
    if (mappingStatus === "mapped") {
      rows = rows.filter((r) => isMapped(r));
    }
    if (mappingStatus === "missing") {
      rows = rows.filter((r) => !isMapped(r));
    }
    if (orderable === "yes") {
      rows = rows.filter((r) => Boolean(r.isOrderable));
    }
    if (orderable === "no") {
      rows = rows.filter((r) => !r.isOrderable);
    }

    return rows;
  }, [allRows, category, mappingStatus, orderable]);

  const totals = React.useMemo(() => {
    const total = allRows.length;
    const inactive = allRows.filter((r) => !r.isActive).length;
    const notOrderable = allRows.filter((r) => !r.isOrderable).length;
    const missingMap = allRows.filter((r) => !isMapped(r)).length;
    return { total, inactive, notOrderable, missingMap };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows]);

  const totalPages = React.useMemo(() => {
    return Math.max(1, Math.ceil(filtered.length / pageSize));
  }, [filtered.length, pageSize]);

  const pageRows = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <AppShell title="Infrastructure • Service Library">
      <div className="grid gap-6">
        {/* Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
              <ShieldCheck className="h-5 w-5 text-zc-accent" />
            </span>
            <div className="min-w-0">
              <div className="text-3xl font-semibold tracking-tight">Service Library</div>
              <div className="mt-1 text-sm text-zc-muted">
                Define the hospital’s orderable services (Lab/Radiology/Procedure/etc.) for the selected branch.
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
              New Service
            </Button>
          </div>
        </div>

        {err ? (
          <Card className="border-zc-danger/40">
            <CardHeader className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-zc-danger" />
                <div>
                  <CardTitle className="text-base">Could not load services</CardTitle>
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
              Pick a branch, search services, and fix missing charge mappings as you go.
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

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Services</div>
                <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{totals.total}</div>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-900/10">
                <div className="text-xs font-medium text-rose-600 dark:text-rose-400">Missing Charge Mapping</div>
                <div className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">{totals.missingMap}</div>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-900/10">
                <div className="text-xs font-medium text-violet-600 dark:text-violet-400">Inactive</div>
                <div className="mt-1 text-lg font-bold text-violet-700 dark:text-violet-300">{totals.inactive}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
                <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Not Orderable</div>
                <div className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">{totals.notOrderable}</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by code, name, or category..."
                  className="pl-10"
                  disabled={mustSelectBranch}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                  <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} disabled={mustSelectBranch} />
                  <div className="text-sm">
                    <div className="font-semibold text-zc-text">Include inactive</div>
                    <div className="text-xs text-zc-muted">Show inactive service items too</div>
                  </div>
                </div>

                {activeTab === "services" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowFilters((s) => !s)}
                    disabled={mustSelectBranch}
                  >
                    <Filter className="h-4 w-4" />
                    {showFilters ? "Hide Filters" : "Show Filters"}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Branch scoped</Badge>
              <Badge variant={totals.missingMap > 0 ? "destructive" : "ok"}>
                Missing mapping: {totals.missingMap}
              </Badge>
              <Badge variant={totals.inactive > 0 ? "warning" : "secondary"}>Inactive: {totals.inactive}</Badge>
              <Badge variant={totals.notOrderable > 0 ? "accent" : "secondary"}>Not orderable: {totals.notOrderable}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Main tabs */}
        <Card>
          <CardHeader className="py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Manage Services</CardTitle>
                <CardDescription>Create services, keep them orderable, and maintain charge mappings.</CardDescription>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className={cn("h-10 rounded-2xl border border-zc-border bg-zc-panel/20 p-1")}>
                  <TabsTrigger
                    value="services"
                    className={cn(
                      "rounded-xl px-3 data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm",
                    )}
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Services
                  </TabsTrigger>
                  <TabsTrigger
                    value="guide"
                    className={cn(
                      "rounded-xl px-3 data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm",
                    )}
                  >
                    <Wrench className="mr-2 h-4 w-4" />
                    Quick Guide
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <CardContent className="pb-6">
            <Tabs value={activeTab}>
              <TabsContent value="services" className="mt-0">
                <div className="grid gap-4">
                  {/* Filters */}
                  {showFilters ? (
                    <div className="grid gap-3 rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                        <Filter className="h-4 w-4 text-zc-accent" />
                        Filters
                      </div>

                      <div className="grid gap-3 md:grid-cols-12">
                        <div className="md:col-span-4">
                          <Label className="text-xs text-zc-muted">Category</Label>
                          <Select
                            value={category}
                            onValueChange={(v) => {
                              setPage(1);
                              setCategory(v as any);
                            }}
                            disabled={mustSelectBranch}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[320px] overflow-y-auto">
                              <SelectItem value="all">All</SelectItem>
                              {categoryOptions.length === 0 ? (
                                <SelectItem value="__none" disabled>
                                  No categories
                                </SelectItem>
                              ) : (
                                categoryOptions.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-4">
                          <Label className="text-xs text-zc-muted">Charge Mapping</Label>
                          <Select
                            value={mappingStatus}
                            onValueChange={(v) => {
                              setPage(1);
                              setMappingStatus(v as any);
                            }}
                            disabled={mustSelectBranch}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="mapped">Mapped</SelectItem>
                              <SelectItem value="missing">Missing mapping</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-4">
                          <Label className="text-xs text-zc-muted">Orderable</Label>
                          <Select
                            value={orderable}
                            onValueChange={(v) => {
                              setPage(1);
                              setOrderable(v as any);
                            }}
                            disabled={mustSelectBranch}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="yes">Orderable</SelectItem>
                              <SelectItem value="no">Not orderable</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Table */}
                  <div className="rounded-xl border border-zc-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[170px]">Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="w-[190px]">Category</TableHead>
                          <TableHead className="w-[120px]">Unit</TableHead>
                          <TableHead className="w-[120px]">Orderable</TableHead>
                          <TableHead className="w-[120px]">Active</TableHead>
                          <TableHead className="w-[240px]">Charge Mapping</TableHead>
                          <TableHead className="w-[180px]">Updated</TableHead>
                          <TableHead className="w-[70px]"></TableHead>
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
                        ) : pageRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9}>
                              <div className="flex items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                                <ClipboardList className="h-4 w-4" />
                                No services found for the current filters.
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          pageRows.map((r) => {
                            const m = currentMapping(r);
                            const cm = m?.chargeMasterItem;
                            return (
                              <TableRow key={r.id}>
                                <TableCell className="font-mono text-xs">
                                  <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-zc-text">{r.code}</span>
                                    <span className="text-[11px] text-zc-muted">{String(r.id).slice(0, 8)}…</span>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-zc-text">{r.name}</span>
                                    <span className="text-xs text-zc-muted">
                                      {r.isOrderable ? "Orderable in clinical screens" : "Hidden from ordering"}
                                    </span>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-sm text-zc-text">{r.category}</span>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <Badge variant="secondary">{r.unit || "—"}</Badge>
                                </TableCell>

                                <TableCell>
                                  {r.isOrderable ? <Badge variant="ok">Yes</Badge> : <Badge variant="secondary">No</Badge>}
                                </TableCell>

                                <TableCell>
                                  {r.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                                </TableCell>

                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <div>{mappingBadge(r)}</div>
                                    {cm?.code || cm?.name ? (
                                      <div className="text-xs text-zc-muted">
                                        {cm?.code ? <span className="font-mono">{cm.code}</span> : null}
                                        {cm?.name ? <span>{cm?.code ? ` • ${cm.name}` : cm.name}</span> : null}
                                      </div>
                                    ) : !isMapped(r) ? (
                                      <div className="text-xs text-zc-muted">
                                        <Link
                                          href={`/superadmin/infrastructure/service-mapping?serviceItemId=${encodeURIComponent(r.id)}`}
                                          className="inline-flex items-center gap-1 text-zc-accent hover:underline"
                                        >
                                          Fix mapping <ExternalLink className="h-3 w-3" />
                                        </Link>
                                      </div>
                                    ) : null}
                                  </div>
                                </TableCell>

                                <TableCell className="text-sm text-zc-muted">
                                  {fmtDateTime(r.updatedAt || r.createdAt || null)}
                                </TableCell>

                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[240px]">
                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                      <DropdownMenuItem onClick={() => openEdit(r)}>
                                        <Wrench className="mr-2 h-4 w-4" />
                                        Edit
                                      </DropdownMenuItem>

                                      <DropdownMenuItem asChild>
                                        <Link href={`/superadmin/infrastructure/service-mapping?serviceItemId=${encodeURIComponent(r.id)}`}>
                                          <ExternalLink className="mr-2 h-4 w-4" />
                                          Open mapping
                                        </Link>
                                      </DropdownMenuItem>

                                      <DropdownMenuSeparator />

                                      <DropdownMenuItem
                                        onClick={() => {
                                          const text = `${r.code} • ${r.name}\nCategory: ${r.category}\nOrderable: ${
                                            r.isOrderable ? "Yes" : "No"
                                          }\nActive: ${r.isActive ? "Yes" : "No"}\nMapped: ${isMapped(r) ? "Yes" : "No"}`;
                                          navigator.clipboard?.writeText(text).then(
                                            () => toast({ title: "Copied", description: "Service summary copied to clipboard." }),
                                            () => toast({ title: "Copy failed", description: "Could not access clipboard." }),
                                          );
                                        }}
                                      >
                                        Copy summary
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
                        Showing <span className="font-semibold text-zc-text">{pageRows.length}</span> of{" "}
                        <span className="font-semibold text-zc-text">{filtered.length}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={String(pageSize)}
                          onValueChange={(v) => {
                            setPage(1);
                            setPageSize(Number(v));
                          }}
                          disabled={mustSelectBranch}
                        >
                          <SelectTrigger className="h-9 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[25, 50, 100, 200].map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                Page size: {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          className="h-9"
                          disabled={mustSelectBranch || page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          className="h-9"
                          disabled={mustSelectBranch || page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </Button>

                        <Badge variant="secondary">
                          Page {page} / {totalPages}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="guide" className="mt-0">
                <div className="grid gap-4">
                  <Card className="border-zc-border">
                    <CardHeader className="py-4">
                      <CardTitle className="text-base">How to configure (recommended order)</CardTitle>
                      <CardDescription>
                        Follow this sequence to avoid getting lost during infra setup.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                            <Badge variant="ok">1</Badge> Create Service Items
                          </div>
                          <div className="mt-1 text-sm text-zc-muted">
                            Define services with correct category and whether they are orderable/active.
                          </div>
                        </div>

                        <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                            <Badge variant="ok">2</Badge> Map to Charge Master
                          </div>
                          <div className="mt-1 text-sm text-zc-muted">
                            Each billable service should map to a ChargeMasterItem (FixIt opens if missing).
                          </div>
                          <div className="mt-3">
                            <Button variant="outline" asChild className="gap-2">
                              <Link href="/superadmin/infrastructure/service-mapping">
                                Open Service Mapping <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                            <Badge variant="ok">3</Badge> Tariff Rates (Branch Price List)
                          </div>
                          <div className="mt-1 text-sm text-zc-muted">
                            Add rates per ChargeMasterItem in the active Tariff Plan for this branch.
                          </div>
                          <div className="mt-3">
                            <Button variant="outline" asChild className="gap-2">
                              <Link href="/superadmin/infrastructure/tariff-plans">
                                Open Tariff Plans <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                            <Badge variant="ok">4</Badge> Scheduling (if appointment-based)
                          </div>
                          <div className="mt-1 text-sm text-zc-muted">
                            For services that need scheduling, define availability rules so GoLive passes.
                          </div>
                          <div className="mt-3">
                            <Button variant="outline" asChild className="gap-2">
                              <Link href="/superadmin/infrastructure/service-availability">
                                Open Availability <ExternalLink className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                          <AlertTriangle className="h-4 w-4 text-zc-warn" />
                          Tip: Fix missing mappings immediately
                        </div>
                        <div className="mt-1 text-sm text-zc-muted">
                          If you create a service without a charge mapping, the backend opens a FixIt. In this page,
                          you’ll also see a <span className="font-semibold">MAPPING MISSING</span> badge so you can jump to mapping.
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit dialog */}
      <ServiceItemDialog
        open={svcDialogOpen}
        onOpenChange={setSvcDialogOpen}
        branchId={branchId}
        editing={editing}
        onSaved={async () => {
          toast({ title: editing ? "Service updated" : "Service created", description: "Saved successfully." });
          await loadServices(false);
        }}
      />
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Create/Edit Dialog                              */
/* -------------------------------------------------------------------------- */

function ServiceItemDialog({
  open,
  onOpenChange,
  branchId,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  editing: ServiceItemRow | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState<{
    code: string;
    name: string;
    category: string;
    unit: string;
    isOrderable: boolean;
    isActive: boolean;
    chargeMasterCode: string;
    notes: string;
  }>({
    code: "",
    name: "",
    category: "",
    unit: "",
    isOrderable: true,
    isActive: true,
    chargeMasterCode: "",
    notes: "",
  });

  React.useEffect(() => {
    if (!open) return;
    setForm({
      code: editing?.code || "",
      name: editing?.name || "",
      category: editing?.category || "",
      unit: editing?.unit || "",
      isOrderable: Boolean(editing?.isOrderable ?? true),
      isActive: Boolean(editing?.isActive ?? true),
      chargeMasterCode: "", // create-only convenience; backend ignores on update
      notes: "",
    });
  }, [open, editing]);

  function patch(p: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function normalizePayload() {
    const payload: any = {
      code: String(form.code || "").trim(),
      name: String(form.name || "").trim(),
      category: String(form.category || "").trim(),
      unit: form.unit?.trim() ? String(form.unit).trim() : null,
      isOrderable: Boolean(form.isOrderable),
      isActive: Boolean(form.isActive),
    };

    // Only send chargeMasterCode on create; update ignores it in current backend.
    if (!editing && form.chargeMasterCode.trim()) payload.chargeMasterCode = form.chargeMasterCode.trim();
    return payload;
  }

  async function save() {
    if (!branchId) return;
    const payload = normalizePayload();
    if (!payload.code || !payload.name || !payload.category) {
      toast({ title: "Missing fields", description: "Code, Name and Category are required." });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/infrastructure/services/${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/infrastructure/services?branchId=${encodeURIComponent(branchId)}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setSaving(false);
    }
  }

  const mappings = editing?.mappings || [];
  const latest = mappings[0] || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={drawerClassName()}>
        <ModalHeader
          title={editing ? "Edit Service Item" : "New Service Item"}
          description="Define an orderable service. Optionally map it to a ChargeMaster code during create."
          icon={<ClipboardList className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        />

        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(e) => patch({ code: e.target.value })}
                placeholder="e.g., CBC, XRAY-CHEST, CONSULT-GEN"
              />
              <div className="text-xs text-zc-muted min-h-[16px]">
                Keep code stable. Used in audits and integrations.
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g., Complete Blood Count" />
              <div className="text-xs text-zc-muted min-h-[16px] invisible" aria-hidden="true">
                Placeholder helper
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => patch({ category: e.target.value })} placeholder="e.g., LAB, RADIOLOGY, PROCEDURE" />
              <div className="text-xs text-zc-muted min-h-[16px]">
                Category drives grouping in catalogues and ordering UI.
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Unit (optional)</Label>
              <Input value={form.unit} onChange={(e) => patch({ unit: e.target.value })} placeholder="e.g., Test, Scan, Session" />
              <div className="text-xs text-zc-muted min-h-[16px] invisible" aria-hidden="true">
                Placeholder helper
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-zc-border bg-zc-panel/10 p-4">
              <Switch checked={form.isOrderable} onCheckedChange={(v) => patch({ isOrderable: v })} />
              <div>
                <div className="text-sm font-semibold text-zc-text">Orderable</div>
                <div className="text-sm text-zc-muted">
                  If disabled, this item won’t appear in ordering screens (kept for history).
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-zc-border bg-zc-panel/10 p-4">
              <Switch checked={form.isActive} onCheckedChange={(v) => patch({ isActive: v })} />
              <div>
                <div className="text-sm font-semibold text-zc-text">Active</div>
                <div className="text-sm text-zc-muted">
                  Use inactive for retired services. You can still keep them non-orderable.
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {!editing ? (
            <div className="grid gap-2">
              <Label>ChargeMaster Code (optional)</Label>
              <Input
                value={form.chargeMasterCode}
                onChange={(e) => patch({ chargeMasterCode: e.target.value })}
                placeholder="e.g., CM-CBC (if provided, mapping will be created)"
              />
              <div className="text-xs text-zc-muted">
                If blank, backend opens a FixIt for missing mapping. You can also map later from the Mapping screen.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zc-text">Charge Mapping</div>
                  <div className="text-sm text-zc-muted">
                    Mapping is managed in <span className="font-semibold">Service ↔ Charge Mapping</span>.
                  </div>
                </div>
                <Button variant="outline" asChild className="gap-2">
                  <Link href={`/superadmin/infrastructure/service-mapping?serviceItemId=${encodeURIComponent(editing.id)}`}>
                    Open mapping <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <Separator className="my-4" />

              <div className="rounded-xl border border-zc-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[220px]">Charge Master</TableHead>
                      <TableHead className="w-[200px]">Effective From</TableHead>
                      <TableHead className="w-[200px]">Effective To</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <div className="flex items-center justify-center gap-2 py-8 text-sm text-zc-muted">
                            <AlertTriangle className="h-4 w-4 text-zc-warn" /> No mapping history found.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      mappings.slice(0, 5).map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-mono text-xs">
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-zc-text">{m.chargeMasterItem?.code || "—"}</span>
                              <span className="text-[11px] text-zc-muted">{m.chargeMasterItem?.name || ""}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-zc-muted">{fmtDateTime(m.effectiveFrom)}</TableCell>
                          <TableCell className="text-sm text-zc-muted">{fmtDateTime(m.effectiveTo || null)}</TableCell>
                          <TableCell>
                            {m.effectiveTo ? <Badge variant="secondary">CLOSED</Badge> : <Badge variant="ok">ACTIVE</Badge>}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {latest && !latest.effectiveTo ? (
                <div className="mt-3 text-xs text-zc-muted">
                  Current mapping:{" "}
                  <span className="font-mono font-semibold text-zc-text">{latest.chargeMasterItem?.code || "—"}</span>
                </div>
              ) : null}
            </div>
          )}

          <div className="grid gap-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Internal notes about this service item..."
              className="min-h-[90px]"
            />
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
      </DialogContent>
    </Dialog>
  );
}
