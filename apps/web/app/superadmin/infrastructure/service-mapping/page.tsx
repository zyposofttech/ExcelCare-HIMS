"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { AppLink as Link } from "@/components/app-link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

import {
  AlertTriangle,
  ExternalLink,
  Filter,
  Link2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type BranchRow = { id: string; code: string; name: string; city?: string };

type ChargeMasterItemRow = {
  id: string;
  code: string;
  name: string;
  chargeUnit?: string | null;
  isActive?: boolean;
};

type ServiceChargeMappingRow = {
  id: string;
  branchId?: string;
  serviceItemId: string;
  chargeMasterItemId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt?: string;
  chargeMasterItem?: ChargeMasterItemRow | null;
};

type ServiceItemRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  category?: string | null;

  // common fields you likely have
  isActive?: boolean;
  isOrderable?: boolean;
  isBillable?: boolean;
  lifecycleStatus?: string | null; // DRAFT / SUBMITTED / APPROVED / PUBLISHED etc.
  chargeUnit?: string | null;
  requiresAppointment?: boolean;

  // optional mapping expansion
  mappings?: ServiceChargeMappingRow[];

  updatedAt?: string;
  createdAt?: string;
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
      <div className="px-6 pt-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
            {icon ?? <Wrench className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold text-indigo-700 dark:text-indigo-400">{title}</div>
            {description ? <div className="mt-1 text-sm text-zc-muted">{description}</div> : null}
          </div>
        </div>
      </div>
      <Separator className="my-4" />
    </>
  );
}

