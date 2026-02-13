"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLink as Link } from "@/components/app-link";
import { AppShell } from "@/components/AppShell";
import { RequirePerm } from "@/components/RequirePerm";
import { useBranchContext } from "@/lib/branch/useBranchContext";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  Check,
  Pencil,
  Building2,
  ShieldCheck,
  ToggleRight,
  GitBranch,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useAuthStore, hasPerm } from "@/lib/auth/store";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface PharmacistInCharge {
  id: string;
  empCode: string;
  name: string;
  designation: string;
}

interface ParentStore {
  id: string;
  storeCode: string;
  storeName: string;
}

interface ChildStore {
  id: string;
  storeCode: string;
  storeName: string;
  storeType: string;
  status: string;
}

interface DrugLicenseHistoryEntry {
  id: string;
  licenseNumber: string;
  validFrom: string;
  validTo: string;
  documentUrl: string | null;
  createdAt: string;
}

interface OperatingHours {
  [day: string]: { open: string; close: string } | null;
}

interface PharmacyStore {
  id: string;
  branchId: string;
  storeCode: string;
  storeName: string;
  storeType: string;
  status: string;
  parentStoreId: string | null;
  locationNodeId: string | null;
  pharmacistInCharge: PharmacistInCharge | null;
  parentStore: ParentStore | null;
  childStores: ChildStore[];
  drugLicenseNumber: string | null;
  drugLicenseExpiry: string | null;
  is24x7: boolean;
  canDispense: boolean;
  canIndent: boolean;
  canReceiveStock: boolean;
  canReturnVendor: boolean;
  operatingHours: OperatingHours | null;
  autoIndentEnabled: boolean;
  drugLicenseHistory: DrugLicenseHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

interface StoreListItem {
  id: string;
  storeCode: string;
  storeName: string;
  storeType: string;
}

const STORE_TYPES = [
  "MAIN",
  "IP_PHARMACY",
  "OP_PHARMACY",
  "EMERGENCY",
  "OT_STORE",
  "ICU_STORE",
  "WARD_STORE",
  "NARCOTICS",
] as const;

const STATUSES = ["ACTIVE", "INACTIVE", "UNDER_SETUP"] as const;

const TYPE_LABELS: Record<(typeof STORE_TYPES)[number], string> = {
  MAIN: "Main Store",
  IP_PHARMACY: "IP Pharmacy",
  OP_PHARMACY: "OP Pharmacy",
  EMERGENCY: "Emergency",
  OT_STORE: "OT Store",
  ICU_STORE: "ICU Store",
  WARD_STORE: "Ward Store",
  NARCOTICS: "Narcotics Vault",
};

const pillTones = {
  sky: "border-sky-200/70 bg-sky-50/70 text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-200",
  emerald:
    "border-emerald-200/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200",
  violet:
    "border-violet-200/70 bg-violet-50/70 text-violet-700 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-200",
  zinc: "border-zinc-200/70 bg-zinc-50/70 text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-900/30 dark:text-zinc-200",
  amber:
    "border-amber-200/70 bg-amber-50/70 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200",
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function storeTypeLabel(type: string): string {
  return TYPE_LABELS[type as keyof typeof TYPE_LABELS] ?? type.replace(/_/g, " ");
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-zinc-200 dark:bg-zinc-800", className)} />;
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={onCopy}
      className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-zc-muted hover:bg-zc-panel hover:text-zc-text transition-colors"
      title="Copy"
      type="button"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: number; tone: keyof typeof pillTones }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs", pillTones[tone])}>
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="opacity-90">{label}</span>
    </span>
  );
}

