"use client";

import * as React from "react";
import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { RequirePerm } from "@/components/RequirePerm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

import { apiFetch } from "@/lib/api";
import { useBranchContext } from "@/lib/branch/useBranchContext";
import { usePageInsights } from "@/lib/copilot/usePageInsights";
import { PageInsightBanner } from "@/components/copilot/PageInsightBanner";
import { useFieldCopilot } from "@/lib/copilot/useFieldCopilot";
import { AIFieldWrapper } from "@/components/copilot/AIFieldWrapper";

/* -------------------------------- Types -------------------------------- */

type StoreType =
  | "MAIN"
  | "IP_PHARMACY"
  | "OP_PHARMACY"
  | "EMERGENCY"
  | "OT_STORE"
  | "ICU_STORE"
  | "WARD_STORE"
  | "NARCOTICS";

type StoreStatus = "ACTIVE" | "INACTIVE" | "UNDER_SETUP";

type StoreRow = {
  id: string;
  storeCode: string;
  storeName: string;
  storeType: StoreType;
  status: StoreStatus;
  parentStore?: { id: string; storeCode: string; storeName: string } | null;
  pharmacistInCharge?: { id: string; empCode: string; name: string } | null;
  is24x7: boolean;
  canDispense: boolean;
  createdAt: string;
};

/* ------------------------------- Constants ------------------------------ */

const STORE_TYPES: StoreType[] = [
  "MAIN", "IP_PHARMACY", "OP_PHARMACY", "EMERGENCY",
  "OT_STORE", "ICU_STORE", "WARD_STORE", "NARCOTICS",
];

const TYPE_LABELS: Record<StoreType, string> = {
  MAIN: "Main Store",
  IP_PHARMACY: "IP Pharmacy",
  OP_PHARMACY: "OP Pharmacy",
  EMERGENCY: "Emergency",
  OT_STORE: "OT Store",
  ICU_STORE: "ICU Store",
  WARD_STORE: "Ward Store",
  NARCOTICS: "Narcotics Vault",
};

const STATUS_VARIANT: Record<StoreStatus, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  INACTIVE: "secondary",
  UNDER_SETUP: "outline",
};

/* -------------------------------- Page --------------------------------- */