type MappingFilter = "all" | "missing" | "mapped" | "mismatch";

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function SuperAdminServiceMappingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const sp = useSearchParams();

  const [activeTab, setActiveTab] = React.useState<"mapping" | "guide">("mapping");
  const [showFilters, setShowFilters] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState<string>("");

  const [allServices, setAllServices] = React.useState<ServiceItemRow[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");

  // filters
  const [q, setQ] = React.useState("");
  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [mappingFilter, setMappingFilter] = React.useState<MappingFilter>("all");

  // pagination
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);

  // details
  const [selected, setSelected] = React.useState<ServiceItemRow | null>(null);

  // modals
  const [mapOpen, setMapOpen] = React.useState(false);

  const mustSelectBranch = !branchId;

  function setUrlServiceId(id: string) {
    const params = new URLSearchParams(sp?.toString() || "");
    if (id) params.set("serviceItemId", id);
    else params.delete("serviceItemId");
    router.replace(`/superadmin/infrastructure/service-mapping?${params.toString()}`);
  }

  function currentMapping(svc: ServiceItemRow): ServiceChargeMappingRow | null {
    const ms = svc.mappings || [];
    const open = ms.find((m) => m && (m.effectiveTo === null || m.effectiveTo === undefined));
    return open || ms[0] || null;
  }

  function isMapped(svc: ServiceItemRow): boolean {
    const m = currentMapping(svc);
    return Boolean(m?.chargeMasterItemId && (m.effectiveTo === null || m.effectiveTo === undefined));
  }

  function isMismatch(svc: ServiceItemRow): boolean {
    const m = currentMapping(svc);
    const cm = m?.chargeMasterItem;
    if (!m || !cm) return false;
    if (m.effectiveTo) return false;
    if (!svc.chargeUnit || !cm.chargeUnit) return false;
    return String(svc.chargeUnit) !== String(cm.chargeUnit);
  }

  function mappingBadge(svc: ServiceItemRow) {
    const m = currentMapping(svc);
    if (!m || !m.chargeMasterItemId) return <Badge variant="destructive">MAPPING MISSING</Badge>;
    if (m.effectiveTo) return <Badge variant="secondary">MAPPING CLOSED</Badge>;
    if (isMismatch(svc)) return <Badge variant="warning">MAPPED • UNIT MISMATCH</Badge>;
    return <Badge variant="ok">MAPPED</Badge>;
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

  async function loadServices(forBranchId?: string, showToast = false) {
    const bid = forBranchId || branchId;
    if (!bid) return;

    setErr(null);
    setLoading(true);
    try {
      const rows =
        (await apiFetch<ServiceItemRow[]>(
          `/api/infrastructure/services?${buildQS({
            branchId: bid,
            q: q.trim() || undefined,
            includeInactive: includeInactive ? "true" : undefined,
            includeMappings: "true", // backend may ignore safely
          })}`,
        )) || [];

      const filtered = rows.filter((r) => {
        const billableOk = r.isBillable === undefined ? true : Boolean(r.isBillable);
        const publishedOk =
          r.lifecycleStatus === undefined ? true : String(r.lifecycleStatus || "").toUpperCase() === "PUBLISHED";
        return billableOk && publishedOk;
      });

      setAllServices(filtered);

      if (showToast) toast({ title: "Services refreshed", description: "Loaded latest billable published services." });
    } catch (e: any) {
      const msg = e?.message || "Failed to load services";
      setErr(msg);
      setAllServices([]);
      if (showToast) toast({ title: "Refresh failed", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  async function loadServiceDetail(id: string, forBranchId?: string) {
    const bid = forBranchId || branchId;
    if (!bid || !id) return;

    setBusy(true);
    try {
      const detail = await apiFetch<ServiceItemRow>(
        `/api/infrastructure/services/${encodeURIComponent(id)}?${buildQS({ branchId: bid, includeMappings: "true" })}`,
      );
      setSelected(detail || null);
    } catch {
      const row = allServices.find((x) => x.id === id) || null;
      setSelected(row);
    } finally {
      setBusy(false);
    }
  }

  async function refreshAll(showToast = false) {
    setErr(null);
    setLoading(true);
    try {
      const bid = branchId || (await loadBranches());
      if (!bid) return;

      // ✅ ensure first-load fetch happens even before state finishes updating
      await loadServices(bid, false);

      const urlId = sp?.get("serviceItemId") || "";
      const nextId = urlId || selectedId || "";
      if (nextId) {
        setSelectedId(nextId);
        await loadServiceDetail(nextId, bid);
      }

      if (showToast) toast({ title: "Service mapping ready", description: "Branch scope and services are up to date." });
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
    const urlId = sp?.get("serviceItemId") || "";
    if (urlId && urlId !== selectedId) {
      setSelectedId(urlId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  React.useEffect(() => {
    if (!branchId) return;
    setPage(1);
    void loadServices(branchId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, includeInactive]);

  React.useEffect(() => {
    if (!branchId) return;
    setPage(1);
    const t = setTimeout(() => void loadServices(branchId, false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  React.useEffect(() => {
    if (!branchId) return;
    if (!selectedId) {
      setSelected(null);
      return;
    }
    void loadServiceDetail(selectedId, branchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, branchId]);
  async function onBranchChange(nextId: string) {
    setBranchId(nextId);
    writeLS(LS_BRANCH, nextId);

    setQ("");
    setIncludeInactive(false);
    setMappingFilter("all");
    setPage(1);
    setSelectedId("");
    setSelected(null);
    setUrlServiceId("");

    setErr(null);
    setLoading(true);
    try {
      // ✅ do not rely on state update timing
      await loadServices(nextId, false);
      toast({ title: "Branch scope changed", description: "Loaded billable published services for selected branch." });
    } catch (e: any) {
      const msg = e?.message || "Failed to load branch scope";
      setErr(msg);
      toast({ variant: "destructive", title: "Load failed", description: msg });
    } finally {
      setLoading(false);
    }
  }


  const filteredServices = React.useMemo(() => {
    let rows = [...(allServices || [])];

    if (mappingFilter === "missing") rows = rows.filter((r) => !isMapped(r));
    if (mappingFilter === "mapped") rows = rows.filter((r) => isMapped(r));
    if (mappingFilter === "mismatch") rows = rows.filter((r) => isMismatch(r));

    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allServices, mappingFilter]);

  const totals = React.useMemo(() => {
    const total = allServices.length;
    const missing = allServices.filter((s) => !isMapped(s)).length;
    const mismatch = allServices.filter((s) => isMismatch(s)).length;
    return { total, missing, mismatch };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allServices]);

  const totalPages = React.useMemo(() => Math.max(1, Math.ceil(filteredServices.length / pageSize)), [filteredServices.length, pageSize]);
  const pageRows = React.useMemo(() => filteredServices.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize), [filteredServices, page, pageSize]);

  function pickService(id: string) {
    setSelectedId(id);
    setUrlServiceId(id);
  }

  return (
    <AppShell title="Infrastructure • Service Mapping">
      <div className="grid gap-6">
        {/* Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
              <ShieldCheck className="h-5 w-5 text-zc-accent" />
            </span>
            <div className="min-w-0">
              <div className="text-3xl font-semibold tracking-tight">Service ↔ Charge Mapping</div>
              <div className="mt-1 text-sm text-zc-muted">
                Map each <span className="font-semibold">billable published</span> service to a Charge Master item for tariff pricing.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="px-5 gap-2" onClick={() => refreshAll(true)} disabled={loading || busy}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>

            <Button variant="outline" asChild className="px-5 gap-2">
              <Link href="/superadmin/infrastructure/fixit">
                <Wrench className="h-4 w-4" />
                FixIt Inbox
              </Link>
            </Button>

            <Button variant="primary" className="px-5 gap-2" onClick={() => setMapOpen(true)} disabled={!selectedId || busy || mustSelectBranch}>
              <Plus className="h-4 w-4" />
              Map Selected
            </Button>
          </div>
        </div>

        {err ? (
          <Card className="border-zc-danger/40">
            <CardHeader className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-zc-danger" />
                <div>
                  <CardTitle className="text-base">Could not load mapping screen</CardTitle>
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
              Select branch → pick a service → map it to Charge Master. Missing mappings and unit mismatches show as blockers.
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
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Billable Published Services</div>
                <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{totals.total}</div>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-900/10">
                <div className="text-xs font-medium text-rose-600 dark:text-rose-400">Missing Mapping</div>
                <div className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">{totals.missing}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
                <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Charge Unit Mismatch</div>
                <div className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">{totals.mismatch}</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search services by code/name/category…"
                  className="pl-10"
                  disabled={mustSelectBranch}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                  <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} disabled={mustSelectBranch} />
                  <div className="text-sm">
                    <div className="font-semibold text-zc-text">Include inactive</div>
                    <div className="text-xs text-zc-muted">Usually keep off for mapping</div>
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

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Branch scoped</Badge>
              <Badge variant={totals.missing > 0 ? "destructive" : "ok"}>Missing mapping: {totals.missing}</Badge>
              <Badge variant={totals.mismatch > 0 ? "warning" : "secondary"}>Unit mismatch: {totals.mismatch}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Main tabs */}
        <Card>
          <CardHeader className="py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Mapping Workspace</CardTitle>
                <CardDescription>Select a service from the left. Review mapping history and apply new mapping on the right.</CardDescription>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className={cn("h-10 rounded-2xl border border-zc-border bg-zc-panel/20 p-1")}>
                  <TabsTrigger
                    value="mapping"
                    className={cn("rounded-xl px-3 data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm")}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Mapping
                  </TabsTrigger>
                  <TabsTrigger
                    value="guide"
                    className={cn("rounded-xl px-3 data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm")}
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
              <TabsContent value="mapping" className="mt-0">
                <div className="grid gap-4">
                  {showFilters ? (
                    <div className="grid gap-3 rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                        <Filter className="h-4 w-4 text-zc-accent" />
                        Filters
                      </div>

                      <div className="grid gap-3 md:grid-cols-12">
                        <div className="md:col-span-4">
                          <Label className="text-xs text-zc-muted">Mapping status</Label>
                          <Select
                            value={mappingFilter}
                            onValueChange={(v) => {
                              setPage(1);
                              setMappingFilter(v as any);
                            }}
                            disabled={mustSelectBranch}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="missing">Missing mapping</SelectItem>
                              <SelectItem value="mapped">Mapped</SelectItem>
                              <SelectItem value="mismatch">Unit mismatch</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-12">
                    {/* Left list */}
                    <div className="lg:col-span-5">
                      <div className="rounded-xl border border-zc-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[170px]">Code</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead className="w-[160px]">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loading ? (
                              Array.from({ length: 10 }).map((_, i) => (
                                <TableRow key={i}>
                                  <TableCell colSpan={3}>
                                    <Skeleton className="h-6 w-full" />
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : pageRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3}>
                                  <div className="flex items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                                    <Link2 className="h-4 w-4" />
                                    No services found for current filters.
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (
                              pageRows.map((s) => (
                                <TableRow
                                  key={s.id}
                                  className={cn("cursor-pointer", selectedId === s.id ? "bg-zc-panel/30" : "")}
                                  onClick={() => pickService(s.id)}
                                >
                                  <TableCell className="font-mono text-xs">
                                    <div className="flex flex-col gap-1">
                                      <span className="font-semibold text-zc-text">{s.code}</span>
                                      <span className="text-[11px] text-zc-muted">{String(s.id).slice(0, 8)}…</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <span className="font-semibold text-zc-text">{s.name}</span>
                                      <span className="text-xs text-zc-muted">
                                        {s.chargeUnit ? `Charge unit: ${s.chargeUnit}` : "Charge unit not set"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>{mappingBadge(s)}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>

                        <div className="flex flex-col gap-3 border-t border-zc-border p-4 md:flex-row md:items-center md:justify-between">
                          <div className="text-sm text-zc-muted">
                            Showing <span className="font-semibold text-zc-text">{pageRows.length}</span> of{" "}
                            <span className="font-semibold text-zc-text">{filteredServices.length}</span>
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

                            <Button variant="outline" className="h-9" disabled={mustSelectBranch || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                              Prev
                            </Button>
                            <Button variant="outline" className="h-9" disabled={mustSelectBranch || page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                              Next
                            </Button>

                            <Badge variant="secondary">
                              Page {page} / {totalPages}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right detail */}
                    <div className="lg:col-span-7">
                      {!selectedId ? (
                        <Card className="border-zc-border">
                          <CardHeader className="py-4">
                            <CardTitle className="text-base">Select a service</CardTitle>
                            <CardDescription>Pick a service from the left list to view mapping details and apply mapping.</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4 text-sm text-zc-muted">
                              Tip: start with <span className="font-semibold">Missing mapping</span> filter to clear blockers faster.
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <ServiceMappingDetail
                          branchId={branchId}
                          svc={selected}
                          busy={busy}
                          onMap={() => setMapOpen(true)}
                          onAfterChange={async () => {
                            await loadServices(branchId, false);
                            if (selectedId) await loadServiceDetail(selectedId, branchId);

                            await loadServiceDetail(selectedId);
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="guide" className="mt-0">
                <Card className="border-zc-border">
                  <CardHeader className="py-4">
                    <CardTitle className="text-base">How this fits billing readiness</CardTitle>
                    <CardDescription>Mapping is the bridge between clinical ordering and billing tariffs.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                          <Badge variant="ok">1</Badge> Services must be billable + published
                        </div>
                        <div className="mt-1 text-sm text-zc-muted">
                          This screen only lists billable published services (so tariff coverage can be validated).
                        </div>
                        <div className="mt-3">
                          <Button variant="outline" asChild className="gap-2">
                            <Link href="/superadmin/infrastructure/service-library">
                              Open Service Library <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                          <Badge variant="ok">2</Badge> Map service to Charge Master
                        </div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Tariff rates are keyed by ChargeMasterItem only. Without mapping, billing cannot price orders.
                        </div>
                      </div>

                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                          <Badge variant="ok">3</Badge> Align charge units
                        </div>
                        <div className="mt-1 text-sm text-zc-muted">
                          If Service chargeUnit differs from ChargeMasterItem chargeUnit, backend opens a FixIt blocker.
                        </div>
                        <div className="mt-3">
                          <Button variant="outline" asChild className="gap-2">
                            <Link href="/superadmin/infrastructure/charge-master">
                              Open Charge Master <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                          <Badge variant="ok">4</Badge> Add tariff rates
                        </div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Once mapped, add rates in Tariff Plans. Missing rates open FixIts and will block GoLive.
                        </div>
                        <div className="mt-3">
                          <Button variant="outline" asChild className="gap-2">
                            <Link href="/superadmin/infrastructure/tariff-plans">
                              Open Tariff Plans <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                        <AlertTriangle className="h-4 w-4 text-zc-warn" />
                        Best workflow
                      </div>
                      <div className="mt-1 text-sm text-zc-muted">
                        Filter <span className="font-semibold">Missing mapping</span> → map everything → then go to tariff plans and fill missing rates.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Map modal */}
      <MapServiceModal
        open={mapOpen}
        onOpenChange={setMapOpen}
        branchId={branchId}
        service={selected}
        onSaved={async () => {
          toast({ title: "Mapping saved", description: "Service is now mapped to Charge Master." });
          await loadServices(branchId, false);
          if (selectedId) await loadServiceDetail(selectedId, branchId);

        }}
      />
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Detail Component                                */
/* -------------------------------------------------------------------------- */

function ServiceMappingDetail({
  branchId,
  svc,
  busy,
  onMap,
  onAfterChange,
}: {
  branchId: string;
  svc: ServiceItemRow | null;
  busy: boolean;
  onMap: () => void;
  onAfterChange: () => void;
}) {
  const { toast } = useToast();

  const current = React.useMemo(() => {
    const ms = svc?.mappings || [];
    const open = ms.find((m) => m && (m.effectiveTo === null || m.effectiveTo === undefined));
    return open || ms[0] || null;
  }, [svc]);

  const mismatch = React.useMemo(() => {
    if (!svc || !current || current.effectiveTo) return false;
    const cm = current.chargeMasterItem;
    if (!cm?.chargeUnit || !svc.chargeUnit) return false;
    return String(cm.chargeUnit) !== String(svc.chargeUnit);
  }, [svc, current]);

  async function closeCurrent() {
    if (!svc || !current || current.effectiveTo) return;
    const ok = window.confirm(`Close current mapping for ${svc.code}? This will set effectiveTo now.`);
    if (!ok) return;

    try {
      await apiFetch(`/api/infrastructure/service-charge-mappings/close?${buildQS({ branchId })}`, {
        method: "POST",
        body: JSON.stringify({
          serviceItemId: svc.id,
          mappingId: current.id, // if backend supports
          effectiveTo: new Date().toISOString(),
        }),
      });
      toast({ title: "Mapping closed", description: "Current mapping closed with effectiveTo." });
      onAfterChange();
    } catch (e: any) {
      toast({ title: "Close failed", description: e?.message || "Request failed", variant: "destructive" as any });
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="border-zc-border">
        <CardHeader className="py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-base">
                {svc?.code} • {svc?.name}
              </CardTitle>
              <CardDescription>
                Charge unit: <span className="font-semibold">{svc?.chargeUnit || "—"}</span>{" "}
                {svc?.category ? (
                  <>
                    • Category: <span className="font-semibold">{svc.category}</span>
                  </>
                ) : null}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={current?.chargeMasterItemId && !current?.effectiveTo ? "ok" : "destructive"}>
                {current?.chargeMasterItemId && !current?.effectiveTo ? "MAPPED" : "MAPPING MISSING"}
              </Badge>
              {mismatch ? <Badge variant="warning">CHARGE UNIT MISMATCH</Badge> : null}
              <Button variant="primary" className="gap-2" onClick={onMap} disabled={!svc || busy}>
                <Plus className="h-4 w-4" />
                Map / Change
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          {current?.chargeMasterItemId && !current?.effectiveTo ? (
            <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-zc-text">Current Mapping</div>
                  <div className="mt-1 text-sm text-zc-muted">
                    Charge Master:{" "}
                    <span className="font-mono font-semibold text-zc-text">
                      {current.chargeMasterItem?.code || current.chargeMasterItemId}
                    </span>{" "}
                    {current.chargeMasterItem?.name ? <span>• {current.chargeMasterItem.name}</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-zc-muted">
                    Effective from: <span className="font-semibold">{fmtDateTime(current.effectiveFrom)}</span>
                  </div>
                  {mismatch ? (
                    <div className="mt-2 text-sm text-zc-warn">
                      Service chargeUnit <span className="font-semibold">{svc?.chargeUnit}</span> differs from ChargeMaster{" "}
                      <span className="font-semibold">{current.chargeMasterItem?.chargeUnit}</span>. Fix either side.
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" asChild className="gap-2">
                    <Link href="/superadmin/infrastructure/charge-master">
                      Open Charge Master <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={closeCurrent} disabled={busy}>
                    <XCircle className="h-4 w-4" />
                    Close Mapping
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/50 dark:bg-rose-900/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-600 dark:text-rose-400" />
                <div>
                  <div className="text-sm font-semibold text-zc-text">Mapping missing</div>
                  <div className="mt-1 text-sm text-zc-muted">
                    This service cannot be priced until it’s mapped to a Charge Master item. Click <span className="font-semibold">Map / Change</span>.
                  </div>
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-zc-text">Mapping History</div>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link href={`/superadmin/infrastructure/service-library?serviceItemId=${encodeURIComponent(svc?.id || "")}`}>
                  Open in Service Library <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-3 rounded-xl border border-zc-border">
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
                  {busy ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={4}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (svc?.mappings || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-zc-muted">
                          <AlertTriangle className="h-4 w-4 text-zc-warn" /> No mapping history found.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (svc?.mappings || []).slice(0, 10).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-zc-text">{m.chargeMasterItem?.code || "—"}</span>
                            <span className="text-[11px] text-zc-muted">{m.chargeMasterItem?.name || ""}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-zc-muted">{fmtDateTime(m.effectiveFrom)}</TableCell>
                        <TableCell className="text-sm text-zc-muted">{fmtDateTime(m.effectiveTo || null)}</TableCell>
                        <TableCell>{m.effectiveTo ? <Badge variant="secondary">CLOSED</Badge> : <Badge variant="ok">ACTIVE</Badge>}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Map Modal                                  */
/* -------------------------------------------------------------------------- */

function MapServiceModal({
  open,
  onOpenChange,
  branchId,
  service,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  service: ServiceItemRow | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [cmQ, setCmQ] = React.useState("");
  const [cmLoading, setCmLoading] = React.useState(false);
  const [cmRows, setCmRows] = React.useState<ChargeMasterItemRow[]>([]);
  const [pickedCm, setPickedCm] = React.useState<ChargeMasterItemRow | null>(null);

  const [effectiveFrom, setEffectiveFrom] = React.useState<string>(() => {
    const d = new Date();
    // datetime-local expects "YYYY-MM-DDTHH:mm"
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setPickedCm(null);
    setNotes("");
    setCmQ("");
    setCmRows([]);
  }, [open]);

  async function searchCM(query: string) {
    if (!branchId) return;
    setCmLoading(true);
    try {
      const rows =
        (await apiFetch<ChargeMasterItemRow[]>(
          `/api/infrastructure/charge-master?${buildQS({
            branchId,
            q: query.trim() || undefined,
            take: 50,
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

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void searchCM(cmQ), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmQ, open]);

  function mismatch(serviceUnit?: string | null, cmUnit?: string | null) {
    if (!serviceUnit || !cmUnit) return false;
    return String(serviceUnit) !== String(cmUnit);
  }

  async function save() {
    if (!branchId || !service?.id) return;

    if (!pickedCm?.id) {
      toast({ title: "Select Charge Master item", description: "Pick a Charge Master item to map this service." });
      return;
    }

    const isMismatch = mismatch(service.chargeUnit || null, pickedCm.chargeUnit || null);

    const ok = isMismatch
      ? window.confirm(
        `Charge unit mismatch detected:\nService = ${service.chargeUnit || "—"}\nChargeMaster = ${pickedCm.chargeUnit || "—"
        }\n\nProceed? (This will open a FixIt blocker until corrected.)`,
      )
      : true;

    if (!ok) return;

    setSaving(true);
    try {
      const iso = new Date(effectiveFrom).toISOString();

      await apiFetch(`/api/infrastructure/service-charge-mappings?${buildQS({ branchId })}`, {
        method: "POST",
        body: JSON.stringify({
          serviceItemId: service.id,
          chargeMasterItemId: pickedCm.id,
          effectiveFrom: iso,
          notes: notes?.trim() ? notes.trim() : undefined,
        }),
      });

      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast({ title: "Mapping save failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={drawerClassName()}>
        <ModalHeader
          title="Map Service to Charge Master"
          description="Select a Charge Master item and set effectiveFrom. Backend will close overlaps and handle FixIts."
          icon={<Link2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
        />

        <div className="px-6 pb-6">
          <div className="grid gap-4">
            <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4">
              <div className="text-sm font-semibold text-zc-text">Selected Service</div>
              <div className="mt-1 text-sm text-zc-muted">
                <span className="font-mono font-semibold text-zc-text">{service?.code || "—"}</span> • {service?.name || "—"}
              </div>
              <div className="mt-1 text-xs text-zc-muted">
                Charge unit: <span className="font-semibold">{service?.chargeUnit || "—"}</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Find Charge Master</Label>
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
                      <TableHead className="w-[160px]">Charge Unit</TableHead>
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
                            <AlertTriangle className="h-4 w-4 text-zc-warn" /> No charge items found.
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      cmRows.map((cm) => {
                        const picked = pickedCm?.id === cm.id;
                        const isMismatch = mismatch(service?.chargeUnit || null, cm.chargeUnit || null);
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
                                {isMismatch ? <Badge variant="warning" className="w-fit">Unit mismatch</Badge> : null}
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

              <div className="text-xs text-zc-muted">
                Need to create a new charge item?{" "}
                <Link href="/superadmin/infrastructure/charge-master" className="text-zc-accent hover:underline inline-flex items-center gap-1">
                  Open Charge Master <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Effective From</Label>
                <Input type="datetime-local" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
                <div className="text-xs text-zc-muted">Backend will close overlaps and keep only one active mapping.</div>
              </div>

              <div className="grid gap-2">
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal reason for mapping change…" className="min-h-[42px]" />
              </div>
            </div>

            {pickedCm ? (
              <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zc-text">Selected Charge Master</div>
                    <div className="mt-1 text-sm text-zc-muted">
                      <span className="font-mono font-semibold text-zc-text">{pickedCm.code}</span> • {pickedCm.name}
                    </div>
                    <div className="mt-1 text-xs text-zc-muted">
                      Charge unit: <span className="font-semibold">{pickedCm.chargeUnit || "—"}</span>
                    </div>
                  </div>

                  {mismatch(service?.chargeUnit || null, pickedCm.chargeUnit || null) ? (
                    <Badge variant="warning" className="mt-1">
                      Unit mismatch (FixIt)
                    </Badge>
                  ) : (
                    <Badge variant="ok" className="mt-1">
                      Unit aligned
                    </Badge>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !pickedCm || !service}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
