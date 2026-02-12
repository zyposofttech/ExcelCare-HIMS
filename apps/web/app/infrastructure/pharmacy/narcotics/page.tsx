"use client";

import * as React from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api";
import { useBranchContext } from "@/lib/branch/useBranchContext";

type RegisterEntry = {
  id: string;
  transactionType: string;
  quantity: number;
  batchNumber: string | null;
  balanceBefore: number;
  balanceAfter: number;
  witnessName: string | null;
  notes: string | null;
  createdAt: string;
  drugMaster?: { drugCode: string; genericName: string };
  pharmacyStore?: { storeCode: string; storeName: string };
};

type StoreOption = { id: string; storeCode: string; storeName: string; storeType: string };

export default function NarcoticsPage() {
  const { toast } = useToast();
  const { branchId } = useBranchContext();

  const [entries, setEntries] = React.useState<RegisterEntry[]>([]);
  const [stores, setStores] = React.useState<StoreOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [selectedStore, setSelectedStore] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<any>({});

  const narcoticsVault = stores.find((s) => s.storeType === "NARCOTICS");

  React.useEffect(() => {
    if (!branchId) return;
    apiFetch(`/infrastructure/pharmacy/stores?pageSize=200`)
      .then((data) => {
        const list = data.rows ?? [];
        setStores(list);
        const vault = list.find((s: any) => s.storeType === "NARCOTICS");
        if (vault) setSelectedStore(vault.id);
        else if (list.length > 0) setSelectedStore(list[0].id);
      })
      .catch(() => {});
  }, [branchId]);

  const loadRegister = React.useCallback(async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("storeId", selectedStore);
      params.set("page", String(page));
      params.set("pageSize", "50");
      const data = await apiFetch(`/infrastructure/pharmacy/narcotics-register?${params}`);
      setEntries(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedStore, page]);

  React.useEffect(() => { loadRegister(); }, [loadRegister]);

  const handleCreate = async () => {
    try {
      await apiFetch(`/infrastructure/pharmacy/narcotics-register`, {
        method: "POST",
        body: { ...form, pharmacyStoreId: selectedStore },
      });
      setDialogOpen(false);
      setForm({});
      toast({ title: "Success", description: "Narcotics register entry added" });
      loadRegister();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  };

  const txBadge = (type: string) => {
    switch (type) {
      case "RECEIPT": return <Badge className="bg-green-600">Receipt</Badge>;
      case "ISSUE": return <Badge className="bg-blue-600">Issue</Badge>;
      case "WASTAGE": return <Badge variant="destructive">Wastage</Badge>;
      case "ADJUSTMENT": return <Badge variant="outline">Adjustment</Badge>;
      default: return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <AppShell>
      <RequirePerm perm="INFRA_PHARMACY_NARCOTICS_READ">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Narcotics & Controlled Substances</h1>
              <p className="text-sm text-muted-foreground">
                Digital narcotics register — immutable transaction log for NDPS compliance
              </p>
            </div>
            <RequirePerm perm="INFRA_PHARMACY_NARCOTICS_UPDATE">
              <Button onClick={() => setDialogOpen(true)}>Add Entry</Button>
            </RequirePerm>
          </div>

          {!narcoticsVault && (
            <Card className="border-yellow-500 bg-yellow-50">
              <CardContent className="py-4">
                <p className="text-yellow-800 font-medium">
                  No Narcotics Vault store configured. Create a store with type "NARCOTICS" first.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-4 items-end">
            <div>
              <Label>Store</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.storeCode} — {s.storeName}
                      {s.storeType === "NARCOTICS" ? " (Vault)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Narcotics Register ({total} entries)</CardTitle>
              <CardDescription>
                All entries are immutable and form part of the regulatory audit trail
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground py-8 text-center">Loading...</p>
              ) : entries.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">No register entries found</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Drug</TableHead>
                        <TableHead>Transaction</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Balance Before</TableHead>
                        <TableHead>Balance After</TableHead>
                        <TableHead>Witness</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm">{new Date(e.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{e.drugMaster?.drugCode}</span>
                            <span className="block text-sm">{e.drugMaster?.genericName}</span>
                          </TableCell>
                          <TableCell>{txBadge(e.transactionType)}</TableCell>
                          <TableCell className="font-mono">{e.quantity}</TableCell>
                          <TableCell className="text-sm">{e.batchNumber || "—"}</TableCell>
                          <TableCell className="font-mono">{e.balanceBefore}</TableCell>
                          <TableCell className="font-mono">{e.balanceAfter}</TableCell>
                          <TableCell className="text-sm">{e.witnessName || "—"}</TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate">{e.notes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 50) || 1}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>Next</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Add Entry Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Narcotics Register Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Drug Master ID *</Label>
                  <Input value={form.drugMasterId ?? ""} onChange={(e) => setForm({ ...form, drugMasterId: e.target.value })} placeholder="Drug ID" />
                </div>
                <div>
                  <Label>Transaction Type *</Label>
                  <Select value={form.transactionType ?? ""} onValueChange={(v) => setForm({ ...form, transactionType: v })}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RECEIPT">Receipt</SelectItem>
                      <SelectItem value="ISSUE">Issue</SelectItem>
                      <SelectItem value="WASTAGE">Wastage</SelectItem>
                      <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quantity *</Label>
                    <Input type="number" value={form.quantity ?? ""} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Batch Number</Label>
                    <Input value={form.batchNumber ?? ""} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Balance Before *</Label>
                    <Input type="number" value={form.balanceBefore ?? ""} onChange={(e) => setForm({ ...form, balanceBefore: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Balance After *</Label>
                    <Input type="number" value={form.balanceAfter ?? ""} onChange={(e) => setForm({ ...form, balanceAfter: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <Label>Witness Name (required for narcotics)</Label>
                  <Input value={form.witnessName ?? ""} onChange={(e) => setForm({ ...form, witnessName: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!form.drugMasterId || !form.transactionType || !form.quantity}>
                  Add Entry
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </RequirePerm>
    </AppShell>
  );
}
