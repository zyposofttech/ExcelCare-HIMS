"use client";

import * as React from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { RequirePerm } from "@/components/RequirePerm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type SupplierRow = {
  id: string;
  supplierCode: string;
  supplierName: string;
  gstin: string | null;
  drugLicenseNumber: string | null;
  drugLicenseExpiry: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  paymentTermsDays: number | null;
};

export default function SuppliersPage() {
  const { toast } = useToast();
  const { branchId } = useBranchContext();

  const { insights, loading: insightsLoading, dismiss: dismissInsight } = usePageInsights({
    module: "pharmacy-suppliers",
    enabled: !!branchId,
  });

  const [rows, setRows] = React.useState<SupplierRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<any>({});

  const load = React.useCallback(async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", "50");
      const data = await apiFetch(`/infrastructure/pharmacy/suppliers?${params}`);
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [branchId, search, statusFilter, page]);

  React.useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try {
      await apiFetch(`/infrastructure/pharmacy/suppliers`, {
        method: "POST",
        body: form,
      });
      setDialogOpen(false);
      setForm({});
      toast({ title: "Success", description: "Supplier created" });
      load();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  };

  const isLicenseExpiringSoon = (d: string | null) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff < 90;
  };

  return (
    <AppShell>
      <RequirePerm perm="INFRA_PHARMACY_SUPPLIER_READ">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Suppliers & Vendors</h1>
              <p className="text-sm text-muted-foreground">
                Manage pharmacy suppliers, licenses, and payment terms
              </p>
            </div>
            <RequirePerm perm="INFRA_PHARMACY_SUPPLIER_CREATE">
              <Button onClick={() => setDialogOpen(true)}>Add Supplier</Button>
            </RequirePerm>
          </div>

          {/* AI Insights Banner */}
          <PageInsightBanner insights={insights} loading={insightsLoading} onDismiss={dismissInsight} />

          {/* Filters */}
          <div className="flex gap-4">
            <Input
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Suppliers ({total})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground py-8 text-center">Loading...</p>
              ) : rows.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">No suppliers found</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>GSTIN</TableHead>
                        <TableHead>Drug License</TableHead>
                        <TableHead>License Expiry</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Payment Terms</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-sm">{r.supplierCode}</TableCell>
                          <TableCell className="font-medium">{r.supplierName}</TableCell>
                          <TableCell className="text-sm">{r.gstin || "—"}</TableCell>
                          <TableCell className="text-sm">{r.drugLicenseNumber || "—"}</TableCell>
                          <TableCell>
                            {r.drugLicenseExpiry ? (
                              <span className={isLicenseExpiringSoon(r.drugLicenseExpiry) ? "text-red-600 font-medium" : ""}>
                                {new Date(r.drugLicenseExpiry).toLocaleDateString()}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.contactPerson || "—"}
                            {r.phone && <span className="block text-muted-foreground">{r.phone}</span>}
                          </TableCell>
                          <TableCell>{r.paymentTermsDays ? `${r.paymentTermsDays} days` : "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={r.status === "ACTIVE" ? "default" : r.status === "BLACKLISTED" ? "destructive" : "secondary"}
                            >
                              {r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {Math.ceil(total / 50) || 1}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Create Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Supplier</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <Label>Supplier Name *</Label>
                  <Input value={form.supplierName ?? ""} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
                </div>
                <div>
                  <Label>GSTIN</Label>
                  <Input value={form.gstin ?? ""} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="15-digit GST number" />
                </div>
                <div>
                  <Label>Drug License Number</Label>
                  <Input value={form.drugLicenseNumber ?? ""} onChange={(e) => setForm({ ...form, drugLicenseNumber: e.target.value })} />
                </div>
                <div>
                  <Label>Drug License Expiry</Label>
                  <Input type="date" value={form.drugLicenseExpiry ?? ""} onChange={(e) => setForm({ ...form, drugLicenseExpiry: e.target.value })} />
                </div>
                <div>
                  <Label>Contact Person</Label>
                  <Input value={form.contactPerson ?? ""} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Payment Terms (days)</Label>
                    <Input type="number" value={form.paymentTermsDays ?? ""} onChange={(e) => setForm({ ...form, paymentTermsDays: Number(e.target.value) || undefined })} />
                  </div>
                  <div>
                    <Label>Delivery Lead Time (days)</Label>
                    <Input type="number" value={form.deliveryLeadTimeDays ?? ""} onChange={(e) => setForm({ ...form, deliveryLeadTimeDays: Number(e.target.value) || undefined })} />
                  </div>
                </div>
                <div>
                  <Label>Discount Terms</Label>
                  <Input value={form.discountTerms ?? ""} onChange={(e) => setForm({ ...form, discountTerms: e.target.value })} placeholder="e.g., 5% flat or slab-based" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!form.supplierName}>Create Supplier</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </RequirePerm>
    </AppShell>
  );
}