function InfoTile({
  label,
  value,
  className,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  tone?: "indigo" | "emerald" | "cyan" | "zinc" | "sky" | "violet" | "amber";
}) {
  const toneCls =
    tone === "indigo"
      ? "border-indigo-200/50 bg-indigo-50/40 dark:border-indigo-900/35 dark:bg-indigo-900/15"
      : tone === "emerald"
        ? "border-emerald-200/50 bg-emerald-50/40 dark:border-emerald-900/35 dark:bg-emerald-900/15"
        : tone === "cyan"
          ? "border-cyan-200/50 bg-cyan-50/40 dark:border-cyan-900/35 dark:bg-cyan-900/15"
          : "border-zc-border bg-zc-panel/15";

  return (
    <div className={cn("rounded-xl border p-4", toneCls, className)}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zc-muted">
        {icon ? <span className="text-zc-muted">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="mt-2">{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page Component                                                            */
/* -------------------------------------------------------------------------- */

export default function PharmacyStoreDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const branchCtx = useBranchContext();
  const { toast } = useToast();

  const [store, setStore] = useState<PharmacyStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState<string>("");

  /* -- Renewal dialog state -- */
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [renewalSaving, setRenewalSaving] = useState(false);
  const [renewalForm, setRenewalForm] = useState({
    licenseNumber: "",
    validFrom: "",
    validTo: "",
    documentUrl: "",
  });

  const authUser = useAuthStore((s) => s.user);
  const canUpdate = hasPerm(authUser, "INFRA_PHARMACY_STORE_UPDATE");

  const [allStores, setAllStores] = useState<StoreListItem[]>([]);

  /* -- Staff list for pharmacist selection -- */
  const [staffList, setStaffList] = useState<{ id: string; empCode: string; name: string; designation?: string | null }[]>(
    [],
  );

  /* -- Edit form state -- */
  const [editForm, setEditForm] = useState({
    storeCode: "",
    storeName: "",
    storeType: "",
    parentStoreId: "",
    locationNodeId: "",
    pharmacistInChargeId: "",
    drugLicenseNumber: "",
    drugLicenseExpiry: "",
    is24x7: false,
    canDispense: false,
    canIndent: false,
    canReceiveStock: false,
    canReturnVendor: false,
    autoIndentEnabled: false,
  });

  /* -- Fetch store detail -- */
  const fetchStore = useCallback(async (showToast = false) => {
    if (!branchCtx.branchId) return;
    setLoading(true);
    try {
      const data = await apiFetch<PharmacyStore>(
        `/infrastructure/pharmacy/stores/${id}`
      );
      setStore(data);
      if (showToast) {
        toast({ title: "Store refreshed", description: "Latest pharmacy store details loaded." });
      }
    } catch (err: any) {
      toast({
        title: "Error loading store",
        description: err?.message || "Failed to fetch pharmacy store details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, branchCtx.branchId, toast]);

  const fetchStaff = useCallback(async () => {
    if (!branchCtx.branchId) return;
    try {
      const data = await apiFetch<any>(`/infrastructure/staff?take=200`);
      const list = Array.isArray(data) ? data : data?.items ?? data?.rows ?? [];
      setStaffList(Array.isArray(list) ? list : []);
    } catch {}
  }, [branchCtx.branchId]);

  const fetchAllStores = useCallback(async () => {
    if (!branchCtx.branchId) return;
    try {
      const data = await apiFetch<{ rows: StoreListItem[] }>(`/infrastructure/pharmacy/stores?pageSize=200`);
      setAllStores(data.rows ?? []);
    } catch {}
  }, [branchCtx.branchId]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  useEffect(() => {
    if (store?.status) setStatusDraft(store.status);
  }, [store?.status]);

  /* -- Open edit dialog, pre-fill form -- */
  function openEditDialog() {
    if (!store) return;
    setEditForm({
      storeCode: store.storeCode,
      storeName: store.storeName,
      storeType: store.storeType,
      parentStoreId: store.parentStoreId ?? "",
      locationNodeId: store.locationNodeId ?? "",
      pharmacistInChargeId: store.pharmacistInCharge?.id ?? "",
      drugLicenseNumber: store.drugLicenseNumber ?? "",
      drugLicenseExpiry: store.drugLicenseExpiry
        ? store.drugLicenseExpiry.slice(0, 10)
        : "",
      is24x7: store.is24x7,
      canDispense: store.canDispense,
      canIndent: store.canIndent,
      canReceiveStock: store.canReceiveStock,
      canReturnVendor: store.canReturnVendor,
      autoIndentEnabled: store.autoIndentEnabled,
    });
    fetchAllStores();
    fetchStaff();
    setEditOpen(true);
  }

  /* -- Save edits -- */
  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        storeName: editForm.storeName,
        storeType: editForm.storeType,
        is24x7: editForm.is24x7,
        canDispense: editForm.canDispense,
        canIndent: editForm.canIndent,
        canReceiveStock: editForm.canReceiveStock,
        canReturnVendor: editForm.canReturnVendor,
        autoIndentEnabled: editForm.autoIndentEnabled,
      };
      if (editForm.storeType !== "MAIN" && editForm.parentStoreId) body.parentStoreId = editForm.parentStoreId;
      if (editForm.locationNodeId)
        body.locationNodeId = editForm.locationNodeId;
      if (editForm.pharmacistInChargeId)
        body.pharmacistInChargeId = editForm.pharmacistInChargeId;
      if (editForm.drugLicenseNumber)
        body.drugLicenseNumber = editForm.drugLicenseNumber;
      if (editForm.drugLicenseExpiry)
        body.drugLicenseExpiry = editForm.drugLicenseExpiry;

      await apiFetch(`/infrastructure/pharmacy/stores/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      toast({ title: "Store updated", description: "Changes saved successfully." });
      setEditOpen(false);
      fetchStore();
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Could not update store.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  /* -- Change status -- */
  async function handleStatusChange(newStatus: string) {
    if (!store || store.status === newStatus) return;
    setStatusChanging(true);
    try {
      await apiFetch(`/infrastructure/pharmacy/stores/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      toast({
        title: "Status updated",
        description: `Store status changed to ${newStatus}.`,
      });
      fetchStore();
    } catch (err: any) {
      toast({
        title: "Status change failed",
        description: err?.message || "Could not change store status.",
        variant: "destructive",
      });
    } finally {
      setStatusChanging(false);
    }
  }

  /* -- Save license renewal -- */
  async function handleSaveRenewal() {
    if (!renewalForm.licenseNumber || !renewalForm.validFrom || !renewalForm.validTo) {
      toast({
        title: "Validation error",
        description: "License Number, Valid From, and Valid To are required.",
        variant: "destructive",
      });
      return;
    }
    setRenewalSaving(true);
    try {
      const body: Record<string, unknown> = {
        licenseNumber: renewalForm.licenseNumber,
        validFrom: renewalForm.validFrom,
        validTo: renewalForm.validTo,
      };
      if (renewalForm.documentUrl) body.documentUrl = renewalForm.documentUrl;

      await apiFetch(`/infrastructure/pharmacy/stores/${id}/license-history`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      toast({ title: "Renewal added", description: "License renewal saved successfully." });
      setRenewalOpen(false);
      setRenewalForm({ licenseNumber: "", validFrom: "", validTo: "", documentUrl: "" });
      fetchStore();
    } catch (err: any) {
      toast({
        title: "Failed to add renewal",
        description: err?.message || "Could not save license renewal.",
        variant: "destructive",
      });
    } finally {
      setRenewalSaving(false);
    }
  }

  const capabilities = store
    ? [
        { label: "24x7 Operations", value: store.is24x7 },
        { label: "Can Dispense", value: store.canDispense },
        { label: "Can Indent", value: store.canIndent },
        { label: "Can Receive Stock", value: store.canReceiveStock },
        { label: "Can Return to Vendor", value: store.canReturnVendor },
        { label: "Auto Indent Enabled", value: store.autoIndentEnabled },
      ]
    : [];

  const enabledCapabilities = capabilities.filter((c) => c.value).length;

  const statusTone =
    store?.status === "ACTIVE" ? pillTones.emerald : store?.status === "UNDER_SETUP" ? pillTones.amber : pillTones.zinc;

  const statusToneFor = (value: string) =>
    value === "ACTIVE" ? pillTones.emerald : value === "UNDER_SETUP" ? pillTones.amber : pillTones.zinc;

  const statusActionVariant = store?.status === "ACTIVE" ? "warning" : store?.status === "INACTIVE" ? "success" : "warning";

  /* -------------------------------------------------------------------------- */
  /*  Render                                                                    */
  /* -------------------------------------------------------------------------- */

  return (
    <AppShell title="Pharmacy Store Detail">
      <RequirePerm perm="INFRA_PHARMACY_STORE_READ">
        <div className="grid gap-6">
          {/* Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <Button variant="outline" className="h-10" onClick={() => router.back()}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <span className="grid h-10 w-10 place-items-center rounded-2xl border border-indigo-200/60 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-900/20">
                  <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                </span>

                <div className="min-w-0">
                  <div className="text-sm text-zc-muted">
                    <Link href="/infrastructure/pharmacy/stores" className="hover:underline">
                      Pharmacy Stores
                    </Link>
                    <span className="mx-2 text-zc-muted/60">/</span>
                    <span className="text-zc-text">Details</span>
                  </div>

                  <div className="mt-1 text-3xl font-semibold tracking-tight">
                    {loading ? <Skeleton className="h-9 w-64" /> : store?.storeName ?? "Store Detail"}
                  </div>

                  {!loading && store ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zc-muted">
                      <span className="rounded-md border border-zc-border bg-zc-panel/25 px-2 py-0.5 font-mono text-[12px] text-zc-text">
                        {store.storeCode}
                      </span>
                      <span className="text-zc-muted/60">|</span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-4 w-4" /> {storeTypeLabel(store.storeType)}
                      </span>
                      <span className="text-zc-muted/60">|</span>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border", statusTone)}>
                        {store.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  ) : loading ? (
                    <div className="mt-2 flex gap-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={() => fetchStore(true)} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
                Refresh
              </Button>

              {canUpdate && store ? (
                <>
                  <Button variant="info" className="gap-2" onClick={openEditDialog}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant={statusActionVariant}
                    className="gap-2"
                    onClick={() => setStatusOpen(true)}
                    disabled={statusChanging}
                  >
                    Change Status
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {/* Snapshot */}
          <Card className="overflow-hidden">
            <CardHeader className="py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base">Snapshot</CardTitle>
                  <CardDescription>Status, licensing, and identifiers.</CardDescription>
                </div>
                {!loading && store ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <MetricPill label="Capabilities" value={enabledCapabilities} tone="emerald" />
                    <MetricPill label="Child Stores" value={store.childStores.length} tone="sky" />
                    <MetricPill label="Renewals" value={store.drugLicenseHistory.length} tone="violet" />
                  </div>
                ) : (
                  <div className="text-sm text-zc-muted">--</div>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pb-6 pt-6">
              {loading ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              ) : store ? (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <InfoTile
                      label="Store ID"
                      icon={<ClipboardList className="h-4 w-4" />}
                      tone="zinc"
                      value={
                        <div className="flex items-center">
                          <span className="font-mono text-xs break-all">{store.id}</span>
                          <CopyButton text={store.id} />
                        </div>
                      }
                    />
                    <InfoTile
                      label="Code"
                      icon={<Building2 className="h-4 w-4" />}
                      tone="indigo"
                      value={<span className="font-mono text-sm font-semibold">{store.storeCode}</span>}
                    />
                    <InfoTile
                      label="Type"
                      icon={<ToggleRight className="h-4 w-4" />}
                      tone="emerald"
                      value={<span className="text-sm font-semibold">{storeTypeLabel(store.storeType)}</span>}
                    />
                    <InfoTile
                      label="Status"
                      icon={<ShieldCheck className="h-4 w-4" />}
                      tone="zinc"
                      value={
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]", statusTone)}>
                          {store.status.replace(/_/g, " ")}
                        </span>
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <InfoTile
                      label="License Number"
                      icon={<FileText className="h-4 w-4" />}
                      tone="zinc"
                      value={
                        store.drugLicenseNumber ? (
                          <div className="flex items-center">
                            <span className="font-mono text-sm font-semibold">{store.drugLicenseNumber}</span>
                            <CopyButton text={store.drugLicenseNumber} />
                          </div>
                        ) : (
                          <span className="text-sm text-zc-muted">-</span>
                        )
                      }
                    />
                    <InfoTile
                      label="License Expiry"
                      icon={<ShieldCheck className="h-4 w-4" />}
                      tone="indigo"
                      value={<span className="text-sm font-semibold">{formatDate(store.drugLicenseExpiry)}</span>}
                    />
                    <InfoTile
                      label="Pharmacist"
                      icon={<ClipboardList className="h-4 w-4" />}
                      tone="cyan"
                      value={
                        store.pharmacistInCharge ? (
                          <div className="text-sm">
                            <div className="font-semibold">{store.pharmacistInCharge.name}</div>
                            <div className="text-xs text-zc-muted">{store.pharmacistInCharge.empCode}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-zc-muted">-</span>
                        )
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <InfoTile
                      label="Parent Store"
                      icon={<GitBranch className="h-4 w-4" />}
                      tone="zinc"
                      value={
                        store.parentStore ? (
                          <Link
                            href={`/infrastructure/pharmacy/stores/${store.parentStore.id}`}
                            className="text-sm font-semibold text-indigo-600 hover:underline"
                          >
                            {store.parentStore.storeName} ({store.parentStore.storeCode})
                          </Link>
                        ) : (
                          <span className="text-sm text-zc-muted">Top-level store</span>
                        )
                      }
                    />
                    <InfoTile
                      label="Created"
                      icon={<ClipboardList className="h-4 w-4" />}
                      tone="zinc"
                      value={<span className="text-sm font-semibold">{formatDateTime(store.createdAt)}</span>}
                    />
                    <InfoTile
                      label="Last Updated"
                      icon={<ClipboardList className="h-4 w-4" />}
                      tone="zinc"
                      value={<span className="text-sm font-semibold">{formatDateTime(store.updatedAt)}</span>}
                    />
                  </div>
                </>
              ) : (
                <div className="text-sm text-zc-muted">No data.</div>
              )}
            </CardContent>
          </Card>

          {loading ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-64 lg:col-span-2" />
              <Skeleton className="h-64" />
            </div>
          ) : store ? (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2 overflow-hidden">
                  <CardHeader>
                    <CardTitle>Store Profile</CardTitle>
                    <CardDescription>Identity, assignments, and lifecycle details.</CardDescription>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-zc-muted">
                        Identity
                      </div>
                      <InfoTile
                        label="Store Name"
                        value={<span className="text-sm font-semibold">{store.storeName}</span>}
                      />
                      <InfoTile
                        label="Store Code"
                        value={<span className="font-mono text-sm font-semibold">{store.storeCode}</span>}
                        tone="indigo"
                      />
                      <InfoTile
                        label="Store Type"
                        value={<span className="text-sm font-semibold">{storeTypeLabel(store.storeType)}</span>}
                        tone="emerald"
                      />
                      <InfoTile
                        label="Status"
                        value={
                          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]", statusTone)}>
                            {store.status.replace(/_/g, " ")}
                          </span>
                        }
                        tone="zinc"
                      />

                      <div className="md:col-span-2 pt-2 text-xs font-semibold uppercase tracking-wide text-zc-muted">
                        Assignments
                      </div>
                      <InfoTile
                        label="Pharmacist In Charge"
                        value={
                          store.pharmacistInCharge ? (
                            <div className="text-sm">
                              <div className="font-semibold">{store.pharmacistInCharge.name}</div>
                              <div className="text-xs text-zc-muted">
                                {store.pharmacistInCharge.empCode}
                                {store.pharmacistInCharge.designation ? ` - ${store.pharmacistInCharge.designation}` : ""}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-zc-muted">-</span>
                          )
                        }
                        className="md:col-span-2"
                        tone="cyan"
                      />
                      <InfoTile
                        label="Parent Store"
                        value={
                          store.parentStore ? (
                            <Link
                              href={`/infrastructure/pharmacy/stores/${store.parentStore.id}`}
                              className="text-sm font-semibold text-indigo-600 hover:underline"
                            >
                              {store.parentStore.storeName} ({store.parentStore.storeCode})
                            </Link>
                          ) : (
                            <span className="text-sm text-zc-muted">Top-level store</span>
                          )
                        }
                        className="md:col-span-2"
                        tone="zinc"
                      />

                      <div className="md:col-span-2 pt-2 text-xs font-semibold uppercase tracking-wide text-zc-muted">
                        Audit
                      </div>
                      <InfoTile
                        label="Created"
                        value={<span className="text-sm font-semibold">{formatDateTime(store.createdAt)}</span>}
                      />
                      <InfoTile
                        label="Last Updated"
                        value={<span className="text-sm font-semibold">{formatDateTime(store.updatedAt)}</span>}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>License & Compliance</CardTitle>
                    <CardDescription>Drug license readiness and compliance tracking.</CardDescription>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-6">
                    <div className="grid gap-4">
                      <InfoTile
                        label="Drug License Number"
                        value={
                          store.drugLicenseNumber ? (
                            <div className="flex items-center">
                              <span className="font-mono text-sm font-semibold">{store.drugLicenseNumber}</span>
                              <CopyButton text={store.drugLicenseNumber} />
                            </div>
                          ) : (
                            <span className="text-sm text-zc-muted">-</span>
                          )
                        }
                        icon={<FileText className="h-4 w-4" />}
                        tone="zinc"
                      />
                      <InfoTile
                        label="License Expiry"
                        value={<span className="text-sm font-semibold">{formatDate(store.drugLicenseExpiry)}</span>}
                        icon={<ShieldCheck className="h-4 w-4" />}
                        tone="indigo"
                      />
                      <InfoTile
                        label="Renewals"
                        value={<span className="text-sm font-semibold">{store.drugLicenseHistory.length}</span>}
                        icon={<ClipboardList className="h-4 w-4" />}
                        tone="emerald"
                      />
                      <InfoTile
                        label="Auto Indent"
                        value={<span className="text-sm font-semibold">{store.autoIndentEnabled ? "Enabled" : "Disabled"}</span>}
                        icon={<ToggleRight className="h-4 w-4" />}
                        tone="zinc"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>Capabilities</CardTitle>
                    <CardDescription>Operational switches (read-only).</CardDescription>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {capabilities.map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-sm">{label}</span>
                          <Switch checked={value} disabled />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>Store Hierarchy</CardTitle>
                    <CardDescription>Parent-child relationships for this store.</CardDescription>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Parent Store</div>
                        {store.parentStore ? (
                          <Link
                            href={`/infrastructure/pharmacy/stores/${store.parentStore.id}`}
                            className="mt-2 inline-flex text-sm font-semibold text-indigo-600 hover:underline"
                          >
                            {store.parentStore.storeName} ({store.parentStore.storeCode})
                          </Link>
                        ) : (
                          <div className="mt-2 text-sm text-zc-muted">Top-level store</div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">
                          Child Stores ({store.childStores.length})
                        </div>
                        {store.childStores.length === 0 ? (
                          <div className="mt-2 text-sm text-zc-muted">No child stores</div>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {store.childStores.map((child) => (
                              <div
                                key={child.id}
                                className="flex items-center justify-between rounded-xl border border-zc-border bg-zc-panel/15 px-3 py-2"
                              >
                                <div>
                                  <Link
                                    href={`/infrastructure/pharmacy/stores/${child.id}`}
                                    className="text-sm font-semibold text-indigo-600 hover:underline"
                                  >
                                    {child.storeName}
                                  </Link>
                                  <div className="text-xs text-zc-muted">
                                    {child.storeCode} &middot; {storeTypeLabel(child.storeType)}
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
                                    statusToneFor(child.status),
                                  )}
                                >
                                  {child.status.replace(/_/g, " ")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {store.operatingHours ? (
                  <Card className="overflow-hidden">
                    <CardHeader>
                      <CardTitle>Operating Hours</CardTitle>
                      <CardDescription>Daily operating schedule.</CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-6">
                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                        {Object.entries(store.operatingHours).map(([day, hours]) => (
                          <div
                            key={day}
                            className="flex items-center justify-between rounded-xl border border-zc-border bg-zc-panel/15 px-3 py-2"
                          >
                            <span className="text-sm font-medium capitalize">{day}</span>
                            <span className="text-sm text-zc-muted">
                              {hours ? `${hours.open} - ${hours.close}` : "Closed"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>

              <Card className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">License History</CardTitle>
                      <CardDescription>Historical drug license renewals for this store.</CardDescription>
                    </div>
                    {canUpdate ? (
                      <Button size="sm" className="gap-2" onClick={() => setRenewalOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Add Renewal
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-6">
                  {store.drugLicenseHistory.length === 0 ? (
                    <p className="text-sm text-zc-muted py-6 text-center">No license history records found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="py-2 pr-4 text-left font-medium text-zc-muted">License Number</th>
                            <th className="py-2 pr-4 text-left font-medium text-zc-muted">Valid From</th>
                            <th className="py-2 pr-4 text-left font-medium text-zc-muted">Valid To</th>
                            <th className="py-2 pr-4 text-left font-medium text-zc-muted">Document</th>
                            <th className="py-2 text-left font-medium text-zc-muted">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {store.drugLicenseHistory.map((entry) => (
                            <tr key={entry.id} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-medium">{entry.licenseNumber}</td>
                              <td className="py-2 pr-4">{formatDate(entry.validFrom)}</td>
                              <td className="py-2 pr-4">{formatDate(entry.validTo)}</td>
                              <td className="py-2 pr-4">
                                {entry.documentUrl ? (
                                  <a
                                    href={entry.documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 underline-offset-4 hover:underline"
                                  >
                                    View
                                  </a>
                                ) : (
                                  <span className="text-zc-muted">-</span>
                                )}
                              </td>
                              <td className="py-2">{formatDateTime(entry.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}

          {/* ---- Not found state ---- */}
          {!loading && !store && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-zc-muted mb-4">
                  Pharmacy store not found.
                </p>
                <Link href="/infrastructure/pharmacy/stores">
                  <Button variant="outline">Back to Stores</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* ================================================================ */}
          {/*  Status Dialog                                                   */}
          {/* ================================================================ */}
          <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Change Store Status</DialogTitle>
                <DialogDescription>Select a new status for this pharmacy store.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="status-select">Status</Label>
                  <Select value={statusDraft} onValueChange={setStatusDraft}>
                    <SelectTrigger id="status-select">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!store?.pharmacistInCharge ? (
                  <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                    A pharmacist in charge is required before activating the store.
                  </div>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setStatusOpen(false)} disabled={statusChanging}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    await handleStatusChange(statusDraft);
                    setStatusOpen(false);
                  }}
                  disabled={statusChanging || !statusDraft || statusDraft === store?.status}
                >
                  {statusChanging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ================================================================ */}
          {/*  Edit Dialog                                                     */}
          {/* ================================================================ */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className={drawerClassName()} onInteractOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                    <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  Edit Pharmacy Store
                </DialogTitle>
                <DialogDescription>
                  Update store location, type, licensing and operational capabilities.
                </DialogDescription>
              </DialogHeader>

              <Separator className="my-4" />

              <div className="grid gap-6">
                {/* Basics */}
                <div className="grid gap-3">
                  <div className="text-sm font-semibold text-zc-text">Basics</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Store Code *</Label>
                      <Input value={editForm.storeCode} className="font-mono" disabled />
                    </div>

                    <div className="grid gap-2">
                      <Label>Store Type *</Label>
                      <Select
                        value={editForm.storeType}
                        onValueChange={(v) =>
                          setEditForm((f) => ({
                            ...f,
                            storeType: v,
                            parentStoreId: v === "MAIN" ? "" : f.parentStoreId,
                          }))
                        }
                      >
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {STORE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Store Name *</Label>
                    <Input
                      value={editForm.storeName}
                      onChange={(e) => setEditForm((f) => ({ ...f, storeName: e.target.value }))}
                      placeholder="e.g., Main Pharmacy Store"
                    />
                  </div>

                  {editForm.storeType !== "MAIN" ? (
                    <div className="grid gap-2">
                      <Label>Parent Store</Label>
                      <Select
                        value={editForm.parentStoreId}
                        onValueChange={(v) => setEditForm((f) => ({ ...f, parentStoreId: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select parent store" /></SelectTrigger>
                        <SelectContent>
                          {allStores
                            .filter((s) => s.id !== store?.id)
                            .filter((s) => s.storeType === "MAIN" || s.id !== editForm.parentStoreId)
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.storeCode} - {s.storeName}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div className="grid gap-2">
                    <Label>Pharmacist In Charge</Label>
                    <Select
                      value={editForm.pharmacistInChargeId}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, pharmacistInChargeId: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select pharmacist" /></SelectTrigger>
                      <SelectContent>
                        {staffList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.empCode} - {s.name}{s.designation ? ` (${s.designation})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-zc-muted">Required to activate the store. A pharmacist must be assigned before the store can go live.</p>
                  </div>
                </div>

                <Separator />

                {/* Licensing */}
                <div className="grid gap-3">
                  <div className="text-sm font-semibold text-zc-text">Licensing</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Drug License Number</Label>
                      <Input
                        value={editForm.drugLicenseNumber}
                        onChange={(e) => setEditForm((f) => ({ ...f, drugLicenseNumber: e.target.value }))}
                        placeholder="License number"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Drug License Expiry</Label>
                      <Input
                        type="date"
                        value={editForm.drugLicenseExpiry}
                        onChange={(e) => setEditForm((f) => ({ ...f, drugLicenseExpiry: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Capabilities */}
                <div className="grid gap-3">
                  <div className="text-sm font-semibold text-zc-text">Capabilities</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between rounded-xl border border-zc-border bg-zc-panel/20 p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zc-text">24x7 Operation</div>
                        <div className="text-xs text-zc-muted">Store operates round the clock.</div>
                      </div>
                      <Switch checked={editForm.is24x7} onCheckedChange={(v) => setEditForm((f) => ({ ...f, is24x7: v }))} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-zc-border bg-zc-panel/20 p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zc-text">Can Dispense</div>
                        <div className="text-xs text-zc-muted">Dispense drugs to patients.</div>
                      </div>
                      <Switch checked={editForm.canDispense} onCheckedChange={(v) => setEditForm((f) => ({ ...f, canDispense: v }))} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-zc-border bg-zc-panel/20 p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zc-text">Can Indent</div>
                        <div className="text-xs text-zc-muted">Raise indent requests to parent.</div>
                      </div>
                      <Switch checked={editForm.canIndent} onCheckedChange={(v) => setEditForm((f) => ({ ...f, canIndent: v }))} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-zc-border bg-zc-panel/20 p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zc-text">Can Receive Stock</div>
                        <div className="text-xs text-zc-muted">Receive GRN from suppliers.</div>
                      </div>
                      <Switch checked={editForm.canReceiveStock} onCheckedChange={(v) => setEditForm((f) => ({ ...f, canReceiveStock: v }))} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-zc-border bg-zc-panel/20 p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zc-text">Can Return to Vendor</div>
                        <div className="text-xs text-zc-muted">Process vendor returns.</div>
                      </div>
                      <Switch checked={editForm.canReturnVendor} onCheckedChange={(v) => setEditForm((f) => ({ ...f, canReturnVendor: v }))} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-zc-border bg-zc-panel/20 p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zc-text">Auto-Indent</div>
                        <div className="text-xs text-zc-muted">Auto-raise indents on low stock.</div>
                      </div>
                      <Switch checked={editForm.autoIndentEnabled} onCheckedChange={(v) => setEditForm((f) => ({ ...f, autoIndentEnabled: v }))} />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={saving || !canUpdate}
                    className="gap-2"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save Changes
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ================================================================ */}
          {/*  Renewal Dialog                                                  */}
          {/* ================================================================ */}
          <Dialog open={renewalOpen} onOpenChange={setRenewalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add License Renewal</DialogTitle>
                <DialogDescription>
                  Record a new drug license renewal for this store.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="renewal-licenseNumber">License Number</Label>
                  <Input
                    id="renewal-licenseNumber"
                    value={renewalForm.licenseNumber}
                    onChange={(e) =>
                      setRenewalForm((f) => ({ ...f, licenseNumber: e.target.value }))
                    }
                    placeholder="e.g. DL-2025-67890"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="renewal-validFrom">Valid From</Label>
                  <Input
                    id="renewal-validFrom"
                    type="date"
                    value={renewalForm.validFrom}
                    onChange={(e) =>
                      setRenewalForm((f) => ({ ...f, validFrom: e.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="renewal-validTo">Valid To</Label>
                  <Input
                    id="renewal-validTo"
                    type="date"
                    value={renewalForm.validTo}
                    onChange={(e) =>
                      setRenewalForm((f) => ({ ...f, validTo: e.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="renewal-documentUrl">
                    Document URL (optional)
                  </Label>
                  <Input
                    id="renewal-documentUrl"
                    value={renewalForm.documentUrl}
                    onChange={(e) =>
                      setRenewalForm((f) => ({ ...f, documentUrl: e.target.value }))
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setRenewalOpen(false)}
                  disabled={renewalSaving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveRenewal} disabled={renewalSaving}>
                  {renewalSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </RequirePerm>
    </AppShell>
  );
}

