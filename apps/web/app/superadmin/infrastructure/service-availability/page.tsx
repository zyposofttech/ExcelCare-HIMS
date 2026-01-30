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
  CalendarClock,
  ExternalLink,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Wrench,
  Trash2,
  CheckCircle2,
  Eye,
  Clock,
  Ban,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type BranchRow = { id: string; code: string; name: string; city: string };

type ServiceItemRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  kind?: string | null; // LAB/RADIOLOGY/PROCEDURE/CONSULTATION etc
  isActive: boolean;
  _count?: { availabilityRules?: number; availabilityExceptions?: number };
};

type AvailabilityRuleRow = {
  id: string;
  branchId: string;
  serviceItemId: string;

  // common scheduling knobs (may or may not exist in your backend DTO)
  isActive: boolean;
  mode?: "WALKIN" | "APPOINTMENT" | string | null;
  timezone?: string | null;

  slotMinutes?: number | null;
  leadTimeMinutes?: number | null;
  bookingWindowDays?: number | null;
  maxPerDay?: number | null;
  maxPerSlot?: number | null;

  // weekly windows / JSON rule blob
  windows?: any[] | null;
  rulesJson?: any | null;

  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  version?: number | null;

  notes?: string | null;

  createdAt?: string;
  updatedAt?: string;
};

