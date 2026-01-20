"use client";

import * as React from "react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/use-toast";

import {
  Activity,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Image as ImageIcon,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

// ---------------- Types (lightweight; tolerant to backend changes) ----------------

type BranchRow = { id: string; code: string; name: string; city?: string | null };

type SectionRow = { id: string; branchId: string; code: string; name: string; sortOrder: number; isActive: boolean };

type CategoryRow = {
  id: string;
  branchId: string;
  sectionId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  section?: SectionRow;
};

type SpecimenRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  container?: string | null;
  minVolumeMl?: number | null;
  handlingNotes?: string | null;
  sortOrder?: number;
  isActive: boolean;
};

type DiagnosticKind = "LAB" | "IMAGING" | "PROCEDURE";

type DiagnosticItemRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  kind: DiagnosticKind;
  sectionId: string;
  categoryId?: string | null;
  specimenId?: string | null;
  isPanel: boolean;
  preparationText?: string | null;
  consentRequired?: boolean;
  appointmentRequired?: boolean;
  sortOrder: number;
  isActive: boolean;
  section?: SectionRow;
  category?: CategoryRow | null;
  specimen?: SpecimenRow | null;
};

type PanelItemRow = {
  panelId: string;
  itemId: string;
  sortOrder: number;
  isActive: boolean;
  item?: DiagnosticItemRow;
};

type ResultDataType = "NUMERIC" | "TEXT" | "CHOICE";

type RangeRow = {
  id: string;
  parameterId: string;
  sex?: string | null;
  ageMinDays?: number | null;
  ageMaxDays?: number | null;
  low?: number | null;
  high?: number | null;
  textRange?: string | null;
  sortOrder: number;
  isActive: boolean;
};

type ParameterRow = {
  id: string;
  testId: string;
  code: string;
  name: string;
  dataType: ResultDataType;
  unit?: string | null;
  precision?: number | null;
  allowedText?: string | null;
  criticalLow?: number | null;
  criticalHigh?: number | null;
  sortOrder: number;
  isActive: boolean;
  ranges?: RangeRow[];
};

type TemplateKind = "IMAGING_REPORT" | "LAB_REPORT";

type TemplateRow = {
  id: string;
  itemId: string;
  kind: TemplateKind;
  name: string;
  body: string;
  isActive: boolean;
};

type ChargeMapRow = {
  id: string;
  branchId: string;
  diagnosticItemId: string;
  chargeMasterId: string;
  price?: number | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive: boolean;
  updatedAt?: string;
  diagnosticItem?: DiagnosticItemRow;
};

type ChargeMasterRow = {
  id: string;
  code?: string;
  name?: string;
  price?: number;
};

const DIAG_KINDS: Array<{ value: DiagnosticKind; label: string }> = [
  { value: "LAB", label: "Lab" },
  { value: "IMAGING", label: "Imaging" },
  { value: "PROCEDURE", label: "Procedure" },
];

const RESULT_TYPES: Array<{ value: ResultDataType; label: string }> = [
  { value: "NUMERIC", label: "Numeric" },
  { value: "TEXT", label: "Text" },
  { value: "CHOICE", label: "Choice" },
];

const TEMPLATE_KINDS: Array<{ value: TemplateKind; label: string }> = [
  { value: "IMAGING_REPORT", label: "Imaging report" },
  { value: "LAB_REPORT", label: "Lab report" },
];

// ---------------- Utilities ----------------

const LS_KEY = "zc.superadmin.infrastructure.branchId";
const CODE_REGEX = /^[A-Z0-9][A-Z0-9-]{0,31}$/; // 1–32, letters/numbers/hyphen

