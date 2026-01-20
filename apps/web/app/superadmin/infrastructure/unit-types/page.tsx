"use client";

import * as React from "react";
import { AppLink as Link } from "@/components/app-link";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Save,
  Layers,
  Building2,
  Plus,
  Wand2,
  Pencil,
  BookAIcon
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type BranchRow = {
  id: string;
  code: string;
  name: string;
  city: string;
};

type UnitTypeCatalogRow = {
  id: string;
  code: string;
  name: string;
  usesRoomsDefault?: boolean;
  schedulableByDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
};

type BranchUnitTypeRow =
  | string
  | {
      id?: string;
      unitTypeId: string;
      isEnabled: boolean;
    };

const LS_KEY = "zc.superadmin.infrastructure.branchId";

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

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-zinc-200 dark:bg-zinc-800", className)} />;
}

function suggestCatalogCode(name: string) {
  const raw = (name || "").trim().toUpperCase();
  if (!raw) return "";
  // Keep A-Z, 0-9, underscore, hyphen. Convert whitespace to underscore.
  const normalized = raw.replace(/\s+/g, "_").replace(/[^A-Z0-9_-]/g, "");
  return normalized.slice(0, 32); // Prisma allows VarChar(32)
}

export default function SuperAdminUnitTypeEnablementPage() {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState<string | undefined>(undefined);

  const [catalog, setCatalog] = React.useState<UnitTypeCatalogRow[]>([]);
  const [enabledSet, setEnabledSet] = React.useState<Set<string>>(new Set());
  const [initialEnabledSet, setInitialEnabledSet] = React.useState<Set<string>>(new Set());

  const [q, setQ] = React.useState("");

  // ---- Create Catalog Dialog state ----
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createBusy, setCreateBusy] = React.useState(false);
  const [createErr, setCreateErr] = React.useState<string | null>(null);
  const [manualCode, setManualCode] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<{
    code: string;
    name: string;
    usesRoomsDefault: boolean;
    schedulableByDefault: boolean;
    isActive: boolean;
    sortOrder: number;
  }>({
    code: "",
    name: "",
    usesRoomsDefault: true,
    schedulableByDefault: false,
    isActive: true,
    sortOrder: 0,
  });

  const hasChanges = React.useMemo(() => {
    if (enabledSet.size !== initialEnabledSet.size) return true;
    for (const id of enabledSet) if (!initialEnabledSet.has(id)) return true;
    return false;
  }, [enabledSet, initialEnabledSet]);

  async function loadBranches(): Promise<string | undefined> {
    setErr(null);
    try {
      const rows = await apiFetch<BranchRow[]>("/api/branches");
      setBranches(rows || []);

      const stored = readLS(LS_KEY);
      const first = rows?.[0]?.id;

      const next =
        (stored && rows?.some((b) => b.id === stored) ? stored : undefined) || first || undefined;

      setBranchId(next);
      if (next) writeLS(LS_KEY, next);

      return next;
    } catch (e: any) {
      setErr(e?.message || "Unable to load branches.");
      return undefined;
    }
  }

  async function loadCatalog() {
    const rows = await apiFetch<UnitTypeCatalogRow[]>("/api/infrastructure/unit-types/catalog");
    setCatalog(rows || []);
  }

  function normalizeEnabledIds(rows: BranchUnitTypeRow[]): string[] {
    if (!rows) return [];
    if (typeof rows[0] === "string") return (rows as string[]).filter(Boolean);
    return (rows as any[])
      .filter((r) => r?.unitTypeId && r?.isEnabled === true)
      .map((r) => String(r.unitTypeId));
  }

  async function loadBranchEnabledTypes(bid: string) {
    const rows = await apiFetch<BranchUnitTypeRow[]>(
      `/api/infrastructure/branches/${encodeURIComponent(bid)}/unit-types`
    );
    const ids = normalizeEnabledIds(rows || []);
    const set = new Set(ids);
    setEnabledSet(set);
    setInitialEnabledSet(new Set(ids));
  }

  async function refreshAll(showToast = false) {
    setBusy(true);
    setErr(null);
    try {
      const nextBranchId = await loadBranches();
      await loadCatalog();
      if (nextBranchId) await loadBranchEnabledTypes(nextBranchId);
      if (showToast) toast({ title: "Refreshed", description: "Loaded latest data." });
    } catch (e: any) {
      const msg = e?.message || "Refresh failed.";
      setErr(msg);
      if (showToast) toast({ title: "Refresh failed", description: msg, variant: "destructive" as any });
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void refreshAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!branchId) return;
    setBusy(true);
    setErr(null);
    void (async () => {
      try {
        await loadBranchEnabledTypes(branchId);
      } catch (e: any) {
        setErr(e?.message || "Unable to load enablement.");
      } finally {
        setBusy(false);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return catalog;
    return catalog.filter((r) => `${r.code} ${r.name}`.toLowerCase().includes(s));
  }, [catalog, q]);

  function toggle(id: string) {
    setEnabledSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setEnabledSet(new Set(catalog.map((c) => c.id)));
  }

  function deselectAll() {
    setEnabledSet(new Set());
  }

  async function save() {
    if (!branchId) return;
    setBusy(true);
    setErr(null);

    try {
      const unitTypeIds = Array.from(enabledSet);

      await apiFetch(`/api/infrastructure/branches/${encodeURIComponent(branchId)}/unit-types`, {
        method: "PUT",
        body: JSON.stringify({ unitTypeIds }),
      });

      setInitialEnabledSet(new Set(unitTypeIds));
      toast({ title: "Saved", description: "Unit type enablement updated successfully." });
    } catch (e: any) {
      const msg = e?.message || "Save failed.";
      setErr(msg);
      toast({ title: "Save failed", description: msg, variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  const selectedBranch = React.useMemo(
    () => branches.find((b) => b.id === branchId) || null,
    [branches, branchId]
  );

  // Auto-suggest code from name when not manually edited
  React.useEffect(() => {
    if (!createOpen) return;
    if (manualCode) return;
    const suggested = suggestCatalogCode(createForm.name);
    setCreateForm((p) => ({ ...p, code: suggested }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createForm.name, manualCode, createOpen]);

  function openCreateDialog() {
    setCreateErr(null);
    setManualCode(false);
    setCreateForm({
      code: "",
      name: "",
      usesRoomsDefault: true,
      schedulableByDefault: false,
      isActive: true,
      sortOrder: 0,
    });
    setCreateOpen(true);
  }

  async function createCatalog() {
    setCreateErr(null);

    const code = (createForm.code || "").trim().toUpperCase();
    const name = (createForm.name || "").trim();

    if (!name) return setCreateErr("Name is required.");
    if (!code) return setCreateErr("Code is required.");
    if (code.length < 2 || code.length > 32) return setCreateErr("Code must be between 2 and 32 characters.");
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      return setCreateErr("Code can contain only A–Z, 0–9, underscore (_) and hyphen (-).");
    }
    if (catalog.some((c) => (c.code || "").toUpperCase() === code)) {
      return setCreateErr(`Code "${code}" already exists in the catalog.`);
    }
    if (name.length > 120) return setCreateErr("Name must be 120 characters or less.");

    setCreateBusy(true);
    try {
      await apiFetch("/api/infrastructure/unit-types/catalog", {
        method: "POST",
        body: JSON.stringify({
          code,
          name,
          usesRoomsDefault: !!createForm.usesRoomsDefault,
          schedulableByDefault: !!createForm.schedulableByDefault,
          isActive: !!createForm.isActive,
          sortOrder: Number.isFinite(createForm.sortOrder) ? Math.max(0, Math.floor(createForm.sortOrder)) : 0,
        }),
      });

      toast({
        title: "Catalogue Created",
        description: `Unit type "${name}" added to catalog.`,
      });

      setCreateOpen(false);
      await loadCatalog();
    } catch (e: any) {
      const msg = e?.message || "Unable to create catalog item.";
      setCreateErr(msg);
      toast({ title: "Create failed", description: msg, variant: "destructive" as any });
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <AppShell title="Infrastructure • Unit Types">
      <div className="grid gap-6">
        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
    <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-indigo-200/60 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-900/20">
            <BookAIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
        </span>

        <div className="min-w-0">
            <div className="text-sm text-zc-muted">
                <Link href="/superadmin/infrastructure" className="hover:underline">
                    Infrastructure
                </Link>
                <span className="mx-2 text-zc-muted/60">/</span>
                <span className="text-zc-text">Unit Types</span>
            </div>

            <div className="mt-1 text-3xl font-semibold tracking-tight">Unit Type Enablement</div>

            <div className="mt-2 max-w-3xl text-sm leading-6 text-zc-muted">
                Enable/disable unit types per branch. Only enabled unit types can be used while creating Units/Wards.
            </div>
        </div>
    </div>

    {/* CHANGE IS HERE: Changed 'flex-wrap' to 'flex-nowrap' */}
    <div className="flex flex-nowrap items-center gap-3">
        <Button variant="outline" className="gap-2" disabled={busy} onClick={() => void refreshAll(true)}>
            <RefreshCw className={cn("h-4 w-4", busy ? "animate-spin" : "")} />
            Refresh
        </Button>

        <Button variant="outline" className="gap-2" disabled={busy} onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Create Catalogue
        </Button>

        <Button className="gap-2" disabled={busy || !branchId || !hasChanges} onClick={() => void save()}>
            <Save className="h-4 w-4" />
            Save Changes
        </Button>
    </div>
</div>

        {err ? (
          <div className="flex items-start gap-2 rounded-xl border border-[rgb(var(--zc-danger-rgb)/0.35)] bg-[rgb(var(--zc-danger-rgb)/0.12)] px-3 py-2 text-sm text-[rgb(var(--zc-danger))]">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">{err}</div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Branch selector */}
          <Card className="lg:col-span-1 overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-zc-accent" />
                Branch
              </CardTitle>
              <CardDescription>Select the branch to configure.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {loading ? (
                <Skeleton className="h-11 w-full rounded-xl" />
              ) : (
                <div className="grid gap-3">
                  <Select
                    value={branchId}
                    onValueChange={(v) => {
                      setBranchId(v);
                      writeLS(LS_KEY, v);
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-zc-border bg-zc-card">
                      <SelectValue placeholder="Select a branch…" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} <span className="font-mono text-xs text-zc-muted">({b.code})</span>{" "}
                          <span className="text-xs text-zc-muted">• {b.city}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedBranch ? (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900/50 dark:bg-sky-900/10">
                      <div className="font-semibold text-zc-text">{selectedBranch.name}</div>
                      <div className="mt-1 text-zc-muted">
                        <span className="font-mono">{selectedBranch.code}</span> • {selectedBranch.city}
                      </div>
                      <div className="mt-2 text-xs text-zc-muted">
                        Enabled types: <span className="font-semibold tabular-nums">{enabledSet.size}</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="success" onClick={selectAll} disabled={busy || catalog.length === 0}>
                      Select all
                    </Button>
                    <Button type="button" variant="destructive" onClick={deselectAll} disabled={busy}>
                      Deselect all
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Catalog */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-zc-accent" />
                Catalog
              </CardTitle>
              <CardDescription>Search and toggle which unit types are enabled for the selected branch.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center gap-3">
                <input
                  className="h-11 w-full rounded-xl border border-zc-border bg-zc-card px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="Search unit types (code/name)…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <div className="text-xs text-zc-muted tabular-nums whitespace-nowrap">
                  {enabledSet.size}/{catalog.length} enabled
                </div>
              </div>

              {loading ? (
                <div className="grid gap-3">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-4 text-sm text-zc-muted">
                  No unit types match your search.
                </div>
              ) : (
                <div className="grid gap-2">
                  {filtered.map((ut) => {
                    const checked = enabledSet.has(ut.id);

                    // Selected = green, non-selected = red
                    const bgTone = checked
                      ? "border-emerald-200/50 bg-emerald-50/40 dark:border-emerald-900/35 dark:bg-emerald-900/15"
                      : "border-rose-200/60 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-900/20";

                    return (
                      <div
                        key={ut.id}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-xl border px-3 py-3",
                          bgTone,
                          checked ? "ring-1 ring-emerald-500/20" : "ring-1 ring-rose-500/10"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold text-zc-text">
                              {ut.name}{" "}
                              <span className="ml-1 font-mono text-xs text-zc-muted">({ut.code})</span>
                            </div>

                            {checked ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50/60 px-2 py-0.5 text-[11px] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Enabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-rose-200/60 bg-rose-50/60 px-2 py-0.5 text-[11px] text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200">
                                Disabled
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-zc-muted">
                            <span className="rounded-full border border-zc-border bg-white/40 dark:bg-black/10 px-2 py-0.5">
                              usesRoomsDefault: <span className="font-mono">{String(!!ut.usesRoomsDefault)}</span>
                            </span>
                            <span className="rounded-full border border-zc-border bg-white/40 dark:bg-black/10 px-2 py-0.5">
                              schedulableByDefault:{" "}
                              <span className="font-mono">{String(!!ut.schedulableByDefault)}</span>
                            </span>
                          </div>
                        </div>

                        <label className="inline-flex items-center gap-2 select-none">
                          <input
                            type="checkbox"
                            className="h-5 w-5 rounded border-zc-border"
                            checked={checked}
                            onChange={() => toggle(ut.id)}
                            disabled={busy || !branchId}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Catalog Dialog (no description) */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          if (!v) {
            setCreateErr(null);
            setCreateBusy(false);
            setManualCode(false);
          }
          setCreateOpen(v);
        }}
      >
        <DialogContent
          className="sm:max-w-[640px] border-indigo-200/50 dark:border-indigo-800/50 shadow-2xl shadow-indigo-500/10"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              Create Unit Type Catalogue
            </DialogTitle>
            <DialogDescription>
              Adds a new Unit Type to the global catalog. After creation, you can enable it per-branch from this page.
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-4" />

          {createErr ? (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-[rgb(var(--xc-danger-rgb)/0.35)] bg-[rgb(var(--xc-danger-rgb)/0.12)] px-3 py-2 text-sm text-[rgb(var(--xc-danger))]">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div className="min-w-0">{createErr}</div>
            </div>
          ) : null}

          <div className="grid gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Operation Theatre"
                  disabled={createBusy}
                />
                <p className="text-[11px] text-xc-muted">Human-friendly display name (max 120 chars).</p>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Code</Label>
                  {!manualCode && createForm.code ? (
                    <span className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400">
                      <Wand2 className="h-3 w-3" /> Auto-suggested
                    </span>
                  ) : null}
                </div>

                <div className="relative">
                  <Input
                    value={createForm.code}
                    onChange={(e) => {
                      setManualCode(true);
                      setCreateForm((p) => ({ ...p, code: e.target.value.toUpperCase() }));
                    }}
                    placeholder="OT"
                    className={cn(
                      "font-mono bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800 focus-visible:ring-indigo-500",
                      createBusy && "opacity-80"
                    )}
                    disabled={createBusy}
                  />

                  {!manualCode && createForm.code ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="absolute right-1 top-1 h-7 w-7 text-xc-muted hover:text-xc-text"
                      title="Edit manually"
                      onClick={() => setManualCode(true)}
                      disabled={createBusy}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Edit</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="absolute right-1 top-1 h-7 w-7 text-xc-muted hover:text-xc-text"
                      title="Suggest from name"
                      onClick={() => {
                        setManualCode(false);
                        setCreateForm((p) => ({ ...p, code: suggestCatalogCode(p.name) }));
                      }}
                      disabled={createBusy}
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Suggest</span>
                    </Button>
                  )}
                </div>

                <p className="text-[11px] text-xc-muted">
                  Allowed: A–Z, 0–9, <span className="font-mono">_</span>, <span className="font-mono">-</span>. Max 32
                  chars.
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start justify-between gap-3 rounded-xl border border-xc-border bg-xc-panel/10 p-3">
                <div className="grid gap-1">
                  <div className="text-sm font-semibold">Uses Rooms</div>
                  <div className="text-[11px] text-xc-muted">Default behavior for new units of this type.</div>
                </div>
                <Switch
                  checked={createForm.usesRoomsDefault}
                  onCheckedChange={(v) => setCreateForm((p) => ({ ...p, usesRoomsDefault: !!v }))}
                  disabled={createBusy}
                />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-xl border border-xc-border bg-xc-panel/10 p-3">
                <div className="grid gap-1">
                  <div className="text-sm font-semibold">Schedulable</div>
                  <div className="text-[11px] text-xc-muted">Default scheduling capability.</div>
                </div>
                <Switch
                  checked={createForm.schedulableByDefault}
                  onCheckedChange={(v) => setCreateForm((p) => ({ ...p, schedulableByDefault: !!v }))}
                  disabled={createBusy}
                />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-xl border border-xc-border bg-xc-panel/10 p-3">
                <div className="grid gap-1">
                  <div className="text-sm font-semibold">Active</div>
                  <div className="text-[11px] text-xc-muted">Inactive types stay hidden in selectors.</div>
                </div>
                <Switch
                  checked={createForm.isActive}
                  onCheckedChange={(v) => setCreateForm((p) => ({ ...p, isActive: !!v }))}
                  disabled={createBusy}
                />
              </div>

              <div className="grid gap-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={createForm.sortOrder}
                  onChange={(e) => setCreateForm((p) => ({ ...p, sortOrder: Number(e.target.value || 0) }))}
                  disabled={createBusy}
                />
                <p className="text-[11px] text-xc-muted">Lower numbers appear first. Leave 0 if unsure.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createBusy}>
              Cancel
            </Button>
            <Button type="button" className="gap-2" onClick={() => void createCatalog()} disabled={createBusy}>
              <Plus className={cn("h-4 w-4", createBusy ? "animate-pulse" : "")} />
              Create Catalogue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