type AvailabilityExceptionRow = {
  id: string;
  branchId: string;
  serviceItemId: string;

  date: string; // ISO date
  startTime?: string | null; // "HH:mm"
  endTime?: string | null; // "HH:mm"
  reason?: string | null;

  isClosed?: boolean | null; // closed day / blackout
  capacityOverride?: number | null;

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

async function apiTryMany<T>(urls: { url: string; init?: RequestInit }[]) {
  let lastErr: any = null;
  for (const u of urls) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await apiFetch<T>(u.url, u.init as any);
    } catch (e: any) {
      lastErr = e;
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

function first<T>(arr: T[] | undefined | null) {
  return arr && arr.length ? arr[0] : null;
}

/* -------------------------------------------------------------------------- */
/*                                   Page                                     */
/* -------------------------------------------------------------------------- */

export default function SuperAdminServiceAvailabilityPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<"workspace" | "guide">("workspace");
  const [showHelp, setShowHelp] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState<string>("");

  const [serviceItems, setServiceItems] = React.useState<ServiceItemRow[]>([]);
  const [selectedItemId, setSelectedItemId] = React.useState<string>("");
  const [selectedItem, setSelectedItem] = React.useState<ServiceItemRow | null>(null);

  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [q, setQ] = React.useState("");

  // availability data (selected item)
  const [rulesLoading, setRulesLoading] = React.useState(false);
  const [rulesErr, setRulesErr] = React.useState<string | null>(null);
  const [rules, setRules] = React.useState<AvailabilityRuleRow[]>([]);
  const [exceptions, setExceptions] = React.useState<AvailabilityExceptionRow[]>([]);

  // modals
  const [ruleOpen, setRuleOpen] = React.useState(false);
  const [ruleMode, setRuleMode] = React.useState<"create" | "edit">("create");
  const [ruleEditing, setRuleEditing] = React.useState<AvailabilityRuleRow | null>(null);

  const [exOpen, setExOpen] = React.useState(false);
  const [exMode, setExMode] = React.useState<"create" | "edit">("create");
  const [exEditing, setExEditing] = React.useState<AvailabilityExceptionRow | null>(null);

  const mustSelectBranch = !branchId;

  async function loadBranches(): Promise<string | null> {
    const list = (await apiFetch<BranchRow[]>("/api/branches")) || [];
    setBranches(list);

    const stored = readLS(LS_BRANCH);
    const firstId = list[0]?.id || null;
    const next = (stored && list.some((b) => b.id === stored) ? stored : null) || firstId;

    if (next) writeLS(LS_BRANCH, next);
    setBranchId(next || "");
    return next;
  }

  async function loadServiceItems(bid: string, showToast = false) {
    setErr(null);
    setLoading(true);
    try {
      const qs = buildQS({
        branchId: bid,
        q: q.trim() || undefined,
        includeInactive: includeInactive ? "true" : undefined,
        includeCounts: "true",
      });

      const res = await apiTry<any>(
        `/api/infrastructure/service-items?${qs}`,
        `/api/infra/service-items?${qs}`,
      );

      const list: ServiceItemRow[] = Array.isArray(res) ? res : (res?.rows || []);
      setServiceItems(list);

      const nextSelected =
        selectedItemId && list.some((x) => x.id === selectedItemId) ? selectedItemId : list[0]?.id || "";
      setSelectedItemId(nextSelected);
      setSelectedItem(nextSelected ? list.find((x) => x.id === nextSelected) || null : null);

      if (showToast) toast({ title: "Service items refreshed", description: "Loaded latest items for this branch." });
    } catch (e: any) {
      const msg = e?.message || "Failed to load service items";
      setErr(msg);
      setServiceItems([]);
      setSelectedItemId("");
      setSelectedItem(null);
      if (showToast) toast({ title: "Refresh failed", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailabilityForItem(itemId: string, showToast = false) {
    if (!itemId) return;
    setRulesErr(null);
    setRulesLoading(true);

    try {
      const qs = buildQS({ serviceItemId: itemId, includeInactive: "true", includeAll: "true" });

      // rules
      const rulesRes = await apiTryMany<any>([
        { url: `/api/infrastructure/service-availability/rules?${qs}` },
        { url: `/api/infra/service-availability/rules?${qs}` },
        { url: `/api/infrastructure/service-availability?${qs}` }, // some backends return combined
        { url: `/api/infra/service-availability?${qs}` },
      ]);

      // exceptions (optional)
      let exRes: any = null;
      try {
        exRes = await apiTryMany<any>([
          { url: `/api/infrastructure/service-availability/exceptions?${qs}` },
          { url: `/api/infra/service-availability/exceptions?${qs}` },
        ]);
      } catch {
        exRes = null;
      }

      const ruleList: AvailabilityRuleRow[] =
        Array.isArray(rulesRes) ? rulesRes : (rulesRes?.rules || rulesRes?.rows || []);
      const exList: AvailabilityExceptionRow[] =
        Array.isArray(exRes) ? exRes : (exRes?.exceptions || exRes?.rows || []);

      setRules(ruleList);
      setExceptions(exList);

      if (showToast) toast({ title: "Availability refreshed", description: "Loaded latest rules & exceptions." });
    } catch (e: any) {
      const msg = e?.message || "Failed to load availability rules";
      setRulesErr(msg);
      setRules([]);
      setExceptions([]);
      if (showToast) toast({ title: "Load failed", description: msg, variant: "destructive" as any });
    } finally {
      setRulesLoading(false);
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
      await loadServiceItems(bid, false);

      const itemId = selectedItemId || first(serviceItems)?.id || "";
      if (itemId) await loadAvailabilityForItem(itemId, false);

      if (showToast) toast({ title: "Ready", description: "Service availability workspace is up to date." });
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

    setSelectedItemId("");
    setSelectedItem(null);
    setRules([]);
    setExceptions([]);

    void loadServiceItems(branchId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, includeInactive]);

  React.useEffect(() => {
    if (!branchId) return;
    const t = setTimeout(() => void loadServiceItems(branchId, false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  React.useEffect(() => {
    if (!selectedItemId) {
      setSelectedItem(null);
      setRules([]);
      setExceptions([]);
      return;
    }
    const it = serviceItems.find((x) => x.id === selectedItemId) || null;
    setSelectedItem(it);
    if (it) void loadAvailabilityForItem(it.id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId]);

  async function onBranchChange(nextId: string) {
    setBranchId(nextId);
    writeLS(LS_BRANCH, nextId);

    setQ("");
    setIncludeInactive(false);
    setSelectedItemId("");
    setSelectedItem(null);
    setRules([]);
    setExceptions([]);

    setErr(null);
    setLoading(true);
    try {
      await loadServiceItems(nextId, false);
      toast({ title: "Branch scope changed", description: "Loaded service items for selected branch." });
    } catch (e: any) {
      toast({ title: "Load failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  const stats = React.useMemo(() => {
    const total = serviceItems.length;
    const active = serviceItems.filter((s) => s.isActive).length;
    const inactive = total - active;

    const configured = serviceItems.filter((s) => (s._count?.availabilityRules ?? 0) > 0).length;
    const missing = total - configured;

    const ruleCount = rules.length;
    const activeRules = rules.filter((r) => r.isActive).length;

    return { total, active, inactive, configured, missing, ruleCount, activeRules };
  }, [serviceItems, rules]);

  function openCreateRule() {
    if (!selectedItem) return;
    setRuleMode("create");
    setRuleEditing(null);
    setRuleOpen(true);
  }

  function openEditRule(r: AvailabilityRuleRow) {
    setRuleMode("edit");
    setRuleEditing(r);
    setRuleOpen(true);
  }

  function openCreateException() {
    if (!selectedItem) return;
    setExMode("create");
    setExEditing(null);
    setExOpen(true);
  }

  function openEditException(x: AvailabilityExceptionRow) {
    setExMode("edit");
    setExEditing(x);
    setExOpen(true);
  }

  async function deleteRule(r: AvailabilityRuleRow) {
    const ok = window.confirm("Delete this rule? (Recommended: close effectiveTo instead of delete if you keep history.)");
    if (!ok) return;

    setBusy(true);
    try {
      await apiTryMany([
        { url: `/api/infrastructure/service-availability/rules/${encodeURIComponent(r.id)}`, init: { method: "DELETE" } },
        { url: `/api/infra/service-availability/rules/${encodeURIComponent(r.id)}`, init: { method: "DELETE" } },
        { url: `/api/infrastructure/service-availability/${encodeURIComponent(r.id)}`, init: { method: "DELETE" } },
        { url: `/api/infra/service-availability/${encodeURIComponent(r.id)}`, init: { method: "DELETE" } },
      ]);
      toast({ title: "Deleted", description: "Availability rule deleted." });
      if (selectedItem) await loadAvailabilityForItem(selectedItem.id, false);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function closeRule(r: AvailabilityRuleRow) {
    const ok = window.confirm("Close this rule by setting effectiveTo now?");
    if (!ok) return;

    setBusy(true);
    try {
      await apiTryMany([
        { url: `/api/infrastructure/service-availability/rules/${encodeURIComponent(r.id)}/close`, init: { method: "POST" } },
        { url: `/api/infra/service-availability/rules/${encodeURIComponent(r.id)}/close`, init: { method: "POST" } },
        { url: `/api/infrastructure/service-availability/rules/${encodeURIComponent(r.id)}`, init: { method: "PATCH", body: JSON.stringify({ close: true }) } },
        { url: `/api/infra/service-availability/rules/${encodeURIComponent(r.id)}`, init: { method: "PATCH", body: JSON.stringify({ close: true }) } },
      ]);
      toast({ title: "Closed", description: "Rule closed (effectiveTo set)." });
      if (selectedItem) await loadAvailabilityForItem(selectedItem.id, false);
    } catch (e: any) {
      toast({ title: "Close failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function deleteException(x: AvailabilityExceptionRow) {
    const ok = window.confirm("Delete this exception?");
    if (!ok) return;

    setBusy(true);
    try {
      await apiTryMany([
        { url: `/api/infrastructure/service-availability/exceptions/${encodeURIComponent(x.id)}`, init: { method: "DELETE" } },
        { url: `/api/infra/service-availability/exceptions/${encodeURIComponent(x.id)}`, init: { method: "DELETE" } },
      ]);
      toast({ title: "Deleted", description: "Exception deleted." });
      if (selectedItem) await loadAvailabilityForItem(selectedItem.id, false);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message || "Request failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Infrastructure • Service Availability">
      <div className="grid gap-6">
        {/* Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
              <CalendarClock className="h-5 w-5 text-zc-accent" />
            </span>
            <div className="min-w-0">
              <div className="text-3xl font-semibold tracking-tight">Service Availability</div>
              <div className="mt-1 text-sm text-zc-muted">
                Define booking rules per Service Item: weekly windows, slot settings, lead time, and blackout exceptions.
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

            <Button
              variant="primary"
              className="px-5 gap-2 whitespace-nowrap shrink-0"
              onClick={openCreateRule}
              disabled={!selectedItem}
            >
              <Plus className="h-4 w-4" />
              New Rule
            </Button>
          </div>
        </div>

        {err ? (
          <Card className="border-zc-danger/40">
            <CardHeader className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-zc-danger" />
                <div>
                  <CardTitle className="text-base">Could not load Service Availability</CardTitle>
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
              Best practice: configure availability for services that require scheduling (OPD consults, radiology slots,
              OT procedures). Lab can remain “walk-in” with optional cut-off times.
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

            <div className="grid gap-3 md:grid-cols-7">
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Items</div>
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
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-900/10">
                <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Configured</div>
                <div className="mt-1 text-lg font-bold text-indigo-800 dark:text-indigo-200">{stats.configured}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
                <div className="text-xs font-medium text-amber-700 dark:text-amber-300">Missing</div>
                <div className="mt-1 text-lg font-bold text-amber-800 dark:text-amber-200">{stats.missing}</div>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-900/10">
                <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Rules (selected)</div>
                <div className="mt-1 text-lg font-bold text-indigo-800 dark:text-indigo-200">{stats.ruleCount}</div>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900/50 dark:bg-indigo-900/10">
                <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Active rules</div>
                <div className="mt-1 text-lg font-bold text-indigo-800 dark:text-indigo-200">{stats.activeRules}</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search service items by code/name…"
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
                  onClick={() => setShowHelp((s) => !s)}
                  disabled={mustSelectBranch}
                >
                  <Filter className="h-4 w-4" />
                  {showHelp ? "Hide Help" : "Show Help"}
                </Button>
              </div>
            </div>

            {showHelp ? (
              <div className="grid gap-3 rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zc-text">
                  <Filter className="h-4 w-4 text-zc-accent" />
                  What to configure here
                </div>
                <div className="text-sm text-zc-muted">
                  You define “when a service can be booked” (weekly windows), “how it is booked” (slot minutes, lead
                  time), and “when it is not available” (blackout dates, maintenance). If you later enforce resources,
                  this page becomes the scheduling backbone.
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Branch scoped</Badge>
              <Badge variant="ok">Weekly windows</Badge>
              <Badge variant="warning">Missing rules → FixIt (recommended)</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Workspace */}
        <Card>
          <CardHeader className="py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base">Availability Workspace</CardTitle>
                <CardDescription>Pick a service item and configure booking rules and exceptions.</CardDescription>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className={cn("h-10 rounded-2xl border border-zc-border bg-zc-panel/20 p-1")}>
                  <TabsTrigger
                    value="workspace"
                    className={cn(
                      "rounded-xl px-3 data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm",
                    )}
                  >
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Rules + Exceptions
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
              <TabsContent value="workspace" className="mt-0">
                <div className="grid gap-4 lg:grid-cols-12">
                  {/* Left list */}
                  <div className="lg:col-span-5">
                    <div className="rounded-xl border border-zc-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[170px]">Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[140px]">Availability</TableHead>
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
                          ) : serviceItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <div className="flex items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                                  <CalendarClock className="h-4 w-4" />
                                  No service items found.
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            serviceItems.map((s) => {
                              const isSelected = selectedItemId === s.id;
                              const ruleCount = s._count?.availabilityRules ?? 0;
                              const exCount = s._count?.availabilityExceptions ?? 0;
                              const configured = ruleCount > 0;

                              return (
                                <TableRow
                                  key={s.id}
                                  className={cn("cursor-pointer", isSelected ? "bg-zc-panel/30" : "")}
                                  onClick={() => setSelectedItemId(s.id)}
                                >
                                  <TableCell className="font-mono text-xs">
                                    <div className="flex flex-col gap-1">
                                      <span className="font-semibold text-zc-text">{s.code}</span>
                                      <span className="text-[11px] text-zc-muted">{s.kind || "—"}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <span className="font-semibold text-zc-text">{s.name}</span>
                                      <span className="text-xs text-zc-muted">
                                        Rules: <span className="font-semibold text-zc-text">{ruleCount}</span>
                                        <span className="mx-2">•</span>
                                        Exceptions: <span className="font-semibold text-zc-text">{exCount}</span>
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      {activeBadge(s.isActive)}
                                      {configured ? <Badge variant="ok">CONFIGURED</Badge> : <Badge variant="warning">MISSING</Badge>}
                                    </div>
                                  </TableCell>
                                  <TableCell onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-[240px]">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setSelectedItemId(s.id);
                                            setTimeout(() => openCreateRule(), 0);
                                          }}
                                        >
                                          <Plus className="mr-2 h-4 w-4" />
                                          Add rule
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => {
                                            setSelectedItemId(s.id);
                                            setTimeout(() => openCreateException(), 0);
                                          }}
                                        >
                                          <Ban className="mr-2 h-4 w-4" />
                                          Add exception
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
                          Total: <span className="font-semibold text-zc-text">{serviceItems.length}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" className="gap-2" asChild>
                            <Link href="/superadmin/infrastructure/service-items">
                              Service Items <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" className="gap-2" asChild>
                            <Link href="/superadmin/infrastructure/service-mapping">
                              Mapping <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right detail */}
                  <div className="lg:col-span-7">
                    {!selectedItem ? (
                      <Card className="border-zc-border">
                        <CardHeader className="py-4">
                          <CardTitle className="text-base">Select a service item</CardTitle>
                          <CardDescription>Choose an item from the left list to configure availability.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4 text-sm text-zc-muted">
                            Tip: For OPD consults and radiology, start with Appointment mode, 10–15 minute slots, and add blackout dates for maintenance.
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <AvailabilityDetail
                        item={selectedItem}
                        busy={busy}
                        rulesLoading={rulesLoading}
                        rulesErr={rulesErr}
                        rules={rules}
                        exceptions={exceptions}
                        onRefresh={() => loadAvailabilityForItem(selectedItem.id, true)}
                        onAddRule={openCreateRule}
                        onEditRule={openEditRule}
                        onCloseRule={closeRule}
                        onDeleteRule={deleteRule}
                        onAddException={openCreateException}
                        onEditException={openEditException}
                        onDeleteException={deleteException}
                      />
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="guide" className="mt-0">
                <Card className="border-zc-border">
                  <CardHeader className="py-4">
                    <CardTitle className="text-base">How to use Service Availability</CardTitle>
                    <CardDescription>Simple defaults that don’t confuse users.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="text-sm font-semibold text-zc-text">1) Start with one rule</div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Create a single active rule with slot minutes + weekly windows. Keep it readable.
                        </div>
                      </div>
                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="text-sm font-semibold text-zc-text">2) Use Exceptions for reality</div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Machine maintenance, doctor leave, holidays — add exceptions instead of changing weekly windows.
                        </div>
                      </div>
                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="text-sm font-semibold text-zc-text">3) Keep “Walk-in” for labs</div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Labs often don’t need slot booking; add cut-off times later if required.
                        </div>
                      </div>
                      <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
                        <div className="text-sm font-semibold text-zc-text">4) Later: resources & capacity</div>
                        <div className="mt-1 text-sm text-zc-muted">
                          Once you bind rooms/resources, capacity enforcement becomes automatic.
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4 text-sm text-zc-muted">
                      If your backend doesn’t have <span className="font-semibold text-zc-text">service-availability</span> endpoints yet,
                      this page still compiles and can be wired once the routes are confirmed.
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Rule modal */}
      <AvailabilityRuleModal
        open={ruleOpen}
        onOpenChange={setRuleOpen}
        mode={ruleMode}
        branchId={branchId}
        serviceItem={selectedItem}
        editing={ruleEditing}
        onSaved={async () => {
          toast({ title: "Saved", description: "Availability rule saved successfully." });
          if (selectedItem) await loadAvailabilityForItem(selectedItem.id, false);
        }}
      />

      {/* Exception modal */}
      <AvailabilityExceptionModal
        open={exOpen}
        onOpenChange={setExOpen}
        mode={exMode}
        branchId={branchId}
        serviceItem={selectedItem}
        editing={exEditing}
        onSaved={async () => {
          toast({ title: "Saved", description: "Availability exception saved successfully." });
          if (selectedItem) await loadAvailabilityForItem(selectedItem.id, false);
        }}
      />
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Detail Panel                                 */
/* -------------------------------------------------------------------------- */

function AvailabilityDetail(props: {
  item: ServiceItemRow;
  busy: boolean;

  rulesLoading: boolean;
  rulesErr: string | null;
  rules: AvailabilityRuleRow[];
  exceptions: AvailabilityExceptionRow[];

  onRefresh: () => void;
  onAddRule: () => void;
  onEditRule: (r: AvailabilityRuleRow) => void;
  onCloseRule: (r: AvailabilityRuleRow) => void;
  onDeleteRule: (r: AvailabilityRuleRow) => void;

  onAddException: () => void;
  onEditException: (x: AvailabilityExceptionRow) => void;
  onDeleteException: (x: AvailabilityExceptionRow) => void;
}) {
  const {
    item,
    busy,
    rulesLoading,
    rulesErr,
    rules,
    exceptions,
    onRefresh,
    onAddRule,
    onEditRule,
    onCloseRule,
    onDeleteRule,
    onAddException,
    onEditException,
    onDeleteException,
  } = props;

  const activeRules = rules.filter((r) => r.isActive);

  return (
    <div className="grid gap-4">
      <Card className="border-zc-border">
        <CardHeader className="py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-base">
                <span className="font-mono">{item.code}</span> • {item.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {activeBadge(item.isActive)}
                <span className="mx-2 text-zc-muted">•</span>
                Rules: <span className="font-semibold text-zc-text">{rules.length}</span>
                <span className="mx-2 text-zc-muted">•</span>
                Exceptions: <span className="font-semibold text-zc-text">{exceptions.length}</span>
                <span className="mx-2 text-zc-muted">•</span>
                Kind: <span className="font-semibold text-zc-text">{item.kind || "—"}</span>
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={onRefresh} disabled={rulesLoading || busy}>
                <RefreshCw className={rulesLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh
              </Button>
              <Button variant="outline" className="gap-2" onClick={onAddException} disabled={busy}>
                <Ban className="h-4 w-4" />
                Add Exception
              </Button>
              <Button variant="primary" className="gap-2" onClick={onAddRule} disabled={busy}>
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          {rulesErr ? (
            <div className="rounded-xl border border-zc-danger/40 bg-zc-danger/5 p-4 text-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-zc-danger" />
                <div>
                  <div className="font-semibold text-zc-text">Could not load availability</div>
                  <div className="mt-1 text-zc-muted">{rulesErr}</div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Quick status */}
          {item.isActive && activeRules.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
                <div>
                  <div className="font-semibold">No active availability rules</div>
                  <div className="mt-1 opacity-90">
                    If this service requires appointment scheduling, create at least one active rule to avoid GoLive blocks.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <Separator />

          {/* Rules */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zc-accent" />
              <div className="text-sm font-semibold text-zc-text">Rules</div>
              <Badge variant="secondary">{rules.length}</Badge>
            </div>
          </div>

          <div className="rounded-xl border border-zc-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Mode</TableHead>
                  <TableHead className="w-[180px]">Slots</TableHead>
                  <TableHead className="w-[210px]">Limits</TableHead>
                  <TableHead className="w-[190px]">Effective</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[56px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rulesLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="flex items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                        <CalendarClock className="h-4 w-4" />
                        No rules found. Add a rule to begin.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="text-sm font-semibold text-zc-text">{r.mode || "—"}</div>
                        <div className="text-xs text-zc-muted">TZ: {r.timezone || "Asia/Kolkata"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-zc-muted">
                          Slot: <span className="font-semibold text-zc-text">{r.slotMinutes ?? "—"}</span> min
                        </div>
                        <div className="text-sm text-zc-muted">
                          Lead: <span className="font-semibold text-zc-text">{r.leadTimeMinutes ?? "—"}</span> min
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-zc-muted">
                          Max/day: <span className="font-semibold text-zc-text">{r.maxPerDay ?? "—"}</span>
                        </div>
                        <div className="text-sm text-zc-muted">
                          Max/slot: <span className="font-semibold text-zc-text">{r.maxPerSlot ?? "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-zc-muted">
                          From: <span className="font-semibold text-zc-text">{fmtDate(r.effectiveFrom || null)}</span>
                        </div>
                        <div className="text-sm text-zc-muted">
                          To: <span className="font-semibold text-zc-text">{fmtDate(r.effectiveTo || null)}</span>
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
                            <DropdownMenuLabel>Rule actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onEditRule(r)}>
                              <Wrench className="mr-2 h-4 w-4" />
                              Edit rule
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onCloseRule(r)}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Close (effectiveTo)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                // view json quick
                                const payload = r.rulesJson ?? { windows: r.windows ?? [] };
                                window.alert(JSON.stringify(payload, null, 2));
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View JSON
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onDeleteRule(r)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Separator />

          {/* Exceptions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-zc-accent" />
              <div className="text-sm font-semibold text-zc-text">Exceptions</div>
              <Badge variant="secondary">{exceptions.length}</Badge>
            </div>
          </div>

          <div className="rounded-xl border border-zc-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Date</TableHead>
                  <TableHead className="w-[180px]">Window</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-[160px]">Capacity</TableHead>
                  <TableHead className="w-[56px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rulesLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : exceptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex items-center justify-center gap-3 py-10 text-sm text-zc-muted">
                        <Ban className="h-4 w-4" />
                        No exceptions yet.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  exceptions.map((x) => (
                    <TableRow key={x.id}>
                      <TableCell className="text-sm font-semibold text-zc-text">{fmtDate(x.date)}</TableCell>
                      <TableCell className="text-sm text-zc-muted">
                        {x.isClosed ? (
                          <Badge variant="warning">CLOSED</Badge>
                        ) : (
                          <>
                            {x.startTime || "—"} → {x.endTime || "—"}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-zc-muted">{x.reason || "—"}</TableCell>
                      <TableCell className="text-sm text-zc-muted">
                        {x.capacityOverride != null ? (
                          <span className="font-semibold text-zc-text">{x.capacityOverride}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[220px]">
                            <DropdownMenuLabel>Exception actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onEditException(x)}>
                              <Wrench className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onDeleteException(x)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Updated: {fmtDateTime(item.id ? new Date().toISOString() : null)}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Rule Create/Edit Modal                          */
/* -------------------------------------------------------------------------- */

function AvailabilityRuleModal({
  open,
  onOpenChange,
  mode,
  branchId,
  serviceItem,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  branchId: string;
  serviceItem: ServiceItemRow | null;
  editing: AvailabilityRuleRow | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [tab, setTab] = React.useState<"basic" | "windows" | "json">("basic");

  const [form, setForm] = React.useState<any>({
    mode: "APPOINTMENT",
    timezone: "Asia/Kolkata",
    slotMinutes: 15,
    leadTimeMinutes: 60,
    bookingWindowDays: 30,
    maxPerDay: null,
    maxPerSlot: null,
    isActive: true,
    effectiveFrom: "",
    notes: "",
    windowsJsonText: `[
  { "day": "MON", "start": "09:00", "end": "13:00" },
  { "day": "MON", "start": "16:00", "end": "19:00" },
  { "day": "TUE", "start": "09:00", "end": "13:00" }
]`,
    rulesJsonText: "",
  });

  React.useEffect(() => {
    if (!open) return;
    setTab("basic");

    if (mode === "edit" && editing) {
      setForm({
        mode: editing.mode || "APPOINTMENT",
        timezone: editing.timezone || "Asia/Kolkata",
        slotMinutes: editing.slotMinutes ?? 15,
        leadTimeMinutes: editing.leadTimeMinutes ?? 60,
        bookingWindowDays: editing.bookingWindowDays ?? 30,
        maxPerDay: editing.maxPerDay ?? null,
        maxPerSlot: editing.maxPerSlot ?? null,
        isActive: Boolean(editing.isActive),
        effectiveFrom: editing.effectiveFrom ? new Date(editing.effectiveFrom).toISOString().slice(0, 10) : "",
        notes: editing.notes || "",
        windowsJsonText: editing.windows != null ? JSON.stringify(editing.windows, null, 2) : form.windowsJsonText,
        rulesJsonText: editing.rulesJson != null ? JSON.stringify(editing.rulesJson, null, 2) : "",
      });
    } else {
      setForm((prev: any) => ({
        ...prev,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        isActive: true,
        notes: "",
        rulesJsonText: "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, editing]);

  function patch(p: Partial<any>) {
    setForm((prev: any) => ({ ...prev, ...p }));
  }

  async function save() {
    if (!branchId || !serviceItem?.id) return;

    // parse JSON (optional)
    let windows: any[] | null = null;
    let rulesJson: any | null = null;

    const wText = String(form.windowsJsonText || "").trim();
    if (wText) {
      try {
        windows = JSON.parse(wText);
      } catch {
        toast({ title: "Invalid windows JSON", description: "Weekly windows must be valid JSON array." });
        return;
      }
    }

    const rText = String(form.rulesJsonText || "").trim();
    if (rText) {
      try {
        rulesJson = JSON.parse(rText);
      } catch {
        toast({ title: "Invalid rules JSON", description: "Rules JSON must be valid JSON (or empty)." });
        return;
      }
    }

    const payloadFull: any = {
      branchId,
      serviceItemId: serviceItem.id,
      isActive: Boolean(form.isActive),

      mode: String(form.mode || "APPOINTMENT").trim(),
      timezone: String(form.timezone || "Asia/Kolkata").trim() || "Asia/Kolkata",

      slotMinutes: Number(form.slotMinutes ?? 15),
      leadTimeMinutes: Number(form.leadTimeMinutes ?? 60),
      bookingWindowDays: Number(form.bookingWindowDays ?? 30),
      maxPerDay: form.maxPerDay === "" || form.maxPerDay == null ? null : Number(form.maxPerDay),
      maxPerSlot: form.maxPerSlot === "" || form.maxPerSlot == null ? null : Number(form.maxPerSlot),

      windows,
      rulesJson,

      effectiveFrom: form.effectiveFrom ? new Date(String(form.effectiveFrom)).toISOString() : null,
      notes: String(form.notes || "").trim() || null,
    };

    const payloadMin: any = {
      branchId,
      serviceItemId: serviceItem.id,
      isActive: Boolean(form.isActive),
      rulesJson: rulesJson ?? { windows },
    };

    setSaving(true);
    try {
      if (mode === "create") {
        try {
          await apiTryMany([
            { url: `/api/infrastructure/service-availability/rules`, init: { method: "POST", body: JSON.stringify(payloadFull) } },
            { url: `/api/infra/service-availability/rules`, init: { method: "POST", body: JSON.stringify(payloadFull) } },
            { url: `/api/infrastructure/service-availability`, init: { method: "POST", body: JSON.stringify(payloadFull) } },
            { url: `/api/infra/service-availability`, init: { method: "POST", body: JSON.stringify(payloadFull) } },
          ]);
        } catch (e: any) {
          const msg = e?.message || "";
          if (e instanceof ApiError && e.status === 400 && looksLikeWhitelistError(msg)) {
            await apiTryMany([
              { url: `/api/infrastructure/service-availability/rules`, init: { method: "POST", body: JSON.stringify(payloadMin) } },
              { url: `/api/infra/service-availability/rules`, init: { method: "POST", body: JSON.stringify(payloadMin) } },
              { url: `/api/infrastructure/service-availability`, init: { method: "POST", body: JSON.stringify(payloadMin) } },
              { url: `/api/infra/service-availability`, init: { method: "POST", body: JSON.stringify(payloadMin) } },
            ]);
            toast({
              title: "Saved (minimal)",
              description: "Backend DTO seems strict; saved a minimal payload. We can align DTO fields later.",
            });
          } else {
            throw e;
          }
        }
      } else {
        if (!editing?.id) throw new Error("Invalid editing rule");
        try {
          await apiTryMany([
            { url: `/api/infrastructure/service-availability/rules/${encodeURIComponent(editing.id)}`, init: { method: "PATCH", body: JSON.stringify(payloadFull) } },
            { url: `/api/infra/service-availability/rules/${encodeURIComponent(editing.id)}`, init: { method: "PATCH", body: JSON.stringify(payloadFull) } },
            { url: `/api/infrastructure/service-availability/${encodeURIComponent(editing.id)}`, init: { method: "PATCH", body: JSON.stringify(payloadFull) } },
            { url: `/api/infra/service-availability/${encodeURIComponent(editing.id)}`, init: { method: "PATCH", body: JSON.stringify(payloadFull) } },
          ]);
        } catch (e: any) {
          const msg = e?.message || "";
          if (e instanceof ApiError && e.status === 400 && looksLikeWhitelistError(msg)) {
            await apiTryMany([
              { url: `/api/infrastructure/service-availability/rules/${encodeURIComponent(editing.id)}`, init: { method: "PATCH", body: JSON.stringify(payloadMin) } },
              { url: `/api/infra/service-availability/rules/${encodeURIComponent(editing.id)}`, init: { method: "PATCH", body: JSON.stringify(payloadMin) } },
              { url: `/api/infrastructure/service-availability/${encodeURIComponent(editing.id)}`, init: { method: "PATCH", body: JSON.stringify(payloadMin) } },
              { url: `/api/infra/service-availability/${encodeURIComponent(editing.id)}`, init: { method: "PATCH", body: JSON.stringify(payloadMin) } },
            ]);
            toast({
              title: "Updated (minimal)",
              description: "Backend update rejects some fields; saved minimal payload. Align DTO next.",
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
              <CalendarClock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            {mode === "create" ? "New Availability Rule" : "Edit Availability Rule"}
          </DialogTitle>
          <DialogDescription>
            {serviceItem ? (
              <>
                For <span className="font-semibold text-zc-text">{serviceItem.code}</span> — {serviceItem.name}
              </>
            ) : (
              "Select a service item first."
            )}
          </DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="px-6 pb-6 grid gap-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className={cn("h-10 rounded-2xl border border-zc-border bg-zc-panel/20 p-1")}>
              <TabsTrigger
                value="basic"
                className={cn(
                  "rounded-xl px-3 data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm",
                )}
              >
                Basic
              </TabsTrigger>
              <TabsTrigger
                value="windows"
                className={cn(
                  "rounded-xl px-3 data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm",
                )}
              >
                Weekly Windows
              </TabsTrigger>
              <TabsTrigger
                value="json"
                className={cn(
                  "rounded-xl px-3 data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm",
                )}
              >
                Advanced JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Mode</Label>
                  <Select value={String(form.mode || "APPOINTMENT")} onValueChange={(v) => patch({ mode: v })}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APPOINTMENT">APPOINTMENT</SelectItem>
                      <SelectItem value="WALKIN">WALK-IN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Timezone</Label>
                  <Input value={String(form.timezone || "Asia/Kolkata")} onChange={(e) => patch({ timezone: e.target.value })} />
                </div>

                <div className="grid gap-2">
                  <Label>Slot minutes</Label>
                  <Input
                    inputMode="numeric"
                    value={String(form.slotMinutes ?? 15)}
                    onChange={(e) => patch({ slotMinutes: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Lead time (minutes)</Label>
                  <Input
                    inputMode="numeric"
                    value={String(form.leadTimeMinutes ?? 60)}
                    onChange={(e) => patch({ leadTimeMinutes: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Booking window (days)</Label>
                  <Input
                    inputMode="numeric"
                    value={String(form.bookingWindowDays ?? 30)}
                    onChange={(e) => patch({ bookingWindowDays: e.target.value })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Effective From</Label>
                  <Input type="date" value={String(form.effectiveFrom || "")} onChange={(e) => patch({ effectiveFrom: e.target.value })} />
                </div>

                <div className="grid gap-2">
                  <Label>Max per day (optional)</Label>
                  <Input value={form.maxPerDay ?? ""} onChange={(e) => patch({ maxPerDay: e.target.value })} placeholder="e.g., 40" />
                </div>

                <div className="grid gap-2">
                  <Label>Max per slot (optional)</Label>
                  <Input value={form.maxPerSlot ?? ""} onChange={(e) => patch({ maxPerSlot: e.target.value })} placeholder="e.g., 2" />
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label>Notes (optional)</Label>
                  <Textarea value={String(form.notes || "")} onChange={(e) => patch({ notes: e.target.value })} className="min-h-[90px]" />
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                    <Switch checked={Boolean(form.isActive)} onCheckedChange={(v) => patch({ isActive: v })} />
                    <div className="text-sm">
                      <div className="font-semibold text-zc-text">{form.isActive ? "Active" : "Inactive"}</div>
                      <div className="text-xs text-zc-muted">Inactive rules shouldn’t be used for new bookings</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="windows" className="mt-4">
              <div className="grid gap-2">
                <Label>Weekly windows JSON</Label>
                <Textarea
                  value={String(form.windowsJsonText || "")}
                  onChange={(e) => patch({ windowsJsonText: e.target.value })}
                  className="min-h-[260px]"
                />
                <div className="text-xs text-zc-muted">
                  Example: day = MON/TUE/WED/THU/FRI/SAT/SUN, start/end = HH:mm.
                </div>
              </div>
            </TabsContent>

            <TabsContent value="json" className="mt-4">
              <div className="grid gap-2">
                <Label>Advanced rules JSON (optional)</Label>
                <Textarea
                  value={String(form.rulesJsonText || "")}
                  onChange={(e) => patch({ rulesJsonText: e.target.value })}
                  placeholder={`{\n  "cutOffTime": "18:00",\n  "allowWalkinOverbook": false,\n  "resourcePolicy": { "enforce": true }\n}`}
                  className="min-h-[260px]"
                />
                <div className="text-xs text-zc-muted">
                  Use this when your backend stores extra policy fields (resource enforcement, cut-offs, buffers).
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !serviceItem}>
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
/*                          Exception Create/Edit Modal                         */
/* -------------------------------------------------------------------------- */

function AvailabilityExceptionModal({
  open,
  onOpenChange,
  mode,
  branchId,
  serviceItem,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  branchId: string;
  serviceItem: ServiceItemRow | null;
  editing: AvailabilityExceptionRow | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState<any>({
    date: "",
    isClosed: true,
    startTime: "",
    endTime: "",
    capacityOverride: "",
    reason: "",
  });

  React.useEffect(() => {
    if (!open) return;

    if (mode === "edit" && editing) {
      setForm({
        date: editing.date ? new Date(editing.date).toISOString().slice(0, 10) : "",
        isClosed: Boolean(editing.isClosed),
        startTime: editing.startTime || "",
        endTime: editing.endTime || "",
        capacityOverride: editing.capacityOverride != null ? String(editing.capacityOverride) : "",
        reason: editing.reason || "",
      });
    } else {
      setForm({
        date: new Date().toISOString().slice(0, 10),
        isClosed: true,
        startTime: "",
        endTime: "",
        capacityOverride: "",
        reason: "",
      });
    }
  }, [open, mode, editing]);

  function patch(p: Partial<any>) {
    setForm((prev: any) => ({ ...prev, ...p }));
  }

  async function save() {
    if (!branchId || !serviceItem?.id) return;

    if (!form.date) {
      toast({ title: "Missing date", description: "Select a date for the exception." });
      return;
    }

    const payload: any = {
      branchId,
      serviceItemId: serviceItem.id,
      date: new Date(String(form.date)).toISOString(),
      isClosed: Boolean(form.isClosed),
      startTime: String(form.startTime || "").trim() || null,
      endTime: String(form.endTime || "").trim() || null,
      capacityOverride:
        String(form.capacityOverride || "").trim() === "" ? null : Number(String(form.capacityOverride).trim()),
      reason: String(form.reason || "").trim() || null,
    };

    setSaving(true);
    try {
      if (mode === "create") {
        await apiTryMany([
          { url: `/api/infrastructure/service-availability/exceptions`, init: { method: "POST", body: JSON.stringify(payload) } },
          { url: `/api/infra/service-availability/exceptions`, init: { method: "POST", body: JSON.stringify(payload) } },
        ]);
      } else {
        if (!editing?.id) throw new Error("Invalid editing exception");
        await apiTryMany([
          { url: `/api/infrastructure/service-availability/exceptions/${encodeURIComponent(editing.id)}`, init: { method: "PATCH", body: JSON.stringify(payload) } },
          { url: `/api/infra/service-availability/exceptions/${encodeURIComponent(editing.id)}`, init: { method: "PATCH", body: JSON.stringify(payload) } },
        ]);
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
              <Ban className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            {mode === "create" ? "New Exception" : "Edit Exception"}
          </DialogTitle>
          <DialogDescription>
            {serviceItem ? (
              <>
                For <span className="font-semibold text-zc-text">{serviceItem.code}</span> — {serviceItem.name}
              </>
            ) : (
              "Select a service item first."
            )}
          </DialogDescription>
        </DialogHeader>

        <Separator className="my-4" />

        <div className="px-6 pb-6 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input type="date" value={String(form.date || "")} onChange={(e) => patch({ date: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <Label>Closed day?</Label>
              <div className="flex items-center gap-3 rounded-xl border border-zc-border bg-zc-panel/20 px-3 py-2">
                <Switch checked={Boolean(form.isClosed)} onCheckedChange={(v) => patch({ isClosed: v })} />
                <div className="text-sm">
                  <div className="font-semibold text-zc-text">{form.isClosed ? "Closed" : "Open with override"}</div>
                  <div className="text-xs text-zc-muted">If open, you can set time window / capacity override</div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Start time (optional)</Label>
              <Input value={String(form.startTime || "")} onChange={(e) => patch({ startTime: e.target.value })} placeholder="HH:mm" />
            </div>

            <div className="grid gap-2">
              <Label>End time (optional)</Label>
              <Input value={String(form.endTime || "")} onChange={(e) => patch({ endTime: e.target.value })} placeholder="HH:mm" />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label>Capacity override (optional)</Label>
              <Input value={String(form.capacityOverride || "")} onChange={(e) => patch({ capacityOverride: e.target.value })} placeholder="e.g., 10" />
              <div className="text-xs text-zc-muted">If set, overrides max slots for this date.</div>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label>Reason (optional)</Label>
              <Textarea value={String(form.reason || "")} onChange={(e) => patch({ reason: e.target.value })} className="min-h-[110px]" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !serviceItem}>
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