function normalizeCode(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

function isBlank(v: any) {
  return !String(v ?? "").trim();
}

function validateCode(v: any, label: string): string | null {
  const code = normalizeCode(v);
  if (!code) return `${label} code is required`;
  if (!CODE_REGEX.test(code)) return `${label} code must be 1–32 chars, letters/numbers/hyphen (e.g., TH01, OT-1, LAB1)`;
  return null;
}

function validateName(v: any, label: string): string | null {
  const name = String(v ?? "").trim();
  if (!name) return `${label} name is required`;
  if (name.length > 200) return `${label} name is too long`;
  return null;
}

function toInt(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(v: any): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function safeArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function formatDateISO(v?: string | null): string {
  if (!v) return "";
  try {
    // If backend sends ISO, keep date part.
    return String(v).slice(0, 10);
  } catch {
    return "";
  }
}

function itemLabel(i: DiagnosticItemRow) {
  return `${i.code} — ${i.name}`;
}

function toneByKind(kind: DiagnosticKind) {
  if (kind === "LAB") return "bg-emerald-50/70 text-emerald-800 border border-emerald-200/70 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-900/40";
  if (kind === "IMAGING") return "bg-sky-50/70 text-sky-800 border border-sky-200/70 dark:bg-sky-900/20 dark:text-sky-200 dark:border-sky-900/40";
  return "bg-violet-50/70 text-violet-800 border border-violet-200/70 dark:bg-violet-900/20 dark:text-violet-200 dark:border-violet-900/40";
}

type ActiveTab = "items" | "panels" | "lab" | "templates" | "charges";

export default function DiagnosticsConfigPage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<ActiveTab>("items");

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState<string>("");
  const [branchLoading, setBranchLoading] = React.useState(false);

  const [bootErr, setBootErr] = React.useState<string | null>(null);

  const loadBranches = React.useCallback(async () => {
    setBranchLoading(true);
    setBootErr(null);
    try {
      const list = await apiFetch<BranchRow[]>(`/api/branches`);
      setBranches(list || []);
      const saved = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
      const first = (list || [])[0]?.id;
      const pick = saved && (list || []).some((b) => b.id === saved) ? saved : first || "";
      if (pick) setBranchId(pick);
    } catch (e: any) {
      const msg = e?.message || "Failed to load branches";
      setBootErr(msg);
      toast({ title: "Branches", description: msg, variant: "destructive" as any });
    } finally {
      setBranchLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  React.useEffect(() => {
    if (!branchId) return;
    try {
      localStorage.setItem(LS_KEY, branchId);
    } catch {
      // ignore
    }
  }, [branchId]);

  const branch = React.useMemo(() => branches.find((b) => b.id === branchId) || null, [branches, branchId]);

  return (
    <AppShell title="Diagnostics Configuration">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-1">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-base">Diagnostics Configuration</CardTitle>
                <CardDescription>
                  Configure diagnostic items, panels, lab parameters/ranges, imaging templates, and charge mapping.
                </CardDescription>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-[260px]">
                  <Select value={branchId} onValueChange={(v) => setBranchId(v)}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={branchLoading ? "Loading branches…" : "Select branch"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[320px] overflow-y-auto">
                      {(branches || []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.code} — {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  onClick={() => loadBranches()}
                  disabled={branchLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {bootErr ? (
              <div className="rounded-xl border border-rose-200/70 bg-rose-50/70 p-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200">
                {bootErr}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zc-text">Branch</div>
                <div className="mt-1 text-sm text-zc-muted">
                  {branch ? (
                    <span>
                      {branch.code} — {branch.name}
                      {branch.city ? <span className="text-zc-muted"> · {branch.city}</span> : null}
                    </span>
                  ) : (
                    <span className="text-zc-muted">Select a branch to begin</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Views</div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <button
                    type="button"
                    onClick={() => setActiveTab("items")}
                    className={cn(
                      "group rounded-2xl border p-3 text-left transition",
                      activeTab === "items"
                        ? "border-sky-200/70 bg-sky-50/70 dark:border-sky-900/40 dark:bg-sky-900/20"
                        : "border-zc-border bg-zc-panel/10 hover:bg-zc-panel/20",
                    )}
                    aria-pressed={activeTab === "items"}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/50 dark:border-white/10 dark:bg-black/10">
                          <ClipboardList className="h-4 w-4 text-sky-700 dark:text-sky-200" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zc-text">Items</div>
                          <div className="text-xs text-zc-muted">CRUD + deactivate</div>
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("panels")}
                    className={cn(
                      "group rounded-2xl border p-3 text-left transition",
                      activeTab === "panels"
                        ? "border-violet-200/70 bg-violet-50/70 dark:border-violet-900/40 dark:bg-violet-900/20"
                        : "border-zc-border bg-zc-panel/10 hover:bg-zc-panel/20",
                    )}
                    aria-pressed={activeTab === "panels"}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/50 dark:border-white/10 dark:bg-black/10">
                          <Activity className="h-4 w-4 text-violet-700 dark:text-violet-200" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zc-text">Panel Builder</div>
                          <div className="text-xs text-zc-muted">Search + multi-select</div>
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("lab")}
                    className={cn(
                      "group rounded-2xl border p-3 text-left transition",
                      activeTab === "lab"
                        ? "border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-900/20"
                        : "border-zc-border bg-zc-panel/10 hover:bg-zc-panel/20",
                    )}
                    aria-pressed={activeTab === "lab"}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/50 dark:border-white/10 dark:bg-black/10">
                          <FlaskConical className="h-4 w-4 text-emerald-700 dark:text-emerald-200" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zc-text">Lab Params</div>
                          <div className="text-xs text-zc-muted">Parameters + ranges</div>
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("templates")}
                    className={cn(
                      "group rounded-2xl border p-3 text-left transition",
                      activeTab === "templates"
                        ? "border-amber-200/70 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-900/20"
                        : "border-zc-border bg-zc-panel/10 hover:bg-zc-panel/20",
                    )}
                    aria-pressed={activeTab === "templates"}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/50 dark:border-white/10 dark:bg-black/10">
                          <ImageIcon className="h-4 w-4 text-amber-800 dark:text-amber-200" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zc-text">Templates</div>
                          <div className="text-xs text-zc-muted">Textarea + preview</div>
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("charges")}
                    className={cn(
                      "group rounded-2xl border p-3 text-left transition",
                      activeTab === "charges"
                        ? "border-rose-200/70 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-900/20"
                        : "border-zc-border bg-zc-panel/10 hover:bg-zc-panel/20",
                    )}
                    aria-pressed={activeTab === "charges"}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/60 bg-white/50 dark:border-white/10 dark:bg-black/10">
                          <Link2 className="h-4 w-4 text-rose-700 dark:text-rose-200" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zc-text">Charges</div>
                          <div className="text-xs text-zc-muted">Bind Charge Master</div>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {branchId ? (
          <>
            {activeTab === "items" ? <DiagnosticsItemsTab branchId={branchId} /> : null}
            {activeTab === "panels" ? <PanelBuilderTab branchId={branchId} /> : null}
            {activeTab === "lab" ? <LabParametersTab branchId={branchId} /> : null}
            {activeTab === "templates" ? <ImagingTemplatesTab branchId={branchId} /> : null}
            {activeTab === "charges" ? <ChargeMappingTab branchId={branchId} /> : null}
          </>
        ) : (
          <Card>
            <CardContent className="py-6">
              <div className="text-sm text-zc-muted">Select a branch to configure diagnostics.</div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

// ---- Tabs below ----

type TabProps = { branchId: string };

function DiagnosticsItemsTab({ branchId }: TabProps) {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [sections, setSections] = React.useState<SectionRow[]>([]);
  const [categories, setCategories] = React.useState<CategoryRow[]>([]);
  const [specimens, setSpecimens] = React.useState<SpecimenRow[]>([]);
  const [items, setItems] = React.useState<DiagnosticItemRow[]>([]);

  // filters
  const [kind, setKind] = React.useState<DiagnosticKind>("LAB");
  const [sectionId, setSectionId] = React.useState<string>("all");
  const [categoryId, setCategoryId] = React.useState<string>("all");
  const [panelFilter, setPanelFilter] = React.useState<"all" | "panel" | "test">("all");
  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [q, setQ] = React.useState("");

  // dialogs
  const [itemDialogOpen, setItemDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<DiagnosticItemRow | null>(null);

  const [sectionDialogOpen, setSectionDialogOpen] = React.useState(false);
  const [editingSection, setEditingSection] = React.useState<SectionRow | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<CategoryRow | null>(null);

  const [specimenDialogOpen, setSpecimenDialogOpen] = React.useState(false);
  const [editingSpecimen, setEditingSpecimen] = React.useState<SpecimenRow | null>(null);

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

  async function loadCatalog() {
    const sec = await apiFetch<SectionRow[]>(
      `/api/infrastructure/diagnostics/sections?${buildQS({ branchId, includeInactive: true })}`
    );
    setSections(Array.isArray(sec) ? sec : []);

    const cat = await apiFetch<CategoryRow[]>(
      `/api/infrastructure/diagnostics/categories?${buildQS({ branchId, includeInactive: true })}`
    );
    setCategories(Array.isArray(cat) ? cat : []);

    const sp = await apiFetch<SpecimenRow[]>(
      `/api/infrastructure/diagnostics/specimens?${buildQS({ branchId, includeInactive: true })}`
    );
    setSpecimens(Array.isArray(sp) ? sp : []);
  }

  async function loadItems(showToast = false) {
    setErr(null);
    setLoading(true);
    try {
      const isPanel = panelFilter === "all" ? undefined : panelFilter === "panel";
      const data = await apiFetch<DiagnosticItemRow[]>(
        `/api/infrastructure/diagnostics/items?${buildQS({
          branchId,
          kind,
          sectionId,
          categoryId,
          includeInactive,
          isPanel,
          q: q.trim() || undefined,
        })}`
      );
      setItems(Array.isArray(data) ? data : []);
      if (showToast) toast({ title: "Items refreshed", description: "Loaded latest items." });
    } catch (e: any) {
      const msg = e?.message || "Failed to load items";
      setErr(msg);
      setItems([]);
      if (showToast) toast({ title: "Refresh failed", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll(showToast = false) {
    setLoading(true);
    setErr(null);
    try {
      await loadCatalog();
      await loadItems(false);
      if (showToast) toast({ title: "Diagnostics refreshed", description: "Catalog and items are up to date." });
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
  }, [branchId]);

  React.useEffect(() => {
    void loadItems(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, sectionId, categoryId, panelFilter, includeInactive]);

  const sectionOptions = React.useMemo(() => {
    const list = (sections || []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    return list;
  }, [sections]);

  const categoryOptions = React.useMemo(() => {
    const base = (categories || []).filter((c) => !sectionId || sectionId === "all" || c.sectionId === sectionId);
    return base
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }, [categories, sectionId]);

  const specimenOptions = React.useMemo(() => {
    return (specimens || [])
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.code).localeCompare(String(b.code)));
  }, [specimens]);

  async function deactivateItem(row: DiagnosticItemRow) {
    try {
      await apiFetch(`/api/infrastructure/diagnostics/items/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      toast({ title: "Deactivated", description: `${row.code} is now inactive.` });
      await loadItems(false);
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.message || "Failed", variant: "destructive" as any });
    }
  }

  async function activateItem(row: DiagnosticItemRow) {
    try {
      await apiFetch(`/api/infrastructure/diagnostics/items/${encodeURIComponent(row.id)}`, {
        method: "PUT",
        body: JSON.stringify({ branchId, isActive: true }),
      });
      toast({ title: "Activated", description: `${row.code} is now active.` });
      await loadItems(false);
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.message || "Failed", variant: "destructive" as any });
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">Diagnostic Items</CardTitle>
              <CardDescription>Create, edit and deactivate diagnostic items. Includes validation aligned with backend rules.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void refreshAll(true)} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
              <Button
                variant={"success" as any}
                onClick={() => {
                  setEditingItem(null);
                  setItemDialogOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> New Item
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Kind</div>
              <Select value={kind} onValueChange={(v) => setKind(v as DiagnosticKind)}>
                <SelectTrigger className="mt-1 h-10">
                  <SelectValue placeholder="Kind" />
                </SelectTrigger>
                <SelectContent>
                  {DIAG_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Section</div>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger className="mt-1 h-10">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  {sectionOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-1 flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs text-zc-muted hover:text-zc-text"
                  onClick={() => {
                    setEditingSection(null);
                    setSectionDialogOpen(true);
                  }}
                >
                  + Add section
                </button>
                <button
                  type="button"
                  className="text-xs text-zc-muted hover:text-zc-text"
                  onClick={() => {
                    const s = sections.find((x) => x.id === sectionId);
                    if (!s) return;
                    setEditingSection(s);
                    setSectionDialogOpen(true);
                  }}
                  disabled={sectionId === "all"}
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Category</div>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="mt-1 h-10">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-1 flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs text-zc-muted hover:text-zc-text"
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryDialogOpen(true);
                  }}
                >
                  + Add category
                </button>
                <button
                  type="button"
                  className="text-xs text-zc-muted hover:text-zc-text"
                  onClick={() => {
                    const c = categories.find((x) => x.id === categoryId);
                    if (!c) return;
                    setEditingCategory(c);
                    setCategoryDialogOpen(true);
                  }}
                  disabled={categoryId === "all"}
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Type</div>
              <Select value={panelFilter} onValueChange={(v) => setPanelFilter(v as any)}>
                <SelectTrigger className="mt-1 h-10">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="panel">Panels</SelectItem>
                  <SelectItem value="test">Tests</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Search</div>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zc-muted" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Code or name"
                  className="h-10 pl-9"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={includeInactive} onCheckedChange={(v) => setIncludeInactive(Boolean(v))} />
              Include inactive
            </label>

            <Button variant="outline" onClick={() => void loadItems(true)} className="gap-2">
              <Activity className="h-4 w-4" /> Apply
            </Button>

            {err ? <span className="text-sm text-red-600">{err}</span> : null}
            {loading ? <span className="text-sm text-zc-muted">Loading…</span> : null}
          </div>

          <div className="rounded-xl border border-zc-border overflow-hidden">
            <div className="grid grid-cols-12 gap-2 bg-zc-panel/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zc-muted">
              <div className="col-span-3">Item</div>
              <div className="col-span-3">Classification</div>
              <div className="col-span-3">Notes</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {items.length === 0 ? (
              <div className="px-3 py-6 text-sm text-zc-muted">No items found for current filters.</div>
            ) : (
              <div className="divide-y divide-zc-border">
                {items.map((it) => (
                  <div key={it.id} className="grid grid-cols-12 gap-2 px-3 py-3">
                    <div className="col-span-3 min-w-0">
                      <div className="truncate text-sm font-semibold text-zc-text">
                        {it.name}
                        {it.isPanel ? <Badge className="ml-2" variant="secondary">Panel</Badge> : null}
                        {!it.isActive ? <Badge className="ml-2" variant="outline">Inactive</Badge> : null}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-zc-muted">{it.code}</div>
                    </div>

                    <div className="col-span-3 min-w-0">
                      <div className="truncate text-sm">{DIAG_KINDS.find((k) => k.value === it.kind)?.label ?? it.kind}</div>
                      <div className="mt-0.5 truncate text-xs text-zc-muted">
                        {it.section?.name || "—"}
                        {it.category?.name ? ` • ${it.category.name}` : ""}
                        {it.kind === "LAB" && it.specimen?.name ? ` • ${it.specimen.name}` : ""}
                      </div>
                    </div>

                    <div className="col-span-3 min-w-0">
                      <div className="truncate text-sm text-zc-muted">{it.preparationText ? "Prep: " + it.preparationText : "—"}</div>
                      <div className="mt-0.5 truncate text-xs text-zc-muted">
                        {it.consentRequired ? "Consent required" : ""}
                      </div>
                    </div>

                    <div className="col-span-3 flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          setEditingItem(it);
                          setItemDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>

                      {it.isActive ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                          onClick={() => void deactivateItem(it)}
                        >
                          <Trash2 className="h-4 w-4" /> Deactivate
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => void activateItem(it)}>
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        branchId={branchId}
        editing={editingItem}
        sections={sectionOptions}
        categories={categories}
        specimens={specimenOptions}
        onSaved={async () => {
          setItemDialogOpen(false);
          setEditingItem(null);
          await loadCatalog();
          await loadItems(false);
        }}
      />

      <SectionDialog
        open={sectionDialogOpen}
        onOpenChange={setSectionDialogOpen}
        branchId={branchId}
        editing={editingSection}
        onSaved={async () => {
          setSectionDialogOpen(false);
          setEditingSection(null);
          await loadCatalog();
          await loadItems(false);
        }}
      />

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        branchId={branchId}
        editing={editingCategory}
        sections={sectionOptions}
        onSaved={async () => {
          setCategoryDialogOpen(false);
          setEditingCategory(null);
          await loadCatalog();
          await loadItems(false);
        }}
      />

      <SpecimenDialog
        open={specimenDialogOpen}
        onOpenChange={setSpecimenDialogOpen}
        branchId={branchId}
        editing={editingSpecimen}
        onSaved={async () => {
          setSpecimenDialogOpen(false);
          setEditingSpecimen(null);
          await loadCatalog();
          await loadItems(false);
        }}
      />

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lab Specimens</CardTitle>
          <CardDescription>Used by LAB tests. Deactivation is blocked if specimen is used by any active item.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-zc-muted">{specimens.length} specimen types</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingSpecimen(null);
                  setSpecimenDialogOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Add specimen
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-zc-border overflow-hidden">
            <div className="grid grid-cols-12 gap-2 bg-zc-panel/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zc-muted">
              <div className="col-span-4">Specimen</div>
              <div className="col-span-5">Container / Notes</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>
            <div className="divide-y divide-zc-border">
              {specimens.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).map((s) => (
                <div key={s.id} className="grid grid-cols-12 gap-2 px-3 py-3">
                  <div className="col-span-4 min-w-0">
                    <div className="truncate text-sm font-semibold text-zc-text">
                      {s.name} {!s.isActive ? <Badge className="ml-2" variant="outline">Inactive</Badge> : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zc-muted">{s.code}</div>
                  </div>
                  <div className="col-span-5 min-w-0">
                    <div className="truncate text-sm text-zc-muted">
                      {(s.container ? `Container: ${s.container}` : "") + (s.minVolumeMl ? ` • Min: ${s.minVolumeMl} ml` : "")}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zc-muted">{s.handlingNotes || "—"}</div>
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingSpecimen(s);
                        setSpecimenDialogOpen(true);
                      }}
                      className="gap-2"
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    {s.isActive ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          try {
                            await apiFetch(`/api/infrastructure/diagnostics/specimens/${encodeURIComponent(s.id)}`, { method: "DELETE" });
                            toast({ title: "Deactivated", description: `${s.code} is now inactive.` });
                            await loadCatalog();
                          } catch (e: any) {
                            toast({ title: "Cannot deactivate", description: e?.message || "Failed", variant: "destructive" as any });
                          }
                        }}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          try {
                            await apiFetch(`/api/infrastructure/diagnostics/specimens/${encodeURIComponent(s.id)}`, {
                              method: "PUT",
                              body: JSON.stringify({ branchId, isActive: true }),
                            });
                            toast({ title: "Activated", description: `${s.code} is now active.` });
                            await loadCatalog();
                          } catch (e: any) {
                            toast({ title: "Action failed", description: e?.message || "Failed", variant: "destructive" as any });
                          }
                        }}
                      >
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PanelBuilderTab({ branchId }: TabProps) {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<DiagnosticKind>("LAB");
  const [panelQuery, setPanelQuery] = React.useState("");
  const [panels, setPanels] = React.useState<DiagnosticItemRow[]>([]);
  const [panelId, setPanelId] = React.useState<string>("");

  const selectedPanel = React.useMemo(() => panels.find((p) => p.id === panelId) || null, [panels, panelId]);

  const [serverPanelItems, setServerPanelItems] = React.useState<PanelItemRow[]>([]);
  const [draft, setDraft] = React.useState<Array<{ itemId: string; code: string; name: string }>>([]);

  const [candidateQuery, setCandidateQuery] = React.useState("");
  const [candidates, setCandidates] = React.useState<DiagnosticItemRow[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Record<string, boolean>>({});

  async function loadPanels() {
    setErr(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("branchId", branchId);
      qs.set("kind", kind);
      qs.set("isPanel", "true");
      if (panelQuery.trim()) qs.set("q", panelQuery.trim());
      const rows = await apiFetch<DiagnosticItemRow[]>(`/api/infrastructure/diagnostics/items?${qs.toString()}`);
      setPanels(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load panels");
      setPanels([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPanelItems(id: string) {
    if (!id) {
      setServerPanelItems([]);
      setDraft([]);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const rows = await apiFetch<PanelItemRow[]>(`/api/infrastructure/diagnostics/items/${encodeURIComponent(id)}/panel-items`);
      const list = Array.isArray(rows) ? rows : [];
      setServerPanelItems(list);
      const d = list
        .filter((x) => x?.itemId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((x) => ({ itemId: x.itemId, code: x.item?.code || "", name: x.item?.name || "" }));
      setDraft(d);
    } catch (e: any) {
      setErr(e?.message || "Failed to load panel items");
      setServerPanelItems([]);
      setDraft([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCandidates() {
    if (!selectedPanel) {
      setCandidates([]);
      return;
    }
    try {
      const qs = new URLSearchParams();
      qs.set("branchId", branchId);
      qs.set("kind", selectedPanel.kind);
      qs.set("isPanel", "false");
      if (candidateQuery.trim()) qs.set("q", candidateQuery.trim());
      const rows = await apiFetch<DiagnosticItemRow[]>(`/api/infrastructure/diagnostics/items?${qs.toString()}`);
      const list = (Array.isArray(rows) ? rows : []).filter((x) => !x.isPanel && x.isActive);
      setCandidates(list);
    } catch {
      setCandidates([]);
    }
  }

  React.useEffect(() => {
    void loadPanels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, kind]);

  React.useEffect(() => {
    const t = setTimeout(() => void loadPanels(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelQuery]);

  React.useEffect(() => {
    void loadPanelItems(panelId);
    setSelectedIds({});
    setCandidateQuery("");
    setCandidates([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelId]);

  React.useEffect(() => {
    const t = setTimeout(() => void loadCandidates(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateQuery, selectedPanel?.id]);

  function toggleCandidate(id: string) {
    setSelectedIds((p) => ({ ...p, [id]: !p[id] }));
  }

  function addSelected() {
    const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
    if (!ids.length) return;

    const existing = new Set(draft.map((d) => d.itemId));
    const toAdd = candidates.filter((c) => ids.includes(c.id) && !existing.has(c.id));

    setDraft((p) => [...p, ...toAdd.map((c) => ({ itemId: c.id, code: c.code, name: c.name }))]);
    setSelectedIds({});
    toast({ title: "Added", description: `${toAdd.length} item(s) added to draft.` });
  }

  function move(idx: number, dir: -1 | 1) {
    setDraft((p) => {
      const next = [...p];
      const j = idx + dir;
      if (idx < 0 || idx >= next.length) return p;
      if (j < 0 || j >= next.length) return p;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  function removeAt(idx: number) {
    setDraft((p) => p.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!selectedPanel?.id) {
      toast({ title: "Select a panel", description: "Choose a panel item to configure its contents.", variant: "destructive" as any });
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      await apiFetch(
        `/api/infrastructure/diagnostics/items/${encodeURIComponent(selectedPanel.id)}/panel-items`,
        {
          method: "PUT",
          body: JSON.stringify({
            items: draft.map((d, i) => ({ itemId: d.itemId, sortOrder: i })),
          }),
        },
      );
      toast({ title: "Saved", description: "Panel items updated." });
      await loadPanelItems(selectedPanel.id);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Panel Builder</CardTitle>
          <CardDescription>
            Search tests, multi-select, order them, and apply using <span className="font-mono">replacePanelItems</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zc-muted">Kind</div>
              <Select value={kind} onValueChange={(v) => setKind(v as DiagnosticKind)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Kind" />
                </SelectTrigger>
                <SelectContent>
                  {DIAG_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zc-muted">Panel</div>
              <div className="flex items-center gap-2">
                <Input
                  value={panelQuery}
                  onChange={(e) => setPanelQuery(e.target.value)}
                  placeholder="Search panels (code/name)…"
                  className="h-10"
                />
                <Button variant="outline" className="h-10" onClick={() => loadPanels()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <Select value={panelId} onValueChange={(v) => setPanelId(v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select a panel…" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px] overflow-y-auto">
                  {(panels || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-zc-muted">
                MVP rule enforced by backend: panels cannot contain other panels; panel items must match panel kind.
              </div>
            </div>

            <div className="flex items-end justify-end gap-2">
              <Button className="h-10" onClick={save} disabled={!selectedPanel || loading}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Apply
              </Button>
            </div>
          </div>

          {err ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
              {err}
            </div>
          ) : null}

          <Separator />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-zc-text">Candidate tests</div>
                  <div className="text-xs text-zc-muted">Search and multi-select. Click “Add to draft”.</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-zc-muted" />
                <Input
                  value={candidateQuery}
                  onChange={(e) => setCandidateQuery(e.target.value)}
                  placeholder={selectedPanel ? `Search ${selectedPanel.kind} tests…` : "Select a panel first"}
                  className="h-10"
                  disabled={!selectedPanel}
                />
                <Button variant="outline" className="h-10" onClick={addSelected} disabled={!selectedPanel}>
                  Add
                </Button>
              </div>

              <div className="mt-3 max-h-[360px] overflow-y-auto rounded-xl border bg-zc-panel/10">
                {(candidates || []).length ? (
                  <div className="divide-y divide-zc-border">
                    {candidates.map((c) => {
                      const checked = !!selectedIds[c.id];
                      return (
                        <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                          <Checkbox checked={checked} onCheckedChange={() => toggleCandidate(c.id)} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zc-text">{c.code} — {c.name}</div>
                            <div className="text-xs text-zc-muted">{c.isPanel ? "Panel" : "Test"} • {c.section?.name || "—"}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-sm text-zc-muted">No results.</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div>
                <div className="text-sm font-semibold text-zc-text">Draft panel items</div>
                <div className="text-xs text-zc-muted">Order with arrows, remove, then Apply.</div>
              </div>

              <div className="mt-3 max-h-[420px] overflow-y-auto rounded-xl border bg-zc-panel/10">
                {draft.length ? (
                  <div className="divide-y divide-zc-border">
                    {draft.map((d, idx) => (
                      <div key={d.itemId} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zc-text">{d.code} — {d.name}</div>
                          <div className="text-xs text-zc-muted">Sort: {idx}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" onClick={() => move(idx, -1)} disabled={idx === 0}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => move(idx, 1)}
                            disabled={idx === draft.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => removeAt(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-sm text-zc-muted">No items in draft.</div>
                )}
              </div>

              <div className="mt-3 text-xs text-zc-muted">
                Backend will reject: panel including itself, containing panels, or containing mismatched kinds.
              </div>

              {serverPanelItems.length ? (
                <div className="mt-3 text-xs text-zc-muted">
                  Loaded {serverPanelItems.length} active items from server.
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LabParametersTab({ branchId }: TabProps) {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [testQuery, setTestQuery] = React.useState("");
  const [tests, setTests] = React.useState<DiagnosticItemRow[]>([]);
  const [selectedTestId, setSelectedTestId] = React.useState<string>("");
  const selectedTest = React.useMemo(() => tests.find((t) => t.id === selectedTestId) || null, [tests, selectedTestId]);

  const [parameters, setParameters] = React.useState<ParameterRow[]>([]);

  const [paramModalOpen, setParamModalOpen] = React.useState(false);
  const [editingParam, setEditingParam] = React.useState<ParameterRow | null>(null);

  const [rangesModalOpen, setRangesModalOpen] = React.useState(false);
  const [rangesParam, setRangesParam] = React.useState<ParameterRow | null>(null);

  async function loadTests() {
    const qs = new URLSearchParams({
      branchId,
      kind: "LAB",
      isPanel: "false",
    });
    if (testQuery.trim()) qs.set("q", testQuery.trim());

    const rows = await apiFetch<DiagnosticItemRow[]>(`/api/infrastructure/diagnostics/items?${qs.toString()}`);
    setTests(rows || []);

    // keep selection if still exists
    if (selectedTestId) {
      const still = (rows || []).some((r) => r.id === selectedTestId);
      if (!still) {
        setSelectedTestId("");
        setParameters([]);
      }
    }
  }

  async function loadParameters(testId: string) {
    if (!testId) return;
    const rows = await apiFetch<ParameterRow[]>(`/api/infrastructure/diagnostics/items/${encodeURIComponent(testId)}/parameters`);
    setParameters(rows || []);
  }

  async function refresh(showToast = false) {
    setErr(null);
    setLoading(true);
    try {
      await loadTests();
      if (selectedTestId) await loadParameters(selectedTestId);
      if (showToast) toast({ title: "Refreshed", description: "Loaded latest lab parameters." });
    } catch (e: any) {
      const msg = e?.message || "Failed to load lab parameters";
      setErr(msg);
      if (showToast) toast({ title: "Refresh failed", description: msg, variant: "destructive" as any });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  React.useEffect(() => {
    const t = setTimeout(() => void loadTests(), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testQuery]);

  React.useEffect(() => {
    if (!selectedTestId) return;
    void loadParameters(selectedTestId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTestId]);

  return (
    <div className="mt-4 grid gap-4">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">Lab Parameters & Reference Ranges</CardTitle>
              <CardDescription>Configure lab result parameters and their normal ranges (full CRUD).</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void refresh(true)} disabled={loading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", loading ? "animate-spin" : "")} />
                Refresh
              </Button>
              <Button
                className="gap-2"
                onClick={() => {
                  if (!selectedTestId) {
                    toast({ title: "Select a test", description: "Choose a non-panel LAB item first.", variant: "destructive" as any });
                    return;
                  }
                  setEditingParam(null);
                  setParamModalOpen(true);
                }}
                disabled={!selectedTestId}
              >
                <Plus className="h-4 w-4" />
                New Parameter
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {err ? (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200">
              {err}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Choose test</div>
              <div className="mt-2 flex items-center gap-2">
                <Input value={testQuery} onChange={(e) => setTestQuery(e.target.value)} placeholder="Search lab tests…" />
                <Button variant="outline" onClick={() => void loadTests()} title="Search">
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-3 max-h-[320px] overflow-y-auto rounded-xl border border-zc-border bg-zc-panel/20">
                {(tests || []).length === 0 ? (
                  <div className="p-3 text-sm text-zc-muted">No matching tests.</div>
                ) : (
                  <div className="divide-y divide-zc-border">
                    {(tests || []).map((t) => {
                      const selected = t.id === selectedTestId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={cn(
                            "w-full text-left px-3 py-2 transition",
                            selected ? "bg-sky-50/70 dark:bg-sky-900/20" : "hover:bg-zc-panel/30",
                          )}
                          onClick={() => setSelectedTestId(t.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-zc-text">
                                {t.name}
                              </div>
                              <div className="truncate text-xs text-zc-muted font-mono">{t.code}</div>
                            </div>
                            <Badge variant="secondary">LAB</Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="rounded-xl border border-zc-border">
                <div className="flex items-center justify-between gap-3 border-b border-zc-border px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zc-text">Parameters</div>
                    <div className="text-xs text-zc-muted">
                      {selectedTest ? (
                        <span>
                          For <span className="font-mono">{selectedTest.code}</span> — {selectedTest.name}
                        </span>
                      ) : (
                        "Select a test to manage parameters."
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-zc-muted tabular-nums">{(parameters || []).length} total</div>
                </div>

                {!selectedTest ? (
                  <div className="p-4 text-sm text-zc-muted">Choose a non-panel lab test from the left list.</div>
                ) : (parameters || []).length === 0 ? (
                  <div className="p-4 text-sm text-zc-muted">No parameters added yet.</div>
                ) : (
                  <div className="divide-y divide-zc-border">
                    {(parameters || []).map((p) => (
                      <div key={p.id} className="p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-zc-text">
                                {p.name}
                              </div>
                              <Badge variant="secondary" className="font-mono">
                                {p.code}
                              </Badge>
                              <Badge className="border border-zc-border bg-zc-panel/20 text-zc-text" variant="secondary">
                                {p.dataType}
                              </Badge>
                              {p.unit ? (
                                <Badge variant="outline" className="font-mono">
                                  {p.unit}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-zc-muted">
                              Sort: <span className="font-mono">{p.sortOrder ?? 0}</span>
                              {p.dataType === "CHOICE" && p.allowedText ? (
                                <span className="ml-2">Choices: {p.allowedText}</span>
                              ) : null}
                            </div>

                            {(p.ranges || []).length ? (
                              <div className="mt-3 rounded-lg border border-zc-border bg-zc-panel/10 p-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Reference ranges</div>
                                <div className="mt-2 space-y-1">
                                  {(p.ranges || []).map((r) => (
                                    <div key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
                                      <Badge variant="outline">{r.sex || "Any"}</Badge>
                                      <span className="text-zc-muted">
                                        Age: {r.ageMinDays ?? "—"} to {r.ageMaxDays ?? "—"} days
                                      </span>
                                      <span className="text-zc-text">
                                        {r.low !== null && r.low !== undefined ? r.low : "—"} — {r.high !== null && r.high !== undefined ? r.high : "—"}
                                      </span>
                                      {r.textRange ? <span className="text-zc-muted">({r.textRange})</span> : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 text-xs text-zc-muted">No reference ranges defined.</div>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingParam(p);
                                setParamModalOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRangesParam(p);
                                setRangesModalOpen(true);
                              }}
                            >
                              <ClipboardList className="mr-2 h-4 w-4" />
                              Ranges
                            </Button>

                            {p.isActive ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await apiFetch(`/api/infrastructure/diagnostics/parameters/${encodeURIComponent(p.id)}`, { method: "DELETE" });
                                    toast({ title: "Deactivated", description: "Parameter deactivated." });
                                    await loadParameters(selectedTestId);
                                  } catch (e: any) {
                                    toast({ title: "Deactivate failed", description: e?.message || "Failed", variant: "destructive" as any });
                                  }
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Deactivate
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ParameterEditorModal
        open={paramModalOpen}
        onOpenChange={setParamModalOpen}
        testId={selectedTestId}
        initial={editingParam}
        onSaved={async () => {
          setEditingParam(null);
          setParamModalOpen(false);
          if (selectedTestId) await loadParameters(selectedTestId);
        }}
      />

      <ReferenceRangesModal
        open={rangesModalOpen}
        onOpenChange={setRangesModalOpen}
        parameter={rangesParam}
        onSaved={async () => {
          setRangesParam(null);
          setRangesModalOpen(false);
          if (selectedTestId) await loadParameters(selectedTestId);
        }}
      />
    </div>
  );
}

function ParameterEditorModal({
  open,
  onOpenChange,
  testId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  testId: string;
  initial: ParameterRow | null;
  onSaved: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const isEdit = !!initial?.id;

  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [dataType, setDataType] = React.useState<ResultDataType>("NUMERIC");
  const [unit, setUnit] = React.useState("");
  const [precision, setPrecision] = React.useState<string>("");
  const [allowedText, setAllowedText] = React.useState("");
  const [criticalLow, setCriticalLow] = React.useState<string>("");
  const [criticalHigh, setCriticalHigh] = React.useState<string>("");
  const [sortOrder, setSortOrder] = React.useState<string>("0");

  const [saving, setSaving] = React.useState(false);
  const [fieldErr, setFieldErr] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setFieldErr({});
    setCode(initial?.code ?? "");
    setName(initial?.name ?? "");
    setDataType(initial?.dataType ?? "NUMERIC");
    setUnit(initial?.unit ?? "");
    setPrecision(initial?.precision !== null && initial?.precision !== undefined ? String(initial.precision) : "");
    setAllowedText(initial?.allowedText ?? "");
    setCriticalLow(initial?.criticalLow !== null && initial?.criticalLow !== undefined ? String(initial.criticalLow) : "");
    setCriticalHigh(initial?.criticalHigh !== null && initial?.criticalHigh !== undefined ? String(initial.criticalHigh) : "");
    setSortOrder(String(initial?.sortOrder ?? 0));
  }, [open, initial]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    const e1 = validateCode(code, "Parameter");
    const e2 = validateName(name, "Parameter");
    if (e1) next.code = e1;
    if (e2) next.name = e2;
    if (dataType === "CHOICE" && isBlank(allowedText)) {
      next.allowedText = "allowedText is required for CHOICE dataType";
    }
    setFieldErr(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!testId && !isEdit) {
      toast({ title: "Select a test", description: "Choose a lab test first.", variant: "destructive" as any });
      return;
    }
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        code: normalizeCode(code),
        name: String(name).trim(),
        dataType,
        unit: unit.trim() || undefined,
        precision: toInt(precision),
        allowedText: allowedText.trim() || undefined,
        criticalLow: toFloat(criticalLow),
        criticalHigh: toFloat(criticalHigh),
        sortOrder: toInt(sortOrder) ?? 0,
      };

      if (isEdit && initial?.id) {
        await apiFetch(`/api/infrastructure/diagnostics/parameters/${encodeURIComponent(initial.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "Saved", description: "Parameter updated." });
      } else {
        await apiFetch(`/api/infrastructure/diagnostics/items/${encodeURIComponent(testId)}/parameters`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "Created", description: "Parameter created." });
      }

      await onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Parameter" : "New Parameter"}</DialogTitle>
          <DialogDescription>
            Validation rules match the backend service (code format, name, CHOICE requires allowedText).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Code" error={fieldErr.code}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="HB" className="font-mono" />
          </Field>
          <Field label="Name" error={fieldErr.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hemoglobin" />
          </Field>

          <Field label="Data Type">
            <Select value={dataType} onValueChange={(v) => setDataType(v as ResultDataType)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Data type" />
              </SelectTrigger>
              <SelectContent>
                {RESULT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Unit (optional)">
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g/dL" className="font-mono" />
          </Field>

          <Field label="Precision (optional)">
            <Input value={precision} onChange={(e) => setPrecision(e.target.value)} placeholder="2" inputMode="numeric" />
          </Field>

          <Field label="Sort Order">
            <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="0" inputMode="numeric" />
          </Field>

          <Field label="Critical Low (optional)">
            <Input value={criticalLow} onChange={(e) => setCriticalLow(e.target.value)} placeholder="" inputMode="decimal" />
          </Field>
          <Field label="Critical High (optional)">
            <Input value={criticalHigh} onChange={(e) => setCriticalHigh(e.target.value)} placeholder="" inputMode="decimal" />
          </Field>

          <div className="md:col-span-2">
            <Field label="Allowed Text (CHOICE only)" error={fieldErr.allowedText}>
              <Textarea
                value={allowedText}
                onChange={(e) => setAllowedText(e.target.value)}
                placeholder="e.g., Positive | Negative | Borderline"
                className="min-h-[90px]"
              />
            </Field>
            <div className="mt-1 text-xs text-zc-muted">
              Backend rule: required when dataType = CHOICE.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Parameter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReferenceRangesModal({
  open,
  onOpenChange,
  parameter,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parameter: ParameterRow | null;
  onSaved: () => void | Promise<void>;
}) {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(false);
  const [ranges, setRanges] = React.useState<RangeRow[]>([]);
  const [editing, setEditing] = React.useState<RangeRow | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);

  async function load() {
    if (!parameter?.id) return;
    setLoading(true);
    try {
      const rows = await apiFetch<RangeRow[]>(`/api/infrastructure/diagnostics/parameters/${encodeURIComponent(parameter.id)}/ranges`);
      setRanges(rows || []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parameter?.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Reference Ranges</DialogTitle>
          <DialogDescription>
            {parameter ? (
              <span>
                For <span className="font-mono">{parameter.code}</span> — {parameter.name}
              </span>
            ) : (
              "Select a parameter."
            )}
          </DialogDescription>
        </DialogHeader>

        {!parameter ? (
          <div className="text-sm text-zc-muted">No parameter selected.</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-zc-muted">Backend rule: ageMinDays and ageMaxDays must be ≥ 0, and ageMinDays ≤ ageMaxDays.</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", loading ? "animate-spin" : "")} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setEditorOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Range
                </Button>
              </div>
            </div>

            <div className="mt-3 max-h-[360px] overflow-y-auto rounded-xl border border-zc-border">
              {(ranges || []).length === 0 ? (
                <div className="p-4 text-sm text-zc-muted">No ranges defined.</div>
              ) : (
                <div className="divide-y divide-zc-border">
                  {(ranges || []).map((r) => (
                    <div key={r.id} className="p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">Sex: {r.sex || "Any"}</Badge>
                            <Badge variant="outline">Age: {r.ageMinDays ?? "—"}–{r.ageMaxDays ?? "—"} days</Badge>
                            <Badge className="border border-zc-border bg-zc-panel/20 text-zc-text" variant="secondary">
                              {r.low !== null && r.low !== undefined ? r.low : "—"} — {r.high !== null && r.high !== undefined ? r.high : "—"}
                            </Badge>
                            {r.textRange ? <span className="text-xs text-zc-muted">({r.textRange})</span> : null}
                          </div>
                          <div className="mt-1 text-xs text-zc-muted">Sort: <span className="font-mono">{r.sortOrder ?? 0}</span></div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditing(r);
                              setEditorOpen(true);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={async () => {
                              try {
                                await apiFetch(`/api/infrastructure/diagnostics/ranges/${encodeURIComponent(r.id)}`, { method: "DELETE" });
                                toast({ title: "Deactivated", description: "Range deactivated." });
                                await load();
                              } catch (e: any) {
                                toast({ title: "Delete failed", description: e?.message || "Failed", variant: "destructive" as any });
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Deactivate
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <RangeEditorModal
              open={editorOpen}
              onOpenChange={setEditorOpen}
              parameterId={parameter.id}
              initial={editing}
              onSaved={async () => {
                setEditing(null);
                setEditorOpen(false);
                await load();
                await onSaved();
              }}
            />
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RangeEditorModal({
  open,
  onOpenChange,
  parameterId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parameterId: string;
  initial: RangeRow | null;
  onSaved: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const isEdit = !!initial?.id;

  const [sex, setSex] = React.useState("");
  const [ageMinDays, setAgeMinDays] = React.useState<string>("");
  const [ageMaxDays, setAgeMaxDays] = React.useState<string>("");
  const [low, setLow] = React.useState<string>("");
  const [high, setHigh] = React.useState<string>("");
  const [textRange, setTextRange] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<string>("0");

  const [saving, setSaving] = React.useState(false);
  const [fieldErr, setFieldErr] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setFieldErr({});
    setSex(initial?.sex ?? "");
    setAgeMinDays(initial?.ageMinDays !== null && initial?.ageMinDays !== undefined ? String(initial.ageMinDays) : "");
    setAgeMaxDays(initial?.ageMaxDays !== null && initial?.ageMaxDays !== undefined ? String(initial.ageMaxDays) : "");
    setLow(initial?.low !== null && initial?.low !== undefined ? String(initial.low) : "");
    setHigh(initial?.high !== null && initial?.high !== undefined ? String(initial.high) : "");
    setTextRange(initial?.textRange ?? "");
    setSortOrder(String(initial?.sortOrder ?? 0));
  }, [open, initial]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    const minN = toInt(ageMinDays);
    const maxN = toInt(ageMaxDays);
    if (minN !== null && minN < 0) next.ageMinDays = "ageMinDays must be >= 0";
    if (maxN !== null && maxN < 0) next.ageMaxDays = "ageMaxDays must be >= 0";
    if (minN !== null && maxN !== null && minN > maxN) next.ageMaxDays = "ageMaxDays must be >= ageMinDays";
    setFieldErr(next);
    return Object.keys(next).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        sex: sex.trim() || null,
        ageMinDays: toInt(ageMinDays),
        ageMaxDays: toInt(ageMaxDays),
        low: toFloat(low),
        high: toFloat(high),
        textRange: textRange.trim() || null,
        sortOrder: toInt(sortOrder) ?? 0,
      };

      if (isEdit && initial?.id) {
        await apiFetch(`/api/infrastructure/diagnostics/ranges/${encodeURIComponent(initial.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "Saved", description: "Range updated." });
      } else {
        await apiFetch(`/api/infrastructure/diagnostics/parameters/${encodeURIComponent(parameterId)}/ranges`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "Created", description: "Range created." });
      }

      await onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Range" : "New Range"}</DialogTitle>
          <DialogDescription>Age rules are enforced as in the backend service.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Sex (optional)">
            <Input value={sex} onChange={(e) => setSex(e.target.value)} placeholder="M / F / Any" />
          </Field>
          <Field label="Sort Order">
            <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputMode="numeric" />
          </Field>

          <Field label="Age Min (days)" error={fieldErr.ageMinDays}>
            <Input value={ageMinDays} onChange={(e) => setAgeMinDays(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Age Max (days)" error={fieldErr.ageMaxDays}>
            <Input value={ageMaxDays} onChange={(e) => setAgeMaxDays(e.target.value)} inputMode="numeric" />
          </Field>

          <Field label="Low (optional)">
            <Input value={low} onChange={(e) => setLow(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="High (optional)">
            <Input value={high} onChange={(e) => setHigh(e.target.value)} inputMode="decimal" />
          </Field>

          <div className="md:col-span-2">
            <Field label="Text Range (optional)">
              <Textarea value={textRange} onChange={(e) => setTextRange(e.target.value)} className="min-h-[80px]" />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Range"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Shared UI helpers ----------------

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-end justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">
          {label}
          {required ? <span className="ml-1 text-rose-600">*</span> : null}
        </div>
        {hint ? <div className="text-xs text-zc-muted">{hint}</div> : null}
      </div>
      {children}
      {error ? (
        <div className="text-xs text-rose-700 dark:text-rose-200">{error}</div>
      ) : null}
    </div>
  );
}

// ---------------- Catalog dialogs (Sections/Categories/Specimens/Items) ----------------

type DialogBaseProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  onSaved: () => void;
};

function SectionDialog({
  open,
  onOpenChange,
  branchId,
  editing,
  onSaved,
}: DialogBaseProps & { editing: SectionRow | null }) {
  const { toast } = useToast();

  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<string>("0");
  const [busy, setBusy] = React.useState(false);

  const [errCode, setErrCode] = React.useState<string | null>(null);
  const [errName, setErrName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setCode(editing?.code || "");
    setName(editing?.name || "");
    setSortOrder(String(editing?.sortOrder ?? 0));
    setErrCode(null);
    setErrName(null);
    setBusy(false);
  }, [open, editing]);

  function validate() {
    const c = validateCode(code, "Section");
    const n = validateName(name, "Section");
    setErrCode(c);
    setErrName(n);
    return !(c || n);
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    try {
      const payload: any = {
        branchId,
        code: normalizeCode(code),
        name: String(name).trim(),
        sortOrder: toInt(sortOrder) ?? 0,
      };

      if (editing?.id) {
        await apiFetch(`/api/infrastructure/diagnostics/sections/${encodeURIComponent(editing.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "Updated", description: "Section updated." });
      } else {
        await apiFetch(`/api/infrastructure/diagnostics/sections`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "Created", description: "Section created." });
      }
      onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!editing?.id) return;
    setBusy(true);
    try {
      await apiFetch(`/api/infrastructure/diagnostics/sections/${encodeURIComponent(editing.id)}`, { method: "DELETE" });
      toast({ title: "Deactivated", description: "Section marked inactive." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Cannot deactivate", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!editing?.id) return;
    setBusy(true);
    try {
      await apiFetch(`/api/infrastructure/diagnostics/sections/${encodeURIComponent(editing.id)}`, {
        method: "PUT",
        body: JSON.stringify({ branchId, isActive: true }),
      });
      toast({ title: "Activated", description: "Section is now active." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Section" : "Create Section"}</DialogTitle>
          <DialogDescription>Code must be unique per branch. Use uppercase; hyphen allowed.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Code" required error={errCode}>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., LAB" className="h-10" />
            </Field>
            <Field label="Sort order" hint="Lower comes first">
              <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="h-10" />
            </Field>
          </div>

          <Field label="Name" required error={errName}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Pathology" className="h-10" />
          </Field>
        </div>

        <DialogFooter className="gap-2">
          {editing?.id ? (
            editing.isActive ? (
              <Button variant="destructive" onClick={deactivate} disabled={busy}>
                Deactivate
              </Button>
            ) : (
              <Button variant="secondary" onClick={activate} disabled={busy}>
                Activate
              </Button>
            )
          ) : null}

          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  branchId,
  editing,
  sections,
  onSaved,
}: DialogBaseProps & { editing: CategoryRow | null; sections: Array<{ id: string; code: string; name: string }> }) {
  const { toast } = useToast();

  const [sectionId, setSectionId] = React.useState<string>("");
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<string>("0");
  const [busy, setBusy] = React.useState(false);

  const [errSection, setErrSection] = React.useState<string | null>(null);
  const [errCode, setErrCode] = React.useState<string | null>(null);
  const [errName, setErrName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSectionId(editing?.sectionId || (sections?.[0]?.id ?? ""));
    setCode(editing?.code || "");
    setName(editing?.name || "");
    setSortOrder(String(editing?.sortOrder ?? 0));
    setErrSection(null);
    setErrCode(null);
    setErrName(null);
    setBusy(false);
  }, [open, editing, sections]);

  function validate() {
    const es = !sectionId ? "Section is required" : null;
    const ec = validateCode(code, "Category");
    const en = validateName(name, "Category");
    setErrSection(es);
    setErrCode(ec);
    setErrName(en);
    return !(es || ec || en);
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    try {
      const payload: any = {
        branchId,
        sectionId,
        code: normalizeCode(code),
        name: String(name).trim(),
        sortOrder: toInt(sortOrder) ?? 0,
      };

      if (editing?.id) {
        await apiFetch(`/api/infrastructure/diagnostics/categories/${encodeURIComponent(editing.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "Updated", description: "Category updated." });
      } else {
        await apiFetch(`/api/infrastructure/diagnostics/categories`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "Created", description: "Category created." });
      }
      onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!editing?.id) return;
    setBusy(true);
    try {
      await apiFetch(`/api/infrastructure/diagnostics/categories/${encodeURIComponent(editing.id)}`, { method: "DELETE" });
      toast({ title: "Deactivated", description: "Category marked inactive." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Cannot deactivate", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!editing?.id) return;
    setBusy(true);
    try {
      await apiFetch(`/api/infrastructure/diagnostics/categories/${encodeURIComponent(editing.id)}`, {
        method: "PUT",
        body: JSON.stringify({ branchId, isActive: true }),
      });
      toast({ title: "Activated", description: "Category is now active." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Category" : "Create Category"}</DialogTitle>
          <DialogDescription>Category must belong to an active section in this branch.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Section" required error={errSection}>
            <Select value={sectionId} onValueChange={(v) => setSectionId(v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px] overflow-y-auto">
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Code" required error={errCode}>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., BIO" className="h-10" />
            </Field>
            <Field label="Sort order" hint="Lower comes first">
              <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="h-10" />
            </Field>
          </div>

          <Field label="Name" required error={errName}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Biochemistry" className="h-10" />
          </Field>
        </div>

        <DialogFooter className="gap-2">
          {editing?.id ? (
            editing.isActive ? (
              <Button variant="destructive" onClick={deactivate} disabled={busy}>
                Deactivate
              </Button>
            ) : (
              <Button variant="secondary" onClick={activate} disabled={busy}>
                Activate
              </Button>
            )
          ) : null}

          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SpecimenDialog({
  open,
  onOpenChange,
  branchId,
  editing,
  onSaved,
}: DialogBaseProps & { editing: SpecimenRow | null }) {
  const { toast } = useToast();

  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [container, setContainer] = React.useState("");
  const [minVolumeMl, setMinVolumeMl] = React.useState<string>("");
  const [handlingNotes, setHandlingNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const [errCode, setErrCode] = React.useState<string | null>(null);
  const [errName, setErrName] = React.useState<string | null>(null);
  const [errMl, setErrMl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setCode(editing?.code || "");
    setName(editing?.name || "");
    setContainer(String(editing?.container ?? ""));
    setMinVolumeMl(editing?.minVolumeMl != null ? String(editing.minVolumeMl) : "");
    setHandlingNotes(String(editing?.handlingNotes ?? ""));
    setErrCode(null);
    setErrName(null);
    setErrMl(null);
    setBusy(false);
  }, [open, editing]);

  function validate() {
    const ec = validateCode(code, "Specimen");
    const en = validateName(name, "Specimen");
    const ml = toFloat(minVolumeMl);
    const eml = minVolumeMl.trim() && (ml === null || ml < 0) ? "Min volume must be a positive number" : null;
    setErrCode(ec);
    setErrName(en);
    setErrMl(eml);
    return !(ec || en || eml);
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    try {
      const payload: any = {
        branchId,
        code: normalizeCode(code),
        name: String(name).trim(),
        container: String(container).trim() || undefined,
        minVolumeMl: minVolumeMl.trim() ? String(minVolumeMl).trim() : undefined,
        handlingNotes: String(handlingNotes).trim() || undefined,
      };

      if (editing?.id) {
        await apiFetch(`/api/infrastructure/diagnostics/specimens/${encodeURIComponent(editing.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "Updated", description: "Specimen updated." });
      } else {
        await apiFetch(`/api/infrastructure/diagnostics/specimens`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "Created", description: "Specimen created." });
      }
      onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!editing?.id) return;
    setBusy(true);
    try {
      await apiFetch(`/api/infrastructure/diagnostics/specimens/${encodeURIComponent(editing.id)}`, { method: "DELETE" });
      toast({ title: "Deactivated", description: "Specimen marked inactive." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Cannot deactivate", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!editing?.id) return;
    setBusy(true);
    try {
      await apiFetch(`/api/infrastructure/diagnostics/specimens/${encodeURIComponent(editing.id)}`, {
        method: "PUT",
        body: JSON.stringify({ branchId, isActive: true }),
      });
      toast({ title: "Activated", description: "Specimen is now active." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Specimen" : "Create Specimen"}</DialogTitle>
          <DialogDescription>Specimens are used only for LAB items. Deactivation is blocked if used by active items.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Code" required error={errCode}>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., SERUM" className="h-10" />
            </Field>
            <Field label="Name" required error={errName}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Serum" className="h-10" />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Container">
              <Input value={container} onChange={(e) => setContainer(e.target.value)} placeholder="e.g., Red top" className="h-10" />
            </Field>
            <Field label="Min volume (ml)" error={errMl}>
              <Input value={minVolumeMl} onChange={(e) => setMinVolumeMl(e.target.value)} placeholder="e.g., 2" className="h-10" />
            </Field>
          </div>

          <Field label="Handling notes">
            <Textarea
              value={handlingNotes}
              onChange={(e) => setHandlingNotes(e.target.value)}
              placeholder="e.g., Keep chilled, deliver within 30 min"
              className="min-h-[90px]"
            />
          </Field>
        </div>

        <DialogFooter className="gap-2">
          {editing?.id ? (
            editing.isActive ? (
              <Button variant="destructive" onClick={deactivate} disabled={busy}>
                Deactivate
              </Button>
            ) : (
              <Button variant="secondary" onClick={activate} disabled={busy}>
                Activate
              </Button>
            )
          ) : null}

          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemDialog({
  open,
  onOpenChange,
  branchId,
  editing,
  sections,
  categories,
  specimens,
  onSaved,
}: DialogBaseProps & {
  editing: DiagnosticItemRow | null;
  sections: Array<{ id: string; code: string; name: string; isActive?: boolean }>;
  categories: CategoryRow[];
  specimens: Array<{ id: string; code: string; name: string; isActive?: boolean }>;
}) {
  const { toast } = useToast();

  const isEdit = !!editing?.id;

  const [kind, setKind] = React.useState<DiagnosticKind>("LAB");
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [sectionId, setSectionId] = React.useState<string>("");
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [isPanel, setIsPanel] = React.useState(false);
  const [specimenId, setSpecimenId] = React.useState<string>("");
  const [preparationText, setPreparationText] = React.useState("");
  const [consentRequired, setConsentRequired] = React.useState(false);
  const [appointmentRequired, setAppointmentRequired] = React.useState(false);
  const [sortOrder, setSortOrder] = React.useState<string>("0");

  const [busy, setBusy] = React.useState(false);

  const [errCode, setErrCode] = React.useState<string | null>(null);
  const [errName, setErrName] = React.useState<string | null>(null);
  const [errSection, setErrSection] = React.useState<string | null>(null);
  const [errSpecimen, setErrSpecimen] = React.useState<string | null>(null);

  const filteredCategories = React.useMemo(() => {
    const list = safeArray(categories)
      .filter((c) => c.sectionId === sectionId)
      .filter((c) => c.isActive);
    return list;
  }, [categories, sectionId]);

  React.useEffect(() => {
    if (!open) return;
    setKind(editing?.kind || "LAB");
    setCode(editing?.code || "");
    setName(editing?.name || "");
    setSectionId(editing?.sectionId || (sections?.[0]?.id ?? ""));
    setCategoryId(editing?.categoryId || "");
    setIsPanel(!!editing?.isPanel);
    setSpecimenId(editing?.specimenId || "");
    setPreparationText(String(editing?.preparationText ?? ""));
    setConsentRequired(!!editing?.consentRequired);
    setAppointmentRequired(!!editing?.appointmentRequired);
    setSortOrder(String(editing?.sortOrder ?? 0));

    setErrCode(null);
    setErrName(null);
    setErrSection(null);
    setErrSpecimen(null);
    setBusy(false);
  }, [open, editing, sections]);

  // enforce service rules in UI
  React.useEffect(() => {
    if (kind !== "LAB") {
      setSpecimenId("");
    }
  }, [kind]);

  React.useEffect(() => {
    if (kind === "LAB" && isPanel) {
      setSpecimenId("");
    }
  }, [kind, isPanel]);

  function validate() {
    const ec = validateCode(code, "Item");
    const en = validateName(name, "Item");
    const es = !sectionId ? "Section is required" : null;

    // backend rule: specimen only for LAB, and not for LAB panels
    const eSp = kind === "LAB" && !isPanel && specimenId && !specimens.some((s) => s.id === specimenId)
      ? "Invalid specimen"
      : null;

    setErrCode(ec);
    setErrName(en);
    setErrSection(es);
    setErrSpecimen(eSp);

    return !(ec || en || es || eSp);
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);

    try {
      if (!isEdit) {
        // create payload: send full object
        const payload: any = {
          branchId,
          code: normalizeCode(code),
          name: String(name).trim(),
          kind,
          sectionId,
          categoryId: categoryId || undefined,
          isPanel,
          specimenId: kind === "LAB" && !isPanel ? (specimenId || undefined) : undefined,
          preparationText: preparationText.trim() || undefined,
          consentRequired,
          appointmentRequired,
          sortOrder: toInt(sortOrder) ?? 0,
        };

        await apiFetch(`/api/infrastructure/diagnostics/items`, { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "Created", description: "Diagnostic item created." });
        onSaved();
        return;
      }

      // update payload: send diffs to avoid breaking on inactive legacy references
      const payload: any = { branchId };

      const nextCode = normalizeCode(code);
      if (nextCode && nextCode !== editing!.code) payload.code = nextCode;
      const nextName = String(name).trim();
      if (nextName && nextName !== editing!.name) payload.name = nextName;

      if (sectionId && sectionId !== editing!.sectionId) payload.sectionId = sectionId;

      // categoryId: only if changed (including clearing)
      const curCat = editing!.categoryId || "";
      if ((categoryId || "") !== curCat) payload.categoryId = categoryId || null;

      // isPanel can be changed
      if (!!isPanel !== !!editing!.isPanel) payload.isPanel = isPanel;

      // specimen: only valid for LAB non-panel; send only if changed
      const desiredSpec = kind === "LAB" && !isPanel ? (specimenId || "") : "";
      const curSpec = editing!.specimenId || "";
      if (desiredSpec !== curSpec) payload.specimenId = desiredSpec ? desiredSpec : null;

      const nextPrep = preparationText.trim();
      const curPrep = String(editing!.preparationText ?? "").trim();
      if (nextPrep !== curPrep) payload.preparationText = nextPrep || null;

      if (!!consentRequired !== !!editing!.consentRequired) payload.consentRequired = consentRequired;
      if (!!appointmentRequired !== !!editing!.appointmentRequired) payload.appointmentRequired = appointmentRequired;

      const nextSort = toInt(sortOrder) ?? 0;
      if (nextSort !== (editing!.sortOrder ?? 0)) payload.sortOrder = nextSort;

      await apiFetch(`/api/infrastructure/diagnostics/items/${encodeURIComponent(editing!.id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      toast({ title: "Saved", description: "Item updated." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit Item: ${editing.code}` : "Create Diagnostic Item"}</DialogTitle>
          <DialogDescription>
            Validations match backend rules: code format, section/category ownership, specimen for LAB only, and no specimen on LAB panels.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Kind" required hint={isEdit ? "Kind cannot be changed" : undefined}>
              <Select value={kind} onValueChange={(v) => setKind(v as DiagnosticKind)} disabled={isEdit}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Kind" />
                </SelectTrigger>
                <SelectContent>
                  {DIAG_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Code" required error={errCode}>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., CBC" className="h-10" />
            </Field>

            <Field label="Sort order" hint="Lower comes first">
              <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="h-10" />
            </Field>
          </div>

          <Field label="Name" required error={errName}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Complete Blood Count" className="h-10" />
          </Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Section" required error={errSection}>
              <Select value={sectionId} onValueChange={(v) => setSectionId(v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px] overflow-y-auto">
                  {sections.filter((s) => s.isActive !== false).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Category" hint="Optional">
              <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px] overflow-y-auto">
                  <SelectItem value="none">None</SelectItem>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Specimen" hint={kind !== "LAB" ? "Only for LAB items" : isPanel ? "Disabled for LAB panels" : "Optional"} error={errSpecimen}>
              <Select
                value={specimenId || "none"}
                onValueChange={(v) => setSpecimenId(v === "none" ? "" : v)}
                disabled={kind !== "LAB" || isPanel}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px] overflow-y-auto">
                  <SelectItem value="none">None</SelectItem>
                  {specimens.filter((s) => s.isActive !== false).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isPanel} onCheckedChange={(v) => setIsPanel(Boolean(v))} />
              Panel item
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={consentRequired} onCheckedChange={(v) => setConsentRequired(Boolean(v))} />
              Consent required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={appointmentRequired} onCheckedChange={(v) => setAppointmentRequired(Boolean(v))} />
              Appointment required
            </label>
          </div>

          <Field label="Preparation / notes" hint="Optional; stored as preparationText">
            <Textarea
              value={preparationText}
              onChange={(e) => setPreparationText(e.target.value)}
              placeholder="e.g., Fast 8 hours, avoid tea/coffee"
              className="min-h-[90px]"
            />
          </Field>

          <div className={cn("rounded-xl border p-3 text-xs", toneByKind(kind))}>
            <div className="font-semibold">Backend rules enforced</div>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Code format and uniqueness per branch</li>
              <li>Section & category must belong to the same branch and be active</li>
              <li>Specimen can be used only for LAB items</li>
              <li>LAB panels cannot have a specimenId (set specimen at child tests)</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Imaging Templates ----------------

function ImagingTemplatesTab({ branchId }: TabProps) {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState<DiagnosticItemRow[]>([]);
  const [itemId, setItemId] = React.useState<string>("");

  const selectedItem = React.useMemo(() => items.find((i) => i.id === itemId) || null, [items, itemId]);

  const [templates, setTemplates] = React.useState<TemplateRow[]>([]);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<TemplateRow | null>(null);

  async function loadItems() {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      qs.set("branchId", branchId);
      qs.set("kind", "IMAGING");
      if (q.trim()) qs.set("q", q.trim());
      const list = await apiFetch<DiagnosticItemRow[]>(`/api/infrastructure/diagnostics/items?${qs.toString()}`);
      setItems(safeArray(list));
      if (!itemId && safeArray(list)[0]?.id) setItemId(safeArray(list)[0].id);
    } catch (e: any) {
      setErr(e?.message || "Failed to load imaging items");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates(id: string) {
    if (!id) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const rows = await apiFetch<TemplateRow[]>(`/api/infrastructure/diagnostics/items/${encodeURIComponent(id)}/templates`);
      setTemplates(safeArray(rows));
    } catch (e: any) {
      setErr(e?.message || "Failed to load templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  React.useEffect(() => {
    const t = setTimeout(() => void loadItems(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  React.useEffect(() => {
    void loadTemplates(itemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function deactivateTemplate(tpl: TemplateRow) {
    try {
      await apiFetch(`/api/infrastructure/diagnostics/templates/${encodeURIComponent(tpl.id)}`, { method: "DELETE" });
      toast({ title: "Deactivated", description: "Template marked inactive." });
      await loadTemplates(itemId);
    } catch (e: any) {
      toast({ title: "Cannot deactivate", description: e?.message || "Failed", variant: "destructive" as any });
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Imaging Templates</CardTitle>
          <CardDescription>CRUD templates per imaging item. Use textarea for body with quick preview.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Imaging item</div>
              <Select value={itemId} onValueChange={(v) => setItemId(v)}>
                <SelectTrigger className="mt-1 h-10">
                  <SelectValue placeholder="Select imaging item" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px] overflow-y-auto">
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {itemLabel(i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 text-xs text-zc-muted">Search by code/name to find the item faster.</div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Search</div>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zc-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code or name" className="h-10 pl-9" />
              </div>
            </div>
          </div>

          {err ? (
            <div className="rounded-xl border border-rose-200/70 bg-rose-50/70 p-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200">
              {err}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-zc-muted">
              {selectedItem ? (
                <span>
                  Selected: <span className="font-semibold text-zc-text">{selectedItem.code}</span>
                  <span className="text-zc-muted"> — {selectedItem.name}</span>
                </span>
              ) : (
                "Select an imaging item"
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingTemplate(null);
                  setEditorOpen(true);
                }}
                disabled={!selectedItem}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
              <Button variant="outline" onClick={() => loadTemplates(itemId)} disabled={!selectedItem || loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border p-3">
              <div className="text-sm font-semibold text-zc-text">Templates</div>
              <div className="mt-2 max-h-[420px] overflow-y-auto rounded-xl border bg-zc-panel/10">
                {templates.length ? (
                  <div className="divide-y divide-zc-border">
                    {templates.map((tpl) => (
                      <div key={tpl.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zc-text">{tpl.name}</div>
                            <div className="mt-1 text-xs text-zc-muted">
                              Kind: <span className="font-mono">{tpl.kind}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingTemplate(tpl);
                                setEditorOpen(true);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deactivateTemplate(tpl)}>
                              Deactivate
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 rounded-lg border bg-white/60 p-2 text-xs text-zc-muted dark:bg-black/10">
                          <div className="font-semibold text-zc-text/80">Preview</div>
                          <pre className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap break-words">{tpl.body}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-sm text-zc-muted">No templates for this item.</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="text-sm font-semibold text-zc-text">Usage notes</div>

              <div className="mt-2 space-y-2 text-sm text-zc-muted">
                <p>
                  Template body is stored as plain text. Keep placeholders consistent across reports (e.g.,{" "}
                  <span className="font-mono">{"{{FINDINGS}}"}</span>).
                </p>
                <p>
                  Deactivation is a soft-delete (<span className="font-mono">isActive=false</span>). Only active templates are
                  returned by the list endpoint.
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                If you need versioning per template, we can extend this to keep history + effective dates.
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      <TemplateEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        item={selectedItem}
        editing={editingTemplate}
        onSaved={async () => {
          setEditorOpen(false);
          setEditingTemplate(null);
          await loadTemplates(itemId);
        }}
      />
    </div>
  );
}

function TemplateEditorModal({
  open,
  onOpenChange,
  item,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: DiagnosticItemRow | null;
  editing: TemplateRow | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const [kind, setKind] = React.useState<TemplateKind>("IMAGING_REPORT");
  const [name, setName] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const [errName, setErrName] = React.useState<string | null>(null);
  const [errBody, setErrBody] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setKind(editing?.kind || "IMAGING_REPORT");
    setName(editing?.name || "");
    setBody(editing?.body || "");
    setErrName(null);
    setErrBody(null);
    setBusy(false);
  }, [open, editing]);

  function validate() {
    const en = validateName(name, "Template");
    const eb = isBlank(body) ? "Template body is required" : null;
    setErrName(en);
    setErrBody(eb);
    return !(en || eb);
  }

  async function save() {
    if (!item?.id) {
      toast({ title: "Select item", description: "Choose an imaging item first.", variant: "destructive" as any });
      return;
    }
    if (!validate()) return;
    setBusy(true);
    try {
      const payload: any = {
        kind,
        name: String(name).trim(),
        body: String(body),
      };

      if (editing?.id) {
        await apiFetch(`/api/infrastructure/diagnostics/templates/${encodeURIComponent(editing.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "Saved", description: "Template updated." });
      } else {
        await apiFetch(`/api/infrastructure/diagnostics/items/${encodeURIComponent(item.id)}/templates`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "Created", description: "Template created." });
      }

      onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Template" : "New Template"}</DialogTitle>
          <DialogDescription>
            {item ? (
              <span>
                For <span className="font-semibold">{item.code}</span> — {item.name}
              </span>
            ) : (
              "Select an imaging item"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Kind" required>
              <Select value={kind} onValueChange={(v) => setKind(v as TemplateKind)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Kind" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Name" required error={errName}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Standard CXR" className="h-10" />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Body" required error={errBody}>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type template body…"
                className="min-h-[320px] font-mono text-sm"
              />
            </Field>

            <div className="rounded-xl border p-3">
              <div className="text-sm font-semibold text-zc-text">Preview</div>
              <div className="mt-2 rounded-xl border bg-zc-panel/10 p-3">
                <pre className="max-h-[320px] overflow-y-auto whitespace-pre-wrap break-words text-sm text-zc-text">{body || "—"}</pre>
              </div>
              <div className="mt-2 text-xs text-zc-muted">
                Tip: keep placeholders consistent across reports. We can later add a token helper UI.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Charge Master Mapping ----------------

function ChargeMappingTab({ branchId }: TabProps) {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<DiagnosticKind | "ALL">("ALL");
  const [includeInactive, setIncludeInactive] = React.useState(false);
  const [q, setQ] = React.useState("");

  const [maps, setMaps] = React.useState<ChargeMapRow[]>([]);
  const [unmapped, setUnmapped] = React.useState<DiagnosticItemRow[]>([]);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"create" | "edit" | "replace">("create");
  const [editingMap, setEditingMap] = React.useState<ChargeMapRow | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<DiagnosticItemRow | null>(null);

  async function loadMaps() {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      qs.set("branchId", branchId);
      if (includeInactive) qs.set("includeInactive", "true");
      const rows = await apiFetch<ChargeMapRow[]>(`/api/infrastructure/diagnostics/charge-maps?${qs.toString()}`);
      const list = safeArray(rows);

      const filtered = kind === "ALL" ? list : list.filter((m) => (m.diagnosticItem?.kind || "") === kind);
      const qv = q.trim().toLowerCase();
      const qFiltered = !qv
        ? filtered
        : filtered.filter((m) => {
          const i = m.diagnosticItem;
          const hay = `${i?.code || ""} ${i?.name || ""} ${m.chargeMasterId || ""}`.toLowerCase();
          return hay.includes(qv);
        });

      setMaps(qFiltered);
    } catch (e: any) {
      setErr(e?.message || "Failed to load charge mappings");
      setMaps([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadUnmapped() {
    try {
      const qs = new URLSearchParams();
      qs.set("branchId", branchId);
      if (kind !== "ALL") qs.set("kind", kind);
      const rows = await apiFetch<DiagnosticItemRow[]>(`/api/infrastructure/diagnostics/unmapped?${qs.toString()}`);
      setUnmapped(safeArray(rows));
    } catch {
      setUnmapped([]);
    }
  }

  React.useEffect(() => {
    void loadMaps();
    void loadUnmapped();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, includeInactive, kind]);

  React.useEffect(() => {
    const t = setTimeout(() => void loadMaps(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function deactivateMap(row: ChargeMapRow) {
    try {
      await apiFetch(`/api/infrastructure/diagnostics/charge-maps/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      toast({ title: "Deactivated", description: "Charge mapping marked inactive." });
      await loadMaps();
      await loadUnmapped();
    } catch (e: any) {
      toast({ title: "Cannot deactivate", description: e?.message || "Failed", variant: "destructive" as any });
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Charge Master Mapping</CardTitle>
          <CardDescription>Search Charge Master and bind <span className="font-mono">chargeMasterId</span> per diagnostic item.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Kind</div>
              <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                <SelectTrigger className="mt-1 h-10">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {DIAG_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Search</div>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zc-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Item code/name or chargeMasterId" className="h-10 pl-9" />
              </div>
            </div>

            <div className="flex items-end justify-end gap-2">
              <Button variant="outline" className="h-10" onClick={() => { void loadMaps(); void loadUnmapped(); }} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={includeInactive} onCheckedChange={(v) => setIncludeInactive(Boolean(v))} />
              Include inactive
            </label>
            {err ? <div className="text-sm text-rose-600">{err}</div> : null}
          </div>

          <Separator />

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-zc-text">Unmapped items</div>
                  <div className="text-xs text-zc-muted">Items without any active mapping. Click “Bind”.</div>
                </div>
                <Badge variant="outline" className="tabular-nums">{unmapped.length}</Badge>
              </div>

              <div className="mt-3 max-h-[440px] overflow-y-auto rounded-xl border bg-zc-panel/10">
                {unmapped.length ? (
                  <div className="divide-y divide-zc-border">
                    {unmapped.map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zc-text">{u.code} — {u.name}</div>
                          <div className="mt-0.5 text-xs text-zc-muted">
                            {DIAG_KINDS.find((k) => k.value === u.kind)?.label ?? u.kind} • {u.section?.name || "—"}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedItem(u);
                            setEditingMap(null);
                            setModalMode("create");
                            setModalOpen(true);
                          }}
                        >
                          Bind
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-sm text-zc-muted">No unmapped items.</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-zc-text">Existing mappings</div>
                  <div className="text-xs text-zc-muted">Edit price/dates, replace mapping, or deactivate.</div>
                </div>
                <Badge variant="outline" className="tabular-nums">{maps.length}</Badge>
              </div>

              <div className="mt-3 max-h-[440px] overflow-y-auto rounded-xl border bg-zc-panel/10">
                {maps.length ? (
                  <div className="divide-y divide-zc-border">
                    {maps.map((m) => (
                      <div key={m.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zc-text">
                              {m.diagnosticItem ? `${m.diagnosticItem.code} — ${m.diagnosticItem.name}` : m.diagnosticItemId}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zc-muted">
                              <span className={cn("rounded-full px-2 py-0.5", toneByKind(m.diagnosticItem?.kind as any))}>
                                {(m.diagnosticItem?.kind || "—").toString()}
                              </span>
                              <span className="font-mono">CM: {m.chargeMasterId}</span>
                              {m.price != null ? <span>Price: {m.price}</span> : null}
                              {m.effectiveFrom ? <span>From: {formatDateISO(m.effectiveFrom)}</span> : null}
                              {m.effectiveTo ? <span>To: {formatDateISO(m.effectiveTo)}</span> : null}
                              {!m.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedItem(m.diagnosticItem || null);
                                setEditingMap(m);
                                setModalMode("edit");
                                setModalOpen(true);
                              }}
                            >
                              Edit
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedItem(m.diagnosticItem || null);
                                setEditingMap(m);
                                setModalMode("replace");
                                setModalOpen(true);
                              }}
                            >
                              Replace
                            </Button>

                            {m.isActive ? (
                              <Button variant="destructive" size="sm" onClick={() => deactivateMap(m)}>
                                Deactivate
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-sm text-zc-muted">No mappings found.</div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-sky-200/70 bg-sky-50/70 p-3 text-xs text-sky-800 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-200">
            Charge Master endpoint used by picker: <span className="font-mono">/api/infrastructure/charge-master</span>. The UI searches using <span className="font-mono">?q=</span>.
          </div>
        </CardContent>
      </Card>

      <ChargeMapEditorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        branchId={branchId}
        mode={modalMode}
        item={selectedItem}
        editing={editingMap}
        onSaved={async () => {
          setModalOpen(false);
          setEditingMap(null);
          setSelectedItem(null);
          await loadMaps();
          await loadUnmapped();
        }}
      />
    </div>
  );
}

function ChargeMasterPicker({
  branchId,
  value,
  onChange,
}: {
  branchId: string;
  value: string;
  onChange: (id: string, row?: ChargeMasterRow | null) => void;
}) {
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [rows, setRows] = React.useState<ChargeMasterRow[]>([]);

  async function searchNow(query: string) {
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      qs.set("branchId", branchId);
      if (query.trim()) qs.set("q", query.trim());
      qs.set("take", "20");
      const list = await apiFetch<ChargeMasterRow[]>(`/api/infrastructure/charge-master?${qs.toString()}`);
      setRows(safeArray(list));
    } catch {
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    const t = setTimeout(() => void searchNow(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search charge master (code/name)…" className="h-10" />
        <Button variant="outline" className="h-10" onClick={() => searchNow(q)} disabled={busy}>
          <Search className="mr-2 h-4 w-4" /> Search
        </Button>
      </div>

      <div className="rounded-xl border bg-zc-panel/10">
        <div className="max-h-[240px] overflow-y-auto">
          {rows.length ? (
            <div className="divide-y divide-zc-border">
              {rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onChange(r.id, r)}
                  className={cn(
                    "w-full px-3 py-2 text-left hover:bg-zc-panel/20 transition",
                    value === r.id ? "bg-zc-panel/20" : "",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zc-text">
                        {(r.code ? `${r.code} — ` : "") + (r.name || r.id)}
                      </div>
                      <div className="mt-0.5 text-xs text-zc-muted font-mono">{r.id}</div>
                    </div>
                    {r.price != null ? <Badge variant="secondary">{r.price}</Badge> : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-sm text-zc-muted">No results.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChargeMapEditorModal({
  open,
  onOpenChange,
  branchId,
  mode,
  item,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  mode: "create" | "edit" | "replace";
  item: DiagnosticItemRow | null;
  editing: ChargeMapRow | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const [chargeMasterId, setChargeMasterId] = React.useState("");
  const [price, setPrice] = React.useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = React.useState<string>("");
  const [effectiveTo, setEffectiveTo] = React.useState<string>("");

  const [busy, setBusy] = React.useState(false);

  const [errCM, setErrCM] = React.useState<string | null>(null);
  const [errDates, setErrDates] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;

    const isCreate = mode === "create";

    setChargeMasterId(isCreate ? "" : (editing?.chargeMasterId || ""));
    setPrice(editing?.price != null ? String(editing.price) : "");
    setEffectiveFrom(formatDateISO(editing?.effectiveFrom || null));
    setEffectiveTo(formatDateISO(editing?.effectiveTo || null));

    setErrCM(null);
    setErrDates(null);
    setBusy(false);
  }, [open, mode, editing]);

  function validate() {
    const needCM = mode !== "edit";
    const ecm = needCM && !chargeMasterId ? "Charge Master is required" : null;

    let ed = null;
    if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
      ed = "effectiveFrom must be on/before effectiveTo";
    }

    setErrCM(ecm);
    setErrDates(ed);

    return !(ecm || ed);
  }

  async function save() {
    if (!item?.id && mode === "create") {
      toast({ title: "Select item", description: "Choose an unmapped item to bind.", variant: "destructive" as any });
      return;
    }
    if (!validate()) return;

    setBusy(true);
    try {
      if (mode === "edit") {
        if (!editing?.id) throw new Error("Missing mapping id");

        await apiFetch(`/api/infrastructure/diagnostics/charge-maps/${encodeURIComponent(editing.id)}`, {
          method: "PUT",
          body: JSON.stringify({
            branchId,
            price: price.trim() ? toFloat(price) : null,
            effectiveFrom: effectiveFrom || null,
            effectiveTo: effectiveTo || null,
          }),
        });
        toast({ title: "Saved", description: "Mapping updated." });
        onSaved();
        return;
      }

      if (mode === "replace") {
        if (!editing?.id) throw new Error("Missing mapping id");
        if (!editing?.diagnosticItemId) throw new Error("Missing item id");

        // backend rule: chargeMasterId cannot be updated; replace means deactivate + create
        await apiFetch(`/api/infrastructure/diagnostics/charge-maps/${encodeURIComponent(editing.id)}`, { method: "DELETE" });

        await apiFetch(`/api/infrastructure/diagnostics/charge-maps`, {
          method: "POST",
          body: JSON.stringify({
            branchId,
            diagnosticItemId: editing.diagnosticItemId,
            chargeMasterId,
            price: price.trim() ? toFloat(price) : null,
            effectiveFrom: effectiveFrom || null,
            effectiveTo: effectiveTo || null,
          }),
        });

        toast({ title: "Replaced", description: "Old mapping deactivated and a new mapping was created." });
        onSaved();
        return;
      }

      // create
      await apiFetch(`/api/infrastructure/diagnostics/charge-maps`, {
        method: "POST",
        body: JSON.stringify({
          branchId,
          diagnosticItemId: item!.id,
          chargeMasterId,
          price: price.trim() ? toFloat(price) : null,
          effectiveFrom: effectiveFrom || null,
          effectiveTo: effectiveTo || null,
        }),
      });

      toast({ title: "Bound", description: "Charge master bound to item." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Failed", variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "create" ? "Bind Charge Master" : mode === "edit" ? "Edit Mapping" : "Replace Mapping";

  const showPicker = mode !== "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {item ? (
              <span>
                For <span className="font-semibold">{item.code}</span> — {item.name}
              </span>
            ) : editing?.diagnosticItem ? (
              <span>
                For <span className="font-semibold">{editing.diagnosticItem.code}</span> — {editing.diagnosticItem.name}
              </span>
            ) : (
              ""
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {showPicker ? (
            <div className="grid gap-3">
              <Field label="Charge Master" required error={errCM} hint="Search and select (endpoint: /api/infrastructure/charge-master)">
                <div className="rounded-xl border p-3">
                  {chargeMasterId ? (
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-sm text-zc-muted">
                        Selected: <span className="font-mono text-zc-text">{chargeMasterId}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setChargeMasterId("")}>Clear</Button>
                    </div>
                  ) : null}

                  <ChargeMasterPicker
                    branchId={branchId}
                    value={chargeMasterId}
                    onChange={(id) => setChargeMasterId(id)}
                  />

                  <div className="mt-3 text-xs text-zc-muted">
                    If your API uses a different query param, adjust the picker search in this file.
                  </div>
                </div>
              </Field>
            </div>
          ) : (
            <div className="rounded-xl border border-zc-border bg-zc-panel/10 p-3 text-sm text-zc-muted">
              Charge Master cannot be changed via edit (backend rule). Use <span className="font-semibold">Replace</span> instead.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Price" hint="Optional override">
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g., 250" className="h-10" />
            </Field>

            <Field label="Effective from" error={errDates}>
              <Input value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} placeholder="YYYY-MM-DD" className="h-10" />
            </Field>

            <Field label="Effective to" error={errDates}>
              <Input value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} placeholder="YYYY-MM-DD" className="h-10" />
            </Field>
          </div>

          {mode === "replace" ? (
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              Replace executes: <span className="font-mono">DELETE /charge-maps/:id</span> then <span className="font-mono">POST /charge-maps</span> (because chargeMasterId cannot be updated).
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {mode === "edit" ? "Save" : mode === "replace" ? "Replace" : "Bind"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

