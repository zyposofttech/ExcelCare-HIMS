"use client";

import * as React from "react";
import { AppLink as Link } from "@/components/app-link";
import { AppShell } from "@/components/AppShell";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Filter,
  MoreHorizontal,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UploadCloud,
  Wrench,
  Trash2,
  Eye,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type BranchRow = { id: string; code: string; name: string; city?: string };

type PackageStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "RETIRED";

type ChargeMasterItemRow = {
  id: string;
  code: string;
  name: string;
  chargeUnit?: string | null;
  isActive?: boolean;
};

type ServiceItemRow = {
  id: string;
  code: string;
  name: string;
  isBillable?: boolean;
  lifecycleStatus?: string | null;
  chargeUnit?: string | null;
};

type ServicePackageItemRow = {
  id: string;
  packageId: string;

  // Prefer ChargeMasterItem for billing-pricing consistency
  chargeMasterItemId: string;
  chargeMasterItem?: ChargeMasterItemRow | null;

  // Optional serviceItem for ordering linkage (if your backend supports it)
  serviceItemId?: string | null;
  serviceItem?: ServiceItemRow | null;

  qty: number;
  isIncluded: boolean;
  isOptional: boolean;
  sortOrder: number;

  // optional override knobs (keep as JSON-friendly)
  overrides?: any;

  createdAt?: string;
  updatedAt?: string;
};

