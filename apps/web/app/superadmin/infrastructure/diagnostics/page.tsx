"use client";

import * as React from "react";
import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Plus, RefreshCw, Pencil, Trash2, FlaskConical, FileText, Link2, ListChecks } from "lucide-react";

// -------------------- Types (frontend minimal) --------------------

type BranchRow = { id: string; code: string; name: string; city: string };

type DiagnosticKind = "LAB" | "IMAGING" | "PROCEDURE";
type DiagnosticResultDataType = "NUMERIC" | "TEXT" | "CHOICE";
type DiagnosticTemplateKind = "IMAGING_REPORT" | "LAB_REPORT";

type SectionRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

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
  sortOrder?: number | null;
  isActive: boolean;
};

type ItemRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  kind: DiagnosticKind;
  sectionId: string;
  categoryId?: string | null;
  specimenId?: string | null;
  isPanel: boolean;
  sortOrder: number;
  isActive: boolean;

  section?: SectionRow;
  category?: CategoryRow | null;
  specimen?: SpecimenRow | null;
};

type PanelItemRow = {
  id: string;
  panelId: string;
  itemId: string;
  sortOrder: number;
  isActive: boolean;
  item?: ItemRow;
};

type RangeRow = {
  id: string;
  parameterId: string;
  gender?: string | null;
  ageMinDays?: number | null;
  ageMaxDays?: number | null;
  normalLow?: number | null;
  normalHigh?: number | null;
  textNormal?: string | null;
  sortOrder: number;
  isActive: boolean;
};

type ParameterRow = {
  id: string;
  testId: string;
  code: string;
  name: string;
  dataType: DiagnosticResultDataType;
  unit?: string | null;
  precision?: number | null;
  allowedText?: string | null;
  criticalLow?: number | null;
  criticalHigh?: number | null;
  sortOrder: number;
  isActive: boolean;
  ranges?: RangeRow[];
};

type TemplateRow = {
  id: string;
  itemId: string;
  kind: DiagnosticTemplateKind;
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
  diagnosticItem?: ItemRow;
};

// -------------------- Utilities --------------------

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