export default function PharmacyStoresPage() {
  const { toast } = useToast();
  const { branchId } = useBranchContext();

  const { insights, loading: insightsLoading, dismiss: dismissInsight } = usePageInsights({
    module: "pharmacy-stores",
    enabled: !!branchId,
  });

  const [stores, setStores] = React.useState<StoreRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [filterType, setFilterType] = React.useState<string>("");
  const [filterStatus, setFilterStatus] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const pageSize = 25;

  // Create dialog
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [allStores, setAllStores] = React.useState<StoreRow[]>([]);
  const [form, setForm] = React.useState<any>({});
  const [saving, setSaving] = React.useState(false);

  const storeCodeCopilot = useFieldCopilot({
    module: "pharmacy-store",
    field: "storeCode",
    value: form.storeCode ?? "",
    enabled: !!branchId && dialogOpen,
  });
  const storeNameCopilot = useFieldCopilot({
    module: "pharmacy-store",
    field: "storeName",
    value: form.storeName ?? "",
    enabled: !!branchId && dialogOpen,
  });

  const load = React.useCallback(async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search) params.set("q", search);
      if (filterType) params.set("storeType", filterType);
      if (filterStatus) params.set("status", filterStatus);

      const data = await apiFetch(`/infrastructure/pharmacy/stores?${params}`);
      setStores(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [branchId, page, search, filterType, filterStatus]);

  React.useEffect(() => { load(); }, [load]);

  const loadAllStores = React.useCallback(async () => {
    if (!branchId) return;
    try {
      const data = await apiFetch(`/infrastructure/pharmacy/stores?pageSize=200`);
      setAllStores(data.rows ?? []);
    } catch {}
  }, [branchId]);

  const openCreate = () => {
    setForm({ storeType: "OP_PHARMACY", is24x7: false, canDispense: false, canIndent: true, canReceiveStock: false, canReturnVendor: false, autoIndentEnabled: false });
    loadAllStores();
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      await apiFetch(`/infrastructure/pharmacy/stores`, {
        method: "POST",
        body: form,
      });
      setDialogOpen(false);
      setForm({});
      toast({ title: "Success", description: "Pharmacy store created" });
      load();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <AppShell>
      <RequirePerm perm="INFRA_PHARMACY_STORE_READ">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Pharmacy Stores</h1>
              <p className="text-sm text-muted-foreground">
                Manage pharmacy store locations, types, licensing, and operational status
              </p>
            </div>
            <RequirePerm perm="INFRA_PHARMACY_STORE_CREATE">
              <Button onClick={openCreate}>Add Store</Button>
            </RequirePerm>
          </div>

          {/* AI Insights Banner */}
          <PageInsightBanner insights={insights} loading={insightsLoading} onDismiss={dismissInsight} />

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search stores..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-64"
            />
            <Select value={filterType} onValueChange={(v) => { setFilterType(v === "ALL" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                {STORE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v === "ALL" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="UNDER_SETUP">Under Setup</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => load()}>Refresh</Button>
          </div>

          {/* Store Table */}
          <Card>
            <CardHeader>
              <CardTitle>Stores ({total})</CardTitle>
              <CardDescription>All pharmacy stores configured for this branch</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground py-8 text-center">Loading...</p>
              ) : stores.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No stores found. Create your first pharmacy store.
                </p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Parent</TableHead>
                        <TableHead>Pharmacist</TableHead>
                        <TableHead>24x7</TableHead>
                        <TableHead>Dispense</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stores.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-sm">{s.storeCode}</TableCell>
                          <TableCell className="font-medium">{s.storeName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{TYPE_LABELS[s.storeType] ?? s.storeType}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.parentStore ? `${s.parentStore.storeCode} — ${s.parentStore.storeName}` : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {s.pharmacistInCharge?.name ?? "—"}
                          </TableCell>
                          <TableCell>{s.is24x7 ? "Yes" : "No"}</TableCell>
                          <TableCell>{s.canDispense ? "Yes" : "No"}</TableCell>
                          <TableCell>
                            <Link href={`/infrastructure/pharmacy/stores/${s.id}` as any}>
                              <Button size="sm" variant="outline">View</Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-sm text-muted-foreground">
                        Page {page} of {totalPages} ({total} total)
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                          Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Create Store Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Pharmacy Store</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Store Code *</Label>
                  <AIFieldWrapper warnings={storeCodeCopilot.warnings} suggestion={storeCodeCopilot.suggestion} validating={storeCodeCopilot.validating}>
                    <Input
                      value={form.storeCode ?? ""}
                      onChange={(e) => setForm({ ...form, storeCode: e.target.value })}
                      placeholder="e.g., PH-MAIN-01"
                    />
                  </AIFieldWrapper>
                </div>
                <div>
                  <Label>Store Name *</Label>
                  <AIFieldWrapper warnings={storeNameCopilot.warnings} suggestion={storeNameCopilot.suggestion} validating={storeNameCopilot.validating}>
                    <Input
                      value={form.storeName ?? ""}
                      onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                      placeholder="e.g., Main Pharmacy Store"
                    />
                  </AIFieldWrapper>
                </div>
                <div>
                  <Label>Store Type *</Label>
                  <Select
                    value={form.storeType ?? ""}
                    onValueChange={(v) => setForm({ ...form, storeType: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {STORE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.storeType !== "MAIN" && (
                  <div>
                    <Label>Parent Store</Label>
                    <Select
                      value={form.parentStoreId ?? ""}
                      onValueChange={(v) => setForm({ ...form, parentStoreId: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select parent store" /></SelectTrigger>
                      <SelectContent>
                        {allStores
                          .filter((s) => s.storeType === "MAIN" || s.id !== form.parentStoreId)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.storeCode} — {s.storeName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Drug License Number</Label>
                  <Input
                    value={form.drugLicenseNumber ?? ""}
                    onChange={(e) => setForm({ ...form, drugLicenseNumber: e.target.value })}
                    placeholder="License number"
                  />
                </div>
                <div>
                  <Label>Drug License Expiry</Label>
                  <Input
                    type="date"
                    value={form.drugLicenseExpiry ?? ""}
                    onChange={(e) => setForm({ ...form, drugLicenseExpiry: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.is24x7 ?? false}
                      onCheckedChange={(v) => setForm({ ...form, is24x7: v })}
                    />
                    <Label>24x7 Operation</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.canDispense ?? false}
                      onCheckedChange={(v) => setForm({ ...form, canDispense: v })}
                    />
                    <Label>Can Dispense</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.canIndent ?? true}
                      onCheckedChange={(v) => setForm({ ...form, canIndent: v })}
                    />
                    <Label>Can Indent</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.canReceiveStock ?? false}
                      onCheckedChange={(v) => setForm({ ...form, canReceiveStock: v })}
                    />
                    <Label>Can Receive Stock</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.canReturnVendor ?? false}
                      onCheckedChange={(v) => setForm({ ...form, canReturnVendor: v })}
                    />
                    <Label>Can Return to Vendor</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.autoIndentEnabled ?? false}
                      onCheckedChange={(v) => setForm({ ...form, autoIndentEnabled: v })}
                    />
                    <Label>Auto-Indent</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleCreate}
                  disabled={saving || !form.storeCode || !form.storeName || !form.storeType}
                >
                  {saving ? "Creating..." : "Create Store"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </RequirePerm>
    </AppShell>
  );
}