type ServicePackageRow = {
  id: string;
  branchId: string;

  code: string;
  name: string;
  description?: string | null;

  status: PackageStatus;
  version: number;

  // pricing behavior for advanced billing
  pricingModel?: "INCLUSIVE" | "EXCLUSIVE" | null; // inclusive/exclusive package pricing
  capAmount?: number | null;
  discountPercent?: number | null;

  // tax behavior (backend should enforce active tax codes)
  taxTreatment?: "PACKAGE_LEVEL" | "ITEM_LEVEL" | null;

  // governance
  effectiveFrom?: string;
  effectiveTo?: string | null;

  isActive?: boolean;

  items?: ServicePackageItemRow[];

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

function statusBadge(status: PackageStatus) {
  switch (status) {
    case "PUBLISHED":
      return <Badge variant="ok">PUBLISHED</Badge>;
    case "APPROVED":
      return <Badge variant="secondary">APPROVED</Badge>;
    case "IN_REVIEW":
      return <Badge variant="warning">IN REVIEW</Badge>;
    case "RETIRED":
      return <Badge variant="destructive">RETIRED</Badge>;
    default:
      return <Badge variant="secondary">DRAFT</Badge>;
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function SuperAdminServicePackagesPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<"packages" | "guide">("packages");
  const [showFilters, setShowFilters] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState<string>("");

  const [rows, setRows] = React.useState<ServicePackageRow[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [selected, setSelected] = React.useState<ServicePackageRow | null>(null);

  // filters
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<PackageStatus | "all">("all");
  const [includeInactive, setIncludeInactive] = React.useState(false);

  // modals/drawers
  const [editOpen, setEditOpen] = React.useState(false);
  const [editMode, setEditMode] = React.useState<"create" | "edit">("create");
  const [editing, setEditing] = React.useState<ServicePackageRow | null>(null);

  const [itemsOpen, setItemsOpen] = React.useState(false);

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

  async function loadPackages(showToast = false) {
    if (!branchId) return;
    setErr(null);
    setLoading(true);
    try {
      const res = (await apiFetch<ServicePackageRow[]>(
        `/api/infrastructure/service-packages?${buildQS({
          branchId,
          q: q.trim() || undefined,
          status: status !== "all" ? status : undefined,
          includeInactive: includeInactive ? "true" : undefined,
          includeItems: "true",
        })}`,
      )) as any;

      const list: ServicePackageRow[] = Array.isArray(res) ? res : (res?.rows || []);
      setRows(list);

      const nextSelected = selectedId && list.some((x) => x.id === selectedId) ? selectedId : list[0]?.id || "";
      setSelectedId(nextSelected);
      setSelected(nextSelected ? list.find((x) => x.id === nextSelected) || null : null);

      if (showToast) toast({ title: "Packages refreshed", description: "Loaded latest packages for this branch." });
    } catch (e: any) {
      const msg = e?.message || "Failed to load service packages";
      setErr(msg);
      setRows([]);
      setSelectedId("");
      setSelected(null);
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
      await loadPackages(false);
      if (showToast) toast({ title: "Ready", description: "Branch scope and packages are up to date." });
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
    setSelectedId("");
    setSelected(null);
    void loadPackages(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, includeInactive]);

  React.useEffect(() => {
    if (!branchId) return;
    const t = setTimeout(() => void loadPackages(false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  React.useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    setSelected(rows.find((x) => x.id === selectedId) || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, rows]);

  async function onBranchChange(nextId: string) {
    setBranchId(nextId);
    writeLS(LS_BRANCH, nextId);

    setQ("");
    setStatus("all");
    setIncludeInactive(false);
    setSelectedId("");
    setSelected(null);

    setErr(null);
    setLoading(true);
    try {
      await loadPackages(false);
      toast({ title: "Branch scope changed", description: "Loaded packages for selected branch." });
    } catch (e: any) {
      toast({ title: "Load failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  const stats = React.useMemo(() => {
    const total = rows.length;
    const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    const published = byStatus.PUBLISHED || 0;
    const draft = byStatus.DRAFT || 0;
    const review = byStatus.IN_REVIEW || 0;
    const approved = byStatus.APPROVED || 0;
    const retired = byStatus.RETIRED || 0;
    const totalItems = rows.reduce((n, r) => n + (r.items?.length || 0), 0);
    return { total, published, draft, review, approved, retired, totalItems };
  }, [rows]);

  function openCreate() {
    setEditMode("create");
    setEditing(null);
    setEditOpen(true);
  }

  function openEdit(row: ServicePackageRow) {
    setEditMode("edit");
    setEditing(row);
    setEditOpen(true);
  }

  async function workflow(row: ServicePackageRow, action: "submit" | "approve" | "publish" | "retire") {
    if (!row?.id) return;
    const note = window.prompt(`Optional note for ${action.toUpperCase()} (leave blank for none):`) || "";
    setBusy(true);
    try {
      await apiFetch(`/api/infrastructure/service-packages/${encodeURIComponent(row.id)}/workflow/${action}`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim() ? note.trim() : undefined }),
      });
      toast({ title: "Workflow updated", description: `Action ${action.toUpperCase()} applied.` });
      await loadPackages(false);
    } catch (e: any) {
      toast({ title: "Workflow failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Infrastructure • Service Packages">
      <div className="grid gap-6">
        {/* Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
              <Package className="h-5 w-5 text-zc-accent" />
            </span>
            <div className="min-w-0">
              <div className="text-3xl font-semibold tracking-tight">Service Packages</div>
              <div className="mt-1 text-sm text-zc-muted">
                Curate package details + pricing rulesin the workspace.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="px-5 gap-2" onClick={() => refreshAll(true)} disabled={loading || busy}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>

            {/* <Button variant="outline" asChild className="px-5 gap-2">
              <Link href="/superadmin/infrastructure/golive">
                <ShieldCheck className="h-4 w-4" />
                GoLive
              </Link>
            </Button> */}

            <Button variant="outline" asChild className="px-5 gap-2">
              <Link href="/superadmin/infrastructure/fixit">
                <Wrench className="h-4 w-4" />
                FixIt Inbox
              </Link>
            </Button>

            <Button variant="primary" className="px-5 gap-2" onClick={openCreate} disabled={mustSelectBranch}>
              <Plus className="h-4 w-4" />
              New Package
            </Button>
          </div>
        </div>

        {err ? (
          <Card className="border-zc-danger/40">
            <CardHeader className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-zc-danger" />
                <div>
                  <CardTitle className="text-base">Could not load packages</CardTitle>
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
              Pick a branch → create package → add ChargeMaster items (and optionally service items) → publish. Billing & GoLive validations rely on ChargeMaster linkage.
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
                      {b.code} - {b.name} {b.city ? `(${b.city})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Packages</div>
                <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{stats.total}</div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Published</div>
                <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{stats.published}</div>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-900/10">
                <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Total Package Items</div>
                <div className="mt-1 text-lg font-bold text-indigo-700 dark:text-indigo-300">{stats.totalItems}</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by code/name…"
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
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </Button>
              </div>
            </div>

            {showFilters ? (
              <div className="grid gap-3 rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                  <Filter className="h-4 w-4 text-zc-accent" />
                  Filters
                </div>

                <div className="grid gap-3 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <Label className="text-xs text-zc-muted">Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as any)} disabled={mustSelectBranch}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any</SelectItem>
                        <SelectItem value="DRAFT">DRAFT</SelectItem>
                        <SelectItem value="IN_REVIEW">IN_REVIEW</SelectItem>
                        <SelectItem value="APPROVED">APPROVED</SelectItem>
                        <SelectItem value="PUBLISHED">PUBLISHED</SelectItem>
                        <SelectItem value="RETIRED">RETIRED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Branch scoped</Badge>
              <Badge variant="secondary">Draft: {stats.draft}</Badge>
              <Badge variant="warning">In review: {stats.review}</Badge>
              <Badge variant="secondary">Approved: {stats.approved}</Badge>
              <Badge variant="ok">Published: {stats.published}</Badge>
              <Badge variant="destructive">Retired: {stats.retired}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Workspace */}
        <Card>
          <CardHeader className="py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Package Workspace</CardTitle>
                <CardDescription>Create packages and curate charge items inside each package.</CardDescription>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className={cn("h-10 rounded-2xl border border-zc-border bg-zc-panel/20 p-1")}>
                  <TabsTrigger
                    value="packages"
                    className={cn(
                      "rounded-xl px-3 data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm",
                    )}
                  >
                    <Package className="mr-2 h-4 w-4" />
                    Packages
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
              <TabsContent value="packages" className="mt-0">
                <div className="rounded-xl border border-zc-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[140px]">Status</TableHead>
                        <TableHead className="w-[160px]">Pricing</TableHead>
                        <TableHead className="w-[120px]">Items</TableHead>
                        <TableHead className="w-[72px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={6}>
                              <Skeleton className="h-6 w-full" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6}>
                            <div className="flex items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                              <ClipboardList className="h-4 w-4" />
                              No packages found. Create one to begin.
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-xs">
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-zc-text">{r.code}</span>
                                <span className="text-[11px] text-zc-muted">v{r.version ?? 1}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-zc-text">{r.name}</span>
                                <span className="text-xs text-zc-muted">{r.taxTreatment || "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell className="text-sm text-zc-muted">{r.pricingModel || "—"}</TableCell>
                            <TableCell className="text-sm text-zc-muted">{r.items?.length || 0}</TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[240px]">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem asChild>
                                    <Link href={`/superadmin/infrastructure/service-packages/${encodeURIComponent(r.id)}`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View details
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEdit(r)}>
                                    <Wrench className="mr-2 h-4 w-4" />
                                    Edit package
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelected(r);
                                      setSelectedId(r.id);
                                      setItemsOpen(true);
                                    }}
                                  >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Manage items
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => workflow(r, "submit")}>
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit for review
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => workflow(r, "approve")}>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => workflow(r, "publish")}>
                                    <UploadCloud className="mr-2 h-4 w-4" />
                                    Publish
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => workflow(r, "retire")}>
                                    <Archive className="mr-2 h-4 w-4" />
                                    Retire
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                        <Link href="/superadmin/infrastructure/charge-master">
                          Charge Master <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" asChild>
                        <Link href="/superadmin/infrastructure/tariff-plans">
                          Tariff Plans <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="guide" className="mt-0">
                <Card className="border-zc-border">
                  <CardHeader className="py-4">
                    <CardTitle className="text-base">How to use Service Packages</CardTitle>
                    <CardDescription>Packages are governed bundles: ordering + billing stays consistent via ChargeMaster.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                          <Badge variant="ok">1</Badge> Create package (branch scoped)
                        </div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Decide pricing model: <span className="font-semibold">INCLUSIVE</span> (package priced as a bundle) or{" "}
                          <span className="font-semibold">EXCLUSIVE</span> (items billed individually with package rules).
                        </div>
                      </div>

                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                          <Badge variant="ok">2</Badge> Add ChargeMaster items
                        </div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Each package line item references <span className="font-semibold">ChargeMasterItem</span>. This keeps tax & charge unit enforcement aligned.
                        </div>
                      </div>

                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                          <Badge variant="ok">3</Badge> Publish (version snapshot)
                        </div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Publishing locks the version. Future edits should create a new version with effectiveFrom/To closing.
                        </div>
                      </div>

                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                          <Badge variant="ok">4</Badge> Billing readiness
                        </div>
                        <div className="mt-1 text-sm text-zc-muted">
                          GoLive validations should flag: missing tariff rates, tax inactive, charge unit mismatches, and missing package pricing rules.
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                        <AlertTriangle className="h-4 w-4 text-zc-warn" />
                        Practical tip
                      </div>
                      <div className="mt-1 text-sm text-zc-muted">
                        Keep package items ordered (sortOrder) and mark optional items explicitly. Use overrides JSON for future rules (caps, constraints).
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit modal */}
      <PackageEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode={editMode}
        branchId={branchId}
        editing={editing}
        onSaved={async () => {
          toast({ title: "Saved", description: "Package saved successfully." });
          await loadPackages(false);
        }}
      />

      {/* Items drawer */}
      <PackageItemsDrawer
        open={itemsOpen}
        onOpenChange={setItemsOpen}
        branchId={branchId}
        pkg={selected}
        onSaved={async () => {
          toast({ title: "Updated", description: "Package items updated." });
          await loadPackages(false);
        }}
      />
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Create/Edit Modal                              */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

function PackageEditModal({
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
  editing: ServicePackageRow | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState<any>({
    code: "",
    name: "",
    description: "",
    pricingModel: "INCLUSIVE",
    taxTreatment: "PACKAGE_LEVEL",
    capAmount: "",
    discountPercent: "",
    isActive: true,
  });

  React.useEffect(() => {
    if (!open) return;
    if (mode === "edit" && editing) {
      setForm({
        code: editing.code || "",
        name: editing.name || "",
        description: editing.description || "",
        pricingModel: editing.pricingModel || "INCLUSIVE",
        taxTreatment: editing.taxTreatment || "PACKAGE_LEVEL",
        capAmount: editing.capAmount ?? "",
        discountPercent: editing.discountPercent ?? "",
        isActive: editing.isActive !== false,
      });
    } else {
      setForm({
        code: "",
        name: "",
        description: "",
        pricingModel: "INCLUSIVE",
        taxTreatment: "PACKAGE_LEVEL",
        capAmount: "",
        discountPercent: "",
        isActive: true,
      });
    }
  }, [open, mode, editing]);

  function patch(p: Partial<any>) {
    setForm((prev: any) => ({ ...prev, ...p }));
  }

  async function save() {
    if (!branchId) return;

    const payload: any = {
      code: String(form.code || "").trim(),
      name: String(form.name || "").trim(),
      description: form.description?.trim() ? String(form.description).trim() : null,
      pricingModel: form.pricingModel || "INCLUSIVE",
      taxTreatment: form.taxTreatment || "PACKAGE_LEVEL",
      capAmount: form.capAmount === "" || form.capAmount === null ? null : Number(form.capAmount),
      discountPercent: form.discountPercent === "" || form.discountPercent === null ? null : Number(form.discountPercent),
      isActive: Boolean(form.isActive),
    };

    if (!payload.code || !payload.name) {
      toast({ title: "Missing fields", description: "Code and Name are required." });
      return;
    }

    if (payload.discountPercent !== null && (payload.discountPercent < 0 || payload.discountPercent > 100)) {
      toast({ title: "Invalid discount", description: "Discount percent must be between 0 and 100." });
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await apiFetch(`/api/infrastructure/service-packages?${buildQS({ branchId })}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        if (!editing?.id) throw new Error("Invalid editing row");
        await apiFetch(`/api/infrastructure/service-packages/${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={drawerClassName()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <Wrench className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            {mode === "create" ? "New Service Package" : "Edit Service Package"}
          </DialogTitle>
          <DialogDescription>Define package details + pricing rules. Add items in the next step.</DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="px-6 pb-6 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input value={form.code || ""} onChange={(e) => patch({ code: e.target.value })} placeholder="e.g., WELLNESS-BASIC" />
              <div className="text-xs text-zc-muted min-h-[16px] invisible" aria-hidden="true">
                Placeholder helper
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={form.name || ""} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g., Basic Wellness Package" />
              <div className="text-xs text-zc-muted min-h-[16px] invisible" aria-hidden="true">
                Placeholder helper
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Pricing Model</Label>
              <Select value={form.pricingModel || "INCLUSIVE"} onValueChange={(v) => patch({ pricingModel: v })}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCLUSIVE">INCLUSIVE (bundle price)</SelectItem>
                  <SelectItem value="EXCLUSIVE">EXCLUSIVE (items billed with rules)</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-zc-muted min-h-[16px]">
                Inclusive is typical for health check packages. Exclusive fits add-on bundles.
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Tax Treatment</Label>
              <Select value={form.taxTreatment || "PACKAGE_LEVEL"} onValueChange={(v) => patch({ taxTreatment: v })}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PACKAGE_LEVEL">PACKAGE_LEVEL (single tax)</SelectItem>
                  <SelectItem value="ITEM_LEVEL">ITEM_LEVEL (per item)</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-zc-muted min-h-[16px]">
                Backend should enforce active tax codes on package/items.
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Cap Amount (optional)</Label>
              <Input value={String(form.capAmount ?? "")} onChange={(e) => patch({ capAmount: e.target.value })} placeholder="e.g., 5000" />
              <div className="text-xs text-zc-muted min-h-[16px]">
                Used in advanced rules (caps/limits). Keep null if not needed.
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Discount % (optional)</Label>
              <Input
                value={String(form.discountPercent ?? "")}
                onChange={(e) => patch({ discountPercent: e.target.value })}
                placeholder="e.g., 10"
              />
              <div className="text-xs text-zc-muted min-h-[16px] invisible" aria-hidden="true">
                Placeholder helper
              </div>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label>Description (optional)</Label>
              <Textarea value={form.description || ""} onChange={(e) => patch({ description: e.target.value })} placeholder="What does this package include?" />
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-3 md:col-span-2">
              <Switch checked={!!form.isActive} onCheckedChange={(v) => patch({ isActive: v })} />
              <div className="text-sm">
                <div className="font-semibold text-zc-text">Active</div>
                <div className="text-xs text-zc-muted">Inactive packages should not be used in ordering.</div>
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
/*                               Items Drawer                                  */
/* -------------------------------------------------------------------------- */

function PackageItemsDrawer({
  open,
  onOpenChange,
  branchId,
  pkg,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  pkg: ServicePackageRow | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(false);
  const [detail, setDetail] = React.useState<ServicePackageRow | null>(null);

  // search charge master + service (optional)
  const [cmQ, setCmQ] = React.useState("");
  const [cmLoading, setCmLoading] = React.useState(false);
  const [cmRows, setCmRows] = React.useState<ChargeMasterItemRow[]>([]);
  const [pickedCm, setPickedCm] = React.useState<ChargeMasterItemRow | null>(null);

  const [svcQ, setSvcQ] = React.useState("");
  const [svcLoading, setSvcLoading] = React.useState(false);
  const [svcRows, setSvcRows] = React.useState<ServiceItemRow[]>([]);
  const [pickedSvc, setPickedSvc] = React.useState<ServiceItemRow | null>(null);

  // item fields
  const [qty, setQty] = React.useState<string>("1");
  const [isIncluded, setIsIncluded] = React.useState(true);
  const [isOptional, setIsOptional] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState<string>("0");
  const [overridesText, setOverridesText] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setDetail(null);
    setCmQ("");
    setCmRows([]);
    setPickedCm(null);
    setSvcQ("");
    setSvcRows([]);
    setPickedSvc(null);
    setQty("1");
    setIsIncluded(true);
    setIsOptional(false);
    setSortOrder("0");
    setOverridesText("");
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pkg?.id]);

  async function loadDetail() {
    if (!pkg?.id) return;
    setLoading(true);
    try {
      const d = await apiFetch<ServicePackageRow>(
        `/api/infrastructure/service-packages/${encodeURIComponent(pkg.id)}?${buildQS({ includeItems: "true" })}`,
      );
      setDetail(d || null);
    } catch (e: any) {
      toast({ title: "Failed to load package", description: e?.message || "Request failed", variant: "destructive" as any });
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }

  async function searchCM(query: string) {
    if (!branchId) return;
    setCmLoading(true);
    try {
      const rows =
        (await apiFetch<ChargeMasterItemRow[]>(
          `/api/infrastructure/charge-master?${buildQS({
            branchId,
            q: query.trim() || undefined,
            take: 60,
            includeInactive: "false",
          })}`,
        )) || [];
      setCmRows(rows);
    } catch (e: any) {
      toast({ title: "Charge master search failed", description: e?.message || "Request failed", variant: "destructive" as any });
      setCmRows([]);
    } finally {
      setCmLoading(false);
    }
  }

  async function searchServices(query: string) {
    if (!branchId) return;
    setSvcLoading(true);
    try {
      const list =
        (await apiFetch<ServiceItemRow[]>(
          `/api/infrastructure/services?${buildQS({
            branchId,
            q: query.trim() || undefined,
            includeInactive: "false",
          })}`,
        )) || [];

      const filtered = list.filter((r) => {
        const billableOk = r.isBillable === undefined ? true : Boolean(r.isBillable);
        const publishedOk = r.lifecycleStatus ? String(r.lifecycleStatus).toUpperCase() === "PUBLISHED" : true;
        return billableOk && publishedOk;
      });

      setSvcRows(filtered.slice(0, 60));
    } catch (e: any) {
      toast({ title: "Service search failed", description: e?.message || "Request failed", variant: "destructive" as any });
      setSvcRows([]);
    } finally {
      setSvcLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void searchCM(cmQ), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmQ, open]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void searchServices(svcQ), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svcQ, open]);

  function parseOverrides(): any {
    const t = (overridesText || "").trim();
    if (!t) return undefined;
    try {
      return JSON.parse(t);
    } catch {
      throw new Error("Overrides must be valid JSON.");
    }
  }

  async function upsertItem() {
    if (!pkg?.id) return;
    if (!pickedCm?.id) {
      toast({ title: "Pick Charge Master item", description: "Package items must reference ChargeMasterItem." });
      return;
    }

    let overrides: any = undefined;
    try {
      overrides = parseOverrides();
    } catch (e: any) {
      toast({ title: "Invalid overrides JSON", description: e?.message || "Fix the JSON and try again." });
      return;
    }

    const payload: any = {
      chargeMasterItemId: pickedCm.id,
      serviceItemId: pickedSvc?.id || null, // optional, if your backend supports
      qty: Math.max(1, Number(qty) || 1),
      isIncluded: Boolean(isIncluded),
      isOptional: Boolean(isOptional),
      sortOrder: Number(sortOrder) || 0,
      overrides,
    };

    setLoading(true);
    try {
      await apiFetch(`/api/infrastructure/service-packages/${encodeURIComponent(pkg.id)}/items`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast({ title: "Item saved", description: "Package item added/updated." });

      // reset
      setPickedCm(null);
      setPickedSvc(null);
      setQty("1");
      setIsIncluded(true);
      setIsOptional(false);
      setSortOrder("0");
      setOverridesText("");

      await loadDetail();
      onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!pkg?.id) return;
    const ok = window.confirm("Remove this item from the package?");
    if (!ok) return;

    setLoading(true);
    try {
      await apiFetch(`/api/infrastructure/service-packages/${encodeURIComponent(pkg.id)}/items/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      toast({ title: "Removed", description: "Item removed from package." });
      await loadDetail();
      onSaved();
    } catch (e: any) {
      toast({ title: "Remove failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  const items = detail?.items || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={drawerClassName()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
              <Wrench className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            Manage Items • {pkg?.code || ""}
          </DialogTitle>
          <DialogDescription>Add ChargeMaster items to this package. Optional ServiceItem linkage helps ordering screens (if enabled).</DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="px-6 pb-6 grid gap-6">
          {/* Add/Update */}
          <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4 grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zc-text">Add / Update Item</div>
                <div className="text-xs text-zc-muted">Package items must reference ChargeMasterItem (billing primary).</div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link href="/superadmin/infrastructure/charge-master">
                  Charge Master <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Charge master picker */}
            <div className="grid gap-2">
              <Label>Find Charge Master Item</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
                <Input value={cmQ} onChange={(e) => setCmQ(e.target.value)} placeholder="Search by code/name…" className="pl-10" />
              </div>

              <div className="rounded-xl border border-zc-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[150px]">Charge Unit</TableHead>
                      <TableHead className="w-[120px]">Pick</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cmLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={4}>
                            <Skeleton className="h-6 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : cmRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <div className="flex items-center justify-center gap-2 py-8 text-sm text-zc-muted">
                            <AlertTriangle className="h-4 w-4 text-zc-warn" />
                            No charge items found.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      cmRows.map((cm) => {
                        const picked = pickedCm?.id === cm.id;
                        return (
                          <TableRow key={cm.id} className={picked ? "bg-zc-panel/30" : ""}>
                            <TableCell className="font-mono text-xs">
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-zc-text">{cm.code}</span>
                                <span className="text-[11px] text-zc-muted">{String(cm.id).slice(0, 8)}…</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-zc-text">{cm.name}</span>
                                <span className="text-xs text-zc-muted">{cm.isActive === false ? "Inactive" : "Active"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{cm.chargeUnit || "—"}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant={picked ? "primary" : "outline"} size="sm" onClick={() => setPickedCm(cm)}>
                                {picked ? "Picked" : "Pick"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Optional service linkage */}
            <div className="grid gap-2">
              <Label>Optional: Link Service Item (for ordering)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
                <Input value={svcQ} onChange={(e) => setSvcQ(e.target.value)} placeholder="Search billable published services…" className="pl-10" />
              </div>

              <div className="rounded-xl border border-zc-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[140px]">Charge Unit</TableHead>
                      <TableHead className="w-[120px]">Pick</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {svcLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={4}>
                            <Skeleton className="h-6 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : svcRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <div className="flex items-center justify-center gap-2 py-8 text-sm text-zc-muted">
                            <AlertTriangle className="h-4 w-4 text-zc-warn" />
                            No services found.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      svcRows.map((s) => {
                        const picked = pickedSvc?.id === s.id;
                        return (
                          <TableRow key={s.id} className={picked ? "bg-zc-panel/30" : ""}>
                            <TableCell className="font-mono text-xs">
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-zc-text">{s.code}</span>
                                <span className="text-[11px] text-zc-muted">{String(s.id).slice(0, 8)}…</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-zc-muted">{s.name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{s.chargeUnit || "—"}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant={picked ? "primary" : "outline"}
                                size="sm"
                                onClick={() => setPickedSvc(picked ? null : s)}
                              >
                                {picked ? "Picked" : "Pick"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="text-xs text-zc-muted">
                If you don’t want ordering linkage, leave it empty—billing still works because ChargeMaster is primary.
              </div>
            </div>

            {/* Item fields */}
            <div className="grid gap-3 md:grid-cols-4">
              <div className="grid gap-2">
                <Label>Qty</Label>
                <Input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="1" />
              </div>
              <div className="grid gap-2">
                <Label>Sort Order</Label>
                <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="0" />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                <Switch checked={isIncluded} onCheckedChange={setIsIncluded} />
                <div className="text-sm">
                  <div className="font-semibold text-zc-text">{isIncluded ? "Included" : "Not included"}</div>
                  <div className="text-xs text-zc-muted">Included in package</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                <Switch checked={isOptional} onCheckedChange={setIsOptional} />
                <div className="text-sm">
                  <div className="font-semibold text-zc-text">{isOptional ? "Optional" : "Mandatory"}</div>
                  <div className="text-xs text-zc-muted">Optional add-on</div>
                </div>
              </div>
              <div className="grid gap-2 md:col-span-4">
                <Label>Overrides (JSON, optional)</Label>
                <Textarea
                  value={overridesText}
                  onChange={(e) => setOverridesText(e.target.value)}
                  placeholder='e.g., {"maxQty": 1, "note": "Only once per visit"}'
                  className="min-h-[42px]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-zc-muted">
                Selected CM: <span className="font-mono font-semibold text-zc-text">{pickedCm ? pickedCm.code : "—"}</span>{" "}
                <span className="mx-2">•</span>
                Linked Service: <span className="font-mono font-semibold text-zc-text">{pickedSvc ? pickedSvc.code : "—"}</span>
              </div>
              <Button onClick={upsertItem} disabled={loading || !pickedCm}>
                {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Save Item
              </Button>
            </div>
          </div>

          {/* Items list */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zc-text">Package Items</div>
                <div className="text-xs text-zc-muted">
                  Total: <span className="font-semibold text-zc-text">{items.length}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={loadDetail} disabled={loading}>
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Reload
              </Button>
            </div>

            <div className="rounded-xl border border-zc-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Charge Master</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[90px]">Qty</TableHead>
                    <TableHead className="w-[110px]">Included</TableHead>
                    <TableHead className="w-[110px]">Optional</TableHead>
                    <TableHead className="w-[90px]">Sort</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-zc-muted">
                          <AlertTriangle className="h-4 w-4 text-zc-warn" />
                          No items yet.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono text-xs">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-zc-text">{it.chargeMasterItem?.code || it.chargeMasterItemId}</span>
                            {it.serviceItem?.code ? (
                              <span className="text-[11px] text-zc-muted">svc: {it.serviceItem.code}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-zc-muted">{it.chargeMasterItem?.name || "—"}</TableCell>
                        <TableCell className="text-sm text-zc-muted">{it.qty ?? 1}</TableCell>
                        <TableCell>{it.isIncluded ? <Badge variant="ok">YES</Badge> : <Badge variant="secondary">NO</Badge>}</TableCell>
                        <TableCell>{it.isOptional ? <Badge variant="warning">YES</Badge> : <Badge variant="secondary">NO</Badge>}</TableCell>
                        <TableCell className="text-sm text-zc-muted">{it.sortOrder ?? 0}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => removeItem(it.id)}>
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="text-xs text-zc-muted">
              Note: Charge unit & tax enforcement is validated by billing + FixIt/GoLive rules. Keep package items clean and consistent.
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}