function qs(params: Record<string, any>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// -------------------- Page --------------------

export default function DiagnosticsConfigPage() {
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [tab, setTab] = React.useState<"catalog" | "items" | "mappings">("items");

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState<string | undefined>(undefined);

  const [includeInactive, setIncludeInactive] = React.useState(false);

  // Catalog lists
  const [sections, setSections] = React.useState<SectionRow[]>([]);
  const [categories, setCategories] = React.useState<CategoryRow[]>([]);
  const [specimens, setSpecimens] = React.useState<SpecimenRow[]>([]);

  // Items
  const [items, setItems] = React.useState<ItemRow[]>([]);
  const [itemQ, setItemQ] = React.useState("");
  const [kind, setKind] = React.useState<DiagnosticKind | "ALL">("ALL");
  const [sectionId, setSectionId] = React.useState<string | "ALL">("ALL");
  const [categoryId, setCategoryId] = React.useState<string | "ALL">("ALL");
  const [isPanel, setIsPanel] = React.useState<"ALL" | "YES" | "NO">("ALL");

  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);
  const selectedItem = React.useMemo(
    () => items.find((x) => x.id === selectedItemId) || null,
    [items, selectedItemId]
  );

  // Details (skeleton-ready)
  const [detailTab, setDetailTab] = React.useState<"overview" | "panel" | "parameters" | "templates" | "charge">(
    "overview"
  );

  const [panelItems, setPanelItems] = React.useState<PanelItemRow[]>([]);
  const [parameters, setParameters] = React.useState<ParameterRow[]>([]);
  const [templates, setTemplates] = React.useState<TemplateRow[]>([]);
  const [chargeMapsForItem, setChargeMapsForItem] = React.useState<ChargeMapRow[]>([]);

  // Mappings
  const [chargeMaps, setChargeMaps] = React.useState<ChargeMapRow[]>([]);
  const [unmapped, setUnmapped] = React.useState<Array<{ id: string; code: string; name: string; kind: DiagnosticKind; isPanel: boolean }>>(
    []
  );

  // -------------------- Loaders --------------------

  async function loadBranches() {
    const rows = await apiFetch<BranchRow[]>("/api/branches");
    setBranches(rows || []);

    const stored = readLS(LS_KEY);
    const first = rows?.[0]?.id;
    const next = (stored && rows?.some((b) => b.id === stored) ? stored : undefined) || first || undefined;

    setBranchId(next);
    if (next) writeLS(LS_KEY, next);
  }

  async function loadCatalog(bid: string) {
    const common = { branchId: bid, includeInactive: includeInactive ? "true" : undefined };

    const [sec, cat, spec] = await Promise.all([
      apiFetch<SectionRow[]>(`/api/infrastructure/diagnostics/sections${qs(common)}`),
      apiFetch<CategoryRow[]>(`/api/infrastructure/diagnostics/categories${qs(common)}`),
      apiFetch<SpecimenRow[]>(`/api/infrastructure/diagnostics/specimens${qs(common)}`),
    ]);

    setSections(sec || []);
    setCategories(cat || []);
    setSpecimens(spec || []);
  }

  async function loadItems(bid: string) {
    const params: any = {
      branchId: bid,
      includeInactive: includeInactive ? "true" : undefined,
      q: itemQ.trim() || undefined,
      kind: kind !== "ALL" ? kind : undefined,
      sectionId: sectionId !== "ALL" ? sectionId : undefined,
      categoryId: categoryId !== "ALL" ? categoryId : undefined,
      isPanel: isPanel === "ALL" ? undefined : isPanel === "YES" ? "true" : "false",
    };

    const rows = await apiFetch<ItemRow[]>(`/api/infrastructure/diagnostics/items${qs(params)}`);
    setItems(rows || []);
  }

  async function loadMappings(bid: string) {
    const common = { branchId: bid, includeInactive: includeInactive ? "true" : undefined };

    const [maps, un] = await Promise.all([
      apiFetch<ChargeMapRow[]>(`/api/infrastructure/diagnostics/charge-maps${qs(common)}`),
      apiFetch<any[]>(`/api/infrastructure/diagnostics/unmapped${qs({ branchId: bid })}`),
    ]);

    setChargeMaps(maps || []);
    setUnmapped(un || []);
  }

  async function refreshAll(showToast = false) {
    setBusy(true);
    setErr(null);
    try {
      await loadBranches();
      const bid = branchId ?? readLS(LS_KEY) ?? undefined;
      if (bid) {
        await Promise.all([loadCatalog(bid), loadItems(bid), loadMappings(bid)]);
      }
      if (showToast) toast({ title: "Refreshed", description: "Diagnostics configuration loaded." });
    } catch (e: any) {
      const msg = e?.message || "Refresh failed.";
      setErr(msg);
      if (showToast) toast({ title: "Refresh failed", description: msg, variant: "destructive" as any });
    } finally {
      setBusy(false);
      setLoading(false);
    }
  }

  // initial
  React.useEffect(() => {
    void refreshAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload when branch / includeInactive changes
  React.useEffect(() => {
    if (!branchId) return;
    writeLS(LS_KEY, branchId);
    setSelectedItemId(null);
    setDetailTab("overview");
    void (async () => {
      setBusy(true);
      setErr(null);
      try {
        await Promise.all([loadCatalog(branchId), loadItems(branchId), loadMappings(branchId)]);
      } catch (e: any) {
        setErr(e?.message || "Load failed.");
      } finally {
        setBusy(false);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, includeInactive]);

  // -------------------- Details loaders (skeleton-ready, real GET calls) --------------------

  async function loadSelectedItemDetails(which: typeof detailTab) {
    if (!selectedItemId) return;
    setBusy(true);
    setErr(null);
    try {
      if (which === "panel") {
        const rows = await apiFetch<PanelItemRow[]>(
          `/api/infrastructure/diagnostics/items/${encodeURIComponent(selectedItemId)}/panel-items`
        );
        setPanelItems(rows || []);
      }
      if (which === "parameters") {
        const rows = await apiFetch<ParameterRow[]>(
          `/api/infrastructure/diagnostics/items/${encodeURIComponent(selectedItemId)}/parameters`
        );
        setParameters(rows || []);
      }
      if (which === "templates") {
        const rows = await apiFetch<TemplateRow[]>(
          `/api/infrastructure/diagnostics/items/${encodeURIComponent(selectedItemId)}/templates`
        );
        setTemplates(rows || []);
      }
      if (which === "charge") {
        if (!branchId) return;
        const rows = await apiFetch<ChargeMapRow[]>(
          `/api/infrastructure/diagnostics/charge-maps${qs({ branchId, diagnosticItemId: selectedItemId, includeInactive: includeInactive ? "true" : undefined })}`
        );
        setChargeMapsForItem(rows || []);
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to load item details.";
      setErr(msg);
      toast({ title: "Load failed", description: msg, variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  // -------------------- CRUD: Catalog + basic Items + basic Charge Map (minimal) --------------------

  // Sections modal state
  const [secOpen, setSecOpen] = React.useState(false);
  const [secEdit, setSecEdit] = React.useState<SectionRow | null>(null);
  const [secCode, setSecCode] = React.useState("");
  const [secName, setSecName] = React.useState("");
  const [secSort, setSecSort] = React.useState<number>(0);
  const [secActive, setSecActive] = React.useState(true);

  function resetSectionForm() {
    setSecEdit(null);
    setSecCode("");
    setSecName("");
    setSecSort(0);
    setSecActive(true);
  }

  async function saveSection() {
    if (!branchId) return;
    setBusy(true);
    setErr(null);
    try {
      if (!secEdit) {
        await apiFetch(`/api/infrastructure/diagnostics/sections`, {
          method: "POST",
          body: JSON.stringify({ branchId, code: secCode, name: secName, sortOrder: secSort }),
        });
        toast({ title: "Section created" });
      } else {
        await apiFetch(`/api/infrastructure/diagnostics/sections/${encodeURIComponent(secEdit.id)}`, {
          method: "PUT",
          body: JSON.stringify({ branchId, code: secCode, name: secName, sortOrder: secSort, isActive: secActive }),
        });
        toast({ title: "Section updated" });
      }
      await loadCatalog(branchId);
      setSecOpen(false);
      resetSectionForm();
    } catch (e: any) {
      const msg = e?.message || "Save failed.";
      setErr(msg);
      toast({ title: "Save failed", description: msg, variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function deleteSection(id: string) {
    if (!branchId) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/infrastructure/diagnostics/sections/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast({ title: "Section deactivated" });
      await loadCatalog(branchId);
    } catch (e: any) {
      const msg = e?.message || "Delete failed.";
      setErr(msg);
      toast({ title: "Delete failed", description: msg, variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  // Categories modal state
  const [catOpen, setCatOpen] = React.useState(false);
  const [catEdit, setCatEdit] = React.useState<CategoryRow | null>(null);
  const [catSectionId, setCatSectionId] = React.useState<string | undefined>(undefined);
  const [catCode, setCatCode] = React.useState("");
  const [catName, setCatName] = React.useState("");
  const [catSort, setCatSort] = React.useState<number>(0);
  const [catActive, setCatActive] = React.useState(true);

  function resetCategoryForm() {
    setCatEdit(null);
    setCatSectionId(undefined);
    setCatCode("");
    setCatName("");
    setCatSort(0);
    setCatActive(true);
  }

  async function saveCategory() {
    if (!branchId) return;
    setBusy(true);
    setErr(null);
    try {
      if (!catEdit) {
        await apiFetch(`/api/infrastructure/diagnostics/categories`, {
          method: "POST",
          body: JSON.stringify({ branchId, sectionId: catSectionId, code: catCode, name: catName, sortOrder: catSort }),
        });
        toast({ title: "Category created" });
      } else {
        await apiFetch(`/api/infrastructure/diagnostics/categories/${encodeURIComponent(catEdit.id)}`, {
          method: "PUT",
          body: JSON.stringify({
            branchId,
            sectionId: catSectionId,
            code: catCode,
            name: catName,
            sortOrder: catSort,
            isActive: catActive,
          }),
        });
        toast({ title: "Category updated" });
      }
      await loadCatalog(branchId);
      setCatOpen(false);
      resetCategoryForm();
    } catch (e: any) {
      const msg = e?.message || "Save failed.";
      setErr(msg);
      toast({ title: "Save failed", description: msg, variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!branchId) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/infrastructure/diagnostics/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast({ title: "Category deactivated" });
      await loadCatalog(branchId);
    } catch (e: any) {
      const msg = e?.message || "Delete failed.";
      setErr(msg);
      toast({ title: "Delete failed", description: msg, variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  // Specimens modal state
  const [spOpen, setSpOpen] = React.useState(false);
  const [spEdit, setSpEdit] = React.useState<SpecimenRow | null>(null);
  const [spCode, setSpCode] = React.useState("");
  const [spName, setSpName] = React.useState("");
  const [spContainer, setSpContainer] = React.useState("");
  const [spMinMl, setSpMinMl] = React.useState<string>("");
  const [spNotes, setSpNotes] = React.useState("");
  const [spActive, setSpActive] = React.useState(true);

  function resetSpecimenForm() {
    setSpEdit(null);
    setSpCode("");
    setSpName("");
    setSpContainer("");
    setSpMinMl("");
    setSpNotes("");
    setSpActive(true);
  }

  async function saveSpecimen() {
    if (!branchId) return;
    setBusy(true);
    setErr(null);
    try {
      if (!spEdit) {
        await apiFetch(`/api/infrastructure/diagnostics/specimens`, {
          method: "POST",
          body: JSON.stringify({
            branchId,
            code: spCode,
            name: spName,
            container: spContainer || undefined,
            minVolume: spMinMl || undefined,
            handlingNotes: spNotes || undefined,
          }),
        });
        toast({ title: "Specimen created" });
      } else {
        await apiFetch(`/api/infrastructure/diagnostics/specimens/${encodeURIComponent(spEdit.id)}`, {
          method: "PUT",
          body: JSON.stringify({
            branchId,
            code: spCode,
            name: spName,
            container: spContainer,
            minVolume: spMinMl,
            handlingNotes: spNotes,
            isActive: spActive,
          }),
        });
        toast({ title: "Specimen updated" });
      }
      await loadCatalog(branchId);
      setSpOpen(false);
      resetSpecimenForm();
    } catch (e: any) {
      const msg = e?.message || "Save failed.";
      setErr(msg);
      toast({ title: "Save failed", description: msg, variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  async function deleteSpecimen(id: string) {
    if (!branchId) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/infrastructure/diagnostics/specimens/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast({ title: "Specimen deactivated" });
      await loadCatalog(branchId);
    } catch (e: any) {
      const msg = e?.message || "Delete failed.";
      setErr(msg);
      toast({ title: "Delete failed", description: msg, variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  // Charge map create (minimal)
  const [mapOpen, setMapOpen] = React.useState(false);
  const [mapItemId, setMapItemId] = React.useState<string | undefined>(undefined);
  const [mapChargeId, setMapChargeId] = React.useState("");
  const [mapPrice, setMapPrice] = React.useState<string>("");
  const [mapFrom, setMapFrom] = React.useState<string>("");
  const [mapTo, setMapTo] = React.useState<string>("");

  function resetMapForm() {
    setMapItemId(undefined);
    setMapChargeId("");
    setMapPrice("");
    setMapFrom("");
    setMapTo("");
  }

  async function saveChargeMap() {
    if (!branchId) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/infrastructure/diagnostics/charge-maps`, {
        method: "POST",
        body: JSON.stringify({
          branchId,
          diagnosticItemId: mapItemId,
          chargeMasterId: mapChargeId,
          price: mapPrice.trim() ? Number(mapPrice) : undefined,
          effectiveFrom: mapFrom || undefined,
          effectiveTo: mapTo || undefined,
        }),
      });
      toast({ title: "Charge map created" });
      await loadMappings(branchId);
      if (selectedItemId) {
        const rows = await apiFetch<ChargeMapRow[]>(
          `/api/infrastructure/diagnostics/charge-maps${qs({ branchId, diagnosticItemId: selectedItemId, includeInactive: includeInactive ? "true" : undefined })}`
        );
        setChargeMapsForItem(rows || []);
      }
      setMapOpen(false);
      resetMapForm();
    } catch (e: any) {
      const msg = e?.message || "Save failed.";
      setErr(msg);
      toast({ title: "Save failed", description: msg, variant: "destructive" as any });
    } finally {
      setBusy(false);
    }
  }

  // -------------------- Render --------------------

  const filteredCategoriesForSection = React.useMemo(() => {
    if (sectionId === "ALL") return categories;
    return categories.filter((c) => c.sectionId === sectionId);
  }, [categories, sectionId]);

  return (
    <AppShell title="Infrastructure • Diagnostics Configuration">
      <div className="grid gap-6">
        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm text-zc-muted">
              <Link href="/superadmin/infrastructure" className="hover:underline">
                Infrastructure
              </Link>
              <span className="mx-2 text-zc-muted/60">/</span>
              <span className="text-zc-text">Diagnostics Configuration</span>
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight">Diagnostics Configuration</div>
            <div className="mt-2 text-sm text-zc-muted">
              Skeleton UI: manage Sections / Categories / Specimens / Diagnostic Items, with placeholders for Panel Builder,
              Lab Parameters, Imaging Templates and Charge Mapping.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" disabled={busy} onClick={() => void refreshAll(true)}>
              <RefreshCw className={cn("h-4 w-4", busy ? "animate-spin" : "")} />
              Refresh
            </Button>

            <div className="flex items-center gap-2 rounded-xl border border-zc-border bg-zc-panel/10 px-3 py-2">
              <div className="text-xs font-semibold text-zc-muted">Include inactive</div>
              <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
            </div>
          </div>
        </div>

        {/* Global selectors */}
        <Card className="overflow-hidden">
          <CardContent className="py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zc-text">Scope</div>
                <div className="mt-1 text-sm text-zc-muted">
                  Select Branch for diagnostics configuration (required for Super Admin).
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[260px]">
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder={loading ? "Loading branches…" : "Select branch…"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[320px] overflow-y-auto">
                      {(branches || []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} <span className="font-mono text-xs text-zc-muted">({b.code})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {branchId ? (
                  <Badge variant="secondary" className="gap-2">
                    <span className="font-mono text-xs">{branchId.slice(0, 8)}…</span>
                  </Badge>
                ) : (
                  <Badge variant="warning">Branch required</Badge>
                )}
              </div>
            </div>

            {err ? (
              <div className="mt-3 rounded-xl border border-zc-danger/30 bg-zc-danger/10 px-3 py-2 text-sm text-zc-danger">
                {err}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <TabsList className="w-full md:w-auto">
              <TabsTrigger value="catalog" className="gap-2">
                <ListChecks className="h-4 w-4" />
                Catalog
              </TabsTrigger>
              <TabsTrigger value="items" className="gap-2">
                <FlaskConical className="h-4 w-4" />
                Items
              </TabsTrigger>
              <TabsTrigger value="mappings" className="gap-2">
                <Link2 className="h-4 w-4" />
                Charge Mapping
              </TabsTrigger>
            </TabsList>

            <div className="text-sm text-zc-muted">
              {loading ? "Loading…" : busy ? "Working…" : "Ready"}
            </div>
          </div>

          {/* ---------------- Catalog ---------------- */}
          <TabsContent value="catalog">
            <Card>
              <CardHeader>
                <CardTitle>Catalog</CardTitle>
                <CardDescription>Maintain Sections, Categories and Specimen Types for diagnostics.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="sections">
                  <TabsList className="w-full md:w-auto">
                    <TabsTrigger value="sections">Sections</TabsTrigger>
                    <TabsTrigger value="categories">Categories</TabsTrigger>
                    <TabsTrigger value="specimens">Specimens</TabsTrigger>
                  </TabsList>

                  {/* Sections */}
                  <TabsContent value="sections">
                    <div className="flex items-center justify-between gap-2 py-2">
                      <div className="text-sm text-zc-muted">Sections group diagnostics into broad buckets (e.g., LAB, IMAGING).</div>

                      <Dialog
                        open={secOpen}
                        onOpenChange={(v) => {
                          setSecOpen(v);
                          if (!v) resetSectionForm();
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button className="gap-2" disabled={!branchId}>
                            <Plus className="h-4 w-4" />
                            Add Section
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                          <DialogHeader>
                            <DialogTitle>{secEdit ? "Edit Section" : "Create Section"}</DialogTitle>
                          </DialogHeader>

                          <div className="grid gap-4">
                            <div className="grid gap-2">
                              <Label>Code</Label>
                              <Input value={secCode} onChange={(e) => setSecCode(e.target.value)} placeholder="LAB" />
                            </div>
                            <div className="grid gap-2">
                              <Label>Name</Label>
                              <Input value={secName} onChange={(e) => setSecName(e.target.value)} placeholder="Laboratory" />
                            </div>
                            <div className="grid gap-2">
                              <Label>Sort Order</Label>
                              <Input
                                type="number"
                                value={String(secSort)}
                                onChange={(e) => setSecSort(Number(e.target.value || 0))}
                              />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-zc-border px-3 py-2">
                              <div>
                                <div className="text-sm font-semibold text-zc-text">Active</div>
                                <div className="text-xs text-zc-muted">Inactive hides it from default lists.</div>
                              </div>
                              <Switch checked={secActive} onCheckedChange={setSecActive} />
                            </div>
                          </div>

                          <DialogFooter className="mt-2 gap-2">
                            <Button variant="outline" onClick={() => setSecOpen(false)}>
                              Cancel
                            </Button>
                            <Button disabled={!branchId || busy || !secCode.trim() || !secName.trim()} onClick={() => void saveSection()}>
                              Save
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <Separator className="my-3" />

                    {loading ? (
                      <div className="grid gap-2">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[140px]">Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[120px]">Sort</TableHead>
                            <TableHead className="w-[140px]">Status</TableHead>
                            <TableHead className="w-[140px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(sections || []).map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="font-mono text-xs">{s.code}</TableCell>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell>{s.sortOrder}</TableCell>
                              <TableCell>
                                {s.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2"
                                    onClick={() => {
                                      setSecEdit(s);
                                      setSecCode(s.code);
                                      setSecName(s.name);
                                      setSecSort(s.sortOrder ?? 0);
                                      setSecActive(!!s.isActive);
                                      setSecOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2"
                                    onClick={() => void deleteSection(s.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {sections.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-8 text-center text-sm text-zc-muted">
                                No sections found.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  {/* Categories */}
                  <TabsContent value="categories">
                    <div className="flex items-center justify-between gap-2 py-2">
                      <div className="text-sm text-zc-muted">Categories live under a Section (e.g., Biochemistry under LAB).</div>

                      <Dialog
                        open={catOpen}
                        onOpenChange={(v) => {
                          setCatOpen(v);
                          if (!v) resetCategoryForm();
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button className="gap-2" disabled={!branchId || sections.length === 0}>
                            <Plus className="h-4 w-4" />
                            Add Category
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-xl">
                          <DialogHeader>
                            <DialogTitle>{catEdit ? "Edit Category" : "Create Category"}</DialogTitle>
                          </DialogHeader>

                          <div className="grid gap-4">
                            <div className="grid gap-2">
                              <Label>Section</Label>
                              <Select value={catSectionId} onValueChange={setCatSectionId}>
                                <SelectTrigger className="h-11 rounded-xl">
                                  <SelectValue placeholder="Select section…" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[320px] overflow-y-auto">
                                  {(sections || []).map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name} <span className="font-mono text-xs text-zc-muted">({s.code})</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="grid gap-2">
                              <Label>Code</Label>
                              <Input value={catCode} onChange={(e) => setCatCode(e.target.value)} placeholder="BIOCHEM" />
                            </div>
                            <div className="grid gap-2">
                              <Label>Name</Label>
                              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Biochemistry" />
                            </div>
                            <div className="grid gap-2">
                              <Label>Sort Order</Label>
                              <Input
                                type="number"
                                value={String(catSort)}
                                onChange={(e) => setCatSort(Number(e.target.value || 0))}
                              />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-zc-border px-3 py-2">
                              <div>
                                <div className="text-sm font-semibold text-zc-text">Active</div>
                                <div className="text-xs text-zc-muted">Inactive hides it from default lists.</div>
                              </div>
                              <Switch checked={catActive} onCheckedChange={setCatActive} />
                            </div>
                          </div>

                          <DialogFooter className="mt-2 gap-2">
                            <Button variant="outline" onClick={() => setCatOpen(false)}>
                              Cancel
                            </Button>
                            <Button
                              disabled={!branchId || busy || !catSectionId || !catCode.trim() || !catName.trim()}
                              onClick={() => void saveCategory()}
                            >
                              Save
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <Separator className="my-3" />

                    {loading ? (
                      <div className="grid gap-2">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Section</TableHead>
                            <TableHead className="w-[140px]">Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[140px]">Status</TableHead>
                            <TableHead className="w-[140px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(categories || []).map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>
                                <div className="text-sm font-semibold">{c.section?.name ?? "—"}</div>
                                <div className="text-xs text-zc-muted font-mono">{c.section?.code ?? ""}</div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{c.code}</TableCell>
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell>
                                {c.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2"
                                    onClick={() => {
                                      setCatEdit(c);
                                      setCatSectionId(c.sectionId);
                                      setCatCode(c.code);
                                      setCatName(c.name);
                                      setCatSort(c.sortOrder ?? 0);
                                      setCatActive(!!c.isActive);
                                      setCatOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2"
                                    onClick={() => void deleteCategory(c.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {categories.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-8 text-center text-sm text-zc-muted">
                                No categories found.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  {/* Specimens */}
                  <TabsContent value="specimens">
                    <div className="flex items-center justify-between gap-2 py-2">
                      <div className="text-sm text-zc-muted">Specimen types apply to LAB items (e.g., Blood, Serum).</div>

                      <Dialog
                        open={spOpen}
                        onOpenChange={(v) => {
                          setSpOpen(v);
                          if (!v) resetSpecimenForm();
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button className="gap-2" disabled={!branchId}>
                            <Plus className="h-4 w-4" />
                            Add Specimen
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{spEdit ? "Edit Specimen" : "Create Specimen"}</DialogTitle>
                          </DialogHeader>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                              <Label>Code</Label>
                              <Input value={spCode} onChange={(e) => setSpCode(e.target.value)} placeholder="BLOOD" />
                            </div>
                            <div className="grid gap-2">
                              <Label>Name</Label>
                              <Input value={spName} onChange={(e) => setSpName(e.target.value)} placeholder="Whole Blood" />
                            </div>

                            <div className="grid gap-2">
                              <Label>Container</Label>
                              <Input value={spContainer} onChange={(e) => setSpContainer(e.target.value)} placeholder="EDTA vial" />
                            </div>
                            <div className="grid gap-2">
                              <Label>Min Volume (ml)</Label>
                              <Input value={spMinMl} onChange={(e) => setSpMinMl(e.target.value)} placeholder="2" />
                            </div>

                            <div className="grid gap-2 md:col-span-2">
                              <Label>Handling Notes</Label>
                              <Textarea value={spNotes} onChange={(e) => setSpNotes(e.target.value)} placeholder="Keep refrigerated…" />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border border-zc-border px-3 py-2 md:col-span-2">
                              <div>
                                <div className="text-sm font-semibold text-zc-text">Active</div>
                                <div className="text-xs text-zc-muted">Inactive hides it from selection lists.</div>
                              </div>
                              <Switch checked={spActive} onCheckedChange={setSpActive} />
                            </div>
                          </div>

                          <DialogFooter className="mt-2 gap-2">
                            <Button variant="outline" onClick={() => setSpOpen(false)}>
                              Cancel
                            </Button>
                            <Button disabled={!branchId || busy || !spCode.trim() || !spName.trim()} onClick={() => void saveSpecimen()}>
                              Save
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <Separator className="my-3" />

                    {loading ? (
                      <div className="grid gap-2">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[140px]">Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[180px]">Container</TableHead>
                            <TableHead className="w-[140px]">Status</TableHead>
                            <TableHead className="w-[140px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(specimens || []).map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="font-mono text-xs">{s.code}</TableCell>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell className="text-sm text-zc-muted">{s.container ?? "—"}</TableCell>
                              <TableCell>
                                {s.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2"
                                    onClick={() => {
                                      setSpEdit(s);
                                      setSpCode(s.code);
                                      setSpName(s.name);
                                      setSpContainer(s.container ?? "");
                                      setSpMinMl(s.minVolumeMl != null ? String(s.minVolumeMl) : "");
                                      setSpNotes(s.handlingNotes ?? "");
                                      setSpActive(!!s.isActive);
                                      setSpOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2"
                                    onClick={() => void deleteSpecimen(s.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {specimens.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-8 text-center text-sm text-zc-muted">
                                No specimens found.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------- Items ---------------- */}
          <TabsContent value="items">
            <div className="grid gap-4 lg:grid-cols-12">
              {/* Left: filters + list */}
              <div className="lg:col-span-7">
                <Card>
                  <CardHeader>
                    <CardTitle>Diagnostic Items</CardTitle>
                    <CardDescription>
                      Filter by kind/section/category and select an item to see detail placeholders (panel, parameters, templates, mapping).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-12 md:items-end">
                      <div className="md:col-span-4 grid gap-2">
                        <Label>Search</Label>
                        <Input value={itemQ} onChange={(e) => setItemQ(e.target.value)} placeholder="code or name…" />
                      </div>

                      <div className="md:col-span-2 grid gap-2">
                        <Label>Kind</Label>
                        <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All</SelectItem>
                            <SelectItem value="LAB">LAB</SelectItem>
                            <SelectItem value="IMAGING">IMAGING</SelectItem>
                            <SelectItem value="PROCEDURE">PROCEDURE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3 grid gap-2">
                        <Label>Section</Label>
                        <Select value={sectionId} onValueChange={(v) => setSectionId(v as any)}>
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[320px] overflow-y-auto">
                            <SelectItem value="ALL">All</SelectItem>
                            {(sections || []).map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} <span className="font-mono text-xs text-zc-muted">({s.code})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3 grid gap-2">
                        <Label>Category</Label>
                        <Select value={categoryId} onValueChange={(v) => setCategoryId(v as any)}>
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="max-h-[320px] overflow-y-auto">
                            <SelectItem value="ALL">All</SelectItem>
                            {(filteredCategoriesForSection || []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} <span className="font-mono text-xs text-zc-muted">({c.code})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3 grid gap-2">
                        <Label>Panel</Label>
                        <Select value={isPanel} onValueChange={(v) => setIsPanel(v as any)}>
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All</SelectItem>
                            <SelectItem value="YES">Panels only</SelectItem>
                            <SelectItem value="NO">Non-panels</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-9 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          className="gap-2"
                          disabled={!branchId || busy}
                          onClick={() => branchId && void loadItems(branchId)}
                        >
                          <RefreshCw className={cn("h-4 w-4", busy ? "animate-spin" : "")} />
                          Apply Filters
                        </Button>

                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setItemQ("");
                            setKind("ALL");
                            setSectionId("ALL");
                            setCategoryId("ALL");
                            setIsPanel("ALL");
                            if (branchId) void loadItems(branchId);
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {loading ? (
                      <div className="grid gap-2">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[140px]">Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[120px]">Kind</TableHead>
                            <TableHead className="w-[140px]">Type</TableHead>
                            <TableHead className="w-[140px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(items || []).map((it) => {
                            const active = selectedItemId === it.id;
                            return (
                              <TableRow
                                key={it.id}
                                className={cn(active ? "bg-[rgb(var(--zc-hover-rgb)/0.08)]" : "", "cursor-pointer")}
                                onClick={() => {
                                  setSelectedItemId(it.id);
                                  setDetailTab("overview");
                                  setPanelItems([]);
                                  setParameters([]);
                                  setTemplates([]);
                                  setChargeMapsForItem([]);
                                }}
                              >
                                <TableCell className="font-mono text-xs">{it.code}</TableCell>
                                <TableCell>
                                  <div className="font-medium">{it.name}</div>
                                  <div className="text-xs text-zc-muted">
                                    {it.section?.name ? `${it.section.name}` : "—"}
                                    {it.category?.name ? ` • ${it.category.name}` : ""}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{it.kind}</Badge>
                                </TableCell>
                                <TableCell>
                                  {it.isPanel ? <Badge variant="accent">Panel</Badge> : <Badge variant="secondary">Single</Badge>}
                                </TableCell>
                                <TableCell>
                                  {it.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {items.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-10 text-center text-sm text-zc-muted">
                                No items found. Adjust filters or create items in next iteration.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right: detail skeleton */}
              <div className="lg:col-span-5">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Item Details</CardTitle>
                    <CardDescription>
                      {selectedItem ? (
                        <>
                          <span className="font-semibold text-zc-text">{selectedItem.name}</span>{" "}
                          <span className="text-zc-muted">({selectedItem.code})</span>
                        </>
                      ) : (
                        "Select an item from the list."
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {!selectedItem ? (
                      <div className="rounded-xl border border-dashed border-zc-border p-4 text-sm text-zc-muted">
                        No item selected. Choose an item to view panel / parameters / templates / mapping scaffolds.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{selectedItem.kind}</Badge>
                          {selectedItem.isPanel ? <Badge variant="accent">Panel</Badge> : <Badge variant="secondary">Single</Badge>}
                          {selectedItem.specimen?.name ? (
                            <Badge variant="secondary">Specimen: {selectedItem.specimen.name}</Badge>
                          ) : null}
                        </div>

                        <Tabs value={detailTab} onValueChange={(v) => {
                          const next = v as any;
                          setDetailTab(next);
                          void loadSelectedItemDetails(next);
                        }}>
                          <TabsList className="w-full">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="panel" disabled={!selectedItem.isPanel}>
                              Panel
                            </TabsTrigger>
                            <TabsTrigger value="parameters" disabled={!(selectedItem.kind === "LAB" && !selectedItem.isPanel)}>
                              Lab Params
                            </TabsTrigger>
                            <TabsTrigger value="templates" disabled={selectedItem.kind !== "IMAGING"}>
                              Templates
                            </TabsTrigger>
                            <TabsTrigger value="charge">Charges</TabsTrigger>
                          </TabsList>

                          <TabsContent value="overview">
                            <div className="grid gap-3">
                              <div className="rounded-xl border border-zc-border p-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Section</div>
                                <div className="mt-1 text-sm font-semibold">{selectedItem.section?.name ?? "—"}</div>
                                <div className="text-xs text-zc-muted font-mono">{selectedItem.section?.code ?? ""}</div>
                              </div>

                              <div className="rounded-xl border border-zc-border p-3">
                                <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Category</div>
                                <div className="mt-1 text-sm font-semibold">{selectedItem.category?.name ?? "—"}</div>
                                <div className="text-xs text-zc-muted font-mono">{selectedItem.category?.code ?? ""}</div>
                              </div>

                              <div className="rounded-xl border border-dashed border-zc-border p-3 text-sm text-zc-muted">
                                Skeleton note: Item CRUD (create/edit/delete), TAT, consent, appointment flags, etc. can be added next.
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="panel">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-zc-text">Panel Items</div>
                              <Button variant="outline" size="sm" disabled>
                                <Plus className="mr-2 h-4 w-4" />
                                Edit Panel (next)
                              </Button>
                            </div>

                            <Separator className="my-3" />

                            {panelItems.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-zc-border p-3 text-sm text-zc-muted">
                                {busy ? "Loading…" : "No panel items loaded yet, or panel is empty."}
                              </div>
                            ) : (
                              <div className="grid gap-2">
                                {panelItems.map((pi) => (
                                  <div key={pi.id} className="rounded-xl border border-zc-border p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold truncate">{pi.item?.name ?? pi.itemId}</div>
                                        <div className="text-xs text-zc-muted font-mono">{pi.item?.code ?? ""}</div>
                                      </div>
                                      <Badge variant="secondary">Sort {pi.sortOrder}</Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 rounded-xl border border-dashed border-zc-border p-3 text-sm text-zc-muted">
                              Panel builder UI (drag/drop, search/select, replacePanelItems) will be added in the next enhancement.
                            </div>
                          </TabsContent>

                          <TabsContent value="parameters">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-zc-text">Lab Parameters</div>
                              <Button variant="outline" size="sm" disabled>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Parameter (next)
                              </Button>
                            </div>

                            <Separator className="my-3" />

                            {parameters.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-zc-border p-3 text-sm text-zc-muted">
                                {busy ? "Loading…" : "No parameters loaded yet."}
                              </div>
                            ) : (
                              <div className="grid gap-3">
                                {parameters.map((p) => (
                                  <div key={p.id} className="rounded-xl border border-zc-border p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold truncate">{p.name}</div>
                                        <div className="text-xs text-zc-muted font-mono">{p.code}</div>
                                      </div>
                                      <Badge variant="outline">{p.dataType}</Badge>
                                    </div>

                                    {p.ranges?.length ? (
                                      <div className="mt-2 text-xs text-zc-muted">
                                        Ranges: <span className="font-semibold text-zc-text">{p.ranges.length}</span>
                                      </div>
                                    ) : (
                                      <div className="mt-2 text-xs text-zc-muted">Ranges: 0</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 rounded-xl border border-dashed border-zc-border p-3 text-sm text-zc-muted">
                              Next enhancement: Parameter CRUD + Reference Range CRUD UI.
                            </div>
                          </TabsContent>

                          <TabsContent value="templates">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-zc-text">Imaging Templates</div>
                              <Button variant="outline" size="sm" disabled>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Template (next)
                              </Button>
                            </div>

                            <Separator className="my-3" />

                            {templates.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-zc-border p-3 text-sm text-zc-muted">
                                {busy ? "Loading…" : "No templates loaded yet."}
                              </div>
                            ) : (
                              <div className="grid gap-3">
                                {templates.map((t) => (
                                  <div key={t.id} className="rounded-xl border border-zc-border p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold truncate">{t.name}</div>
                                        <div className="text-xs text-zc-muted">{t.kind}</div>
                                      </div>
                                      <FileText className="h-4 w-4 text-zc-muted" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 rounded-xl border border-dashed border-zc-border p-3 text-sm text-zc-muted">
                              Next enhancement: Template CRUD with rich editor / textarea.
                            </div>
                          </TabsContent>

                          <TabsContent value="charge">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-zc-text">Charge Mapping</div>

                              <Dialog
                                open={mapOpen}
                                onOpenChange={(v) => {
                                  setMapOpen(v);
                                  if (!v) resetMapForm();
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button size="sm" className="gap-2" disabled={!branchId}>
                                    <Plus className="h-4 w-4" />
                                    Map Charge
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Create Charge Map</DialogTitle>
                                  </DialogHeader>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2 md:col-span-2">
                                      <Label>Diagnostic Item</Label>
                                      <Select
                                        value={mapItemId ?? selectedItemId ?? undefined}
                                        onValueChange={(v) => setMapItemId(v)}
                                      >
                                        <SelectTrigger className="h-11 rounded-xl">
                                          <SelectValue placeholder="Select item…" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[320px] overflow-y-auto">
                                          {(items || []).map((it) => (
                                            <SelectItem key={it.id} value={it.id}>
                                              {it.name} <span className="font-mono text-xs text-zc-muted">({it.code})</span>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="grid gap-2 md:col-span-2">
                                      <Label>Charge Master ID</Label>
                                      <Input value={mapChargeId} onChange={(e) => setMapChargeId(e.target.value)} placeholder="chargeMasterId" />
                                      <div className="text-xs text-zc-muted">
                                        Skeleton: later we can add a Charge Master search picker.
                                      </div>
                                    </div>

                                    <div className="grid gap-2">
                                      <Label>Price (optional)</Label>
                                      <Input value={mapPrice} onChange={(e) => setMapPrice(e.target.value)} placeholder="1500" />
                                    </div>

                                    <div className="grid gap-2">
                                      <Label>Effective From (optional)</Label>
                                      <Input value={mapFrom} onChange={(e) => setMapFrom(e.target.value)} placeholder="2026-01-01" />
                                    </div>

                                    <div className="grid gap-2 md:col-span-2">
                                      <Label>Effective To (optional)</Label>
                                      <Input value={mapTo} onChange={(e) => setMapTo(e.target.value)} placeholder="2026-12-31" />
                                    </div>
                                  </div>

                                  <DialogFooter className="mt-2 gap-2">
                                    <Button variant="outline" onClick={() => setMapOpen(false)}>
                                      Cancel
                                    </Button>
                                    <Button
                                      disabled={!branchId || busy || !(mapItemId ?? selectedItemId) || !mapChargeId.trim()}
                                      onClick={() => {
                                        if (!mapItemId && selectedItemId) setMapItemId(selectedItemId);
                                        void saveChargeMap();
                                      }}
                                    >
                                      Save
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>

                            <Separator className="my-3" />

                            {chargeMapsForItem.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-zc-border p-3 text-sm text-zc-muted">
                                {busy ? "Loading…" : "No charge maps loaded for this item (or none exist)."}
                              </div>
                            ) : (
                              <div className="grid gap-2">
                                {chargeMapsForItem.map((m) => (
                                  <div key={m.id} className="rounded-xl border border-zc-border p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold truncate">{m.chargeMasterId}</div>
                                        <div className="text-xs text-zc-muted">
                                          Price: {m.price ?? "—"} • Active: {String(m.isActive)}
                                        </div>
                                      </div>
                                      <Badge variant="secondary">Map</Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 rounded-xl border border-dashed border-zc-border p-3 text-sm text-zc-muted">
                              Next enhancement: Charge map edit/deactivate, and Charge Master lookup UI.
                            </div>
                          </TabsContent>
                        </Tabs>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ---------------- Charge Mapping ---------------- */}
          <TabsContent value="mappings">
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <Card>
                  <CardHeader>
                    <CardTitle>All Charge Maps</CardTitle>
                    <CardDescription>Branch-level charge mappings for diagnostic items.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="grid gap-2">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="w-[220px]">Charge Master</TableHead>
                            <TableHead className="w-[120px]">Price</TableHead>
                            <TableHead className="w-[120px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(chargeMaps || []).map((m) => (
                            <TableRow key={m.id}>
                              <TableCell>
                                <div className="text-sm font-semibold">{m.diagnosticItem?.name ?? m.diagnosticItemId}</div>
                                <div className="text-xs text-zc-muted font-mono">{m.diagnosticItem?.code ?? ""}</div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{m.chargeMasterId}</TableCell>
                              <TableCell>{m.price ?? "—"}</TableCell>
                              <TableCell>
                                {m.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                              </TableCell>
                            </TableRow>
                          ))}
                          {chargeMaps.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="py-10 text-center text-sm text-zc-muted">
                                No charge maps found.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Unmapped Items</CardTitle>
                    <CardDescription>Active diagnostic items without an active charge map.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {loading ? (
                      <div className="grid gap-2">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : unmapped.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zc-border p-3 text-sm text-zc-muted">
                        All active items appear mapped (or no items exist).
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {unmapped.slice(0, 30).map((u) => (
                          <div key={u.id} className="rounded-xl border border-zc-border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{u.name}</div>
                                <div className="text-xs text-zc-muted font-mono">{u.code}</div>
                                <div className="mt-1 flex gap-2">
                                  <Badge variant="outline">{u.kind}</Badge>
                                  {u.isPanel ? <Badge variant="accent">Panel</Badge> : <Badge variant="secondary">Single</Badge>}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                onClick={() => {
                                  setTab("items");
                                  setSelectedItemId(u.id);
                                  setDetailTab("charge");
                                  setMapOpen(true);
                                  setMapItemId(u.id);
                                }}
                              >
                                <Link2 className="h-4 w-4" />
                                Map
                              </Button>
                            </div>
                          </div>
                        ))}
                        {unmapped.length > 30 ? (
                          <div className="text-xs text-zc-muted">Showing 30 of {unmapped.length}. (Enhancement: paging)</div>
                        ) : null}
                      </div>
                    )}

                    <div className="rounded-xl border border-dashed border-zc-border p-3 text-sm text-zc-muted">
                      Skeleton note: next iteration can add paging, kind filter, and bulk mapping utilities.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
