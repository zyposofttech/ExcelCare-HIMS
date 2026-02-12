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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api";
import { useBranchContext } from "@/lib/branch/useBranchContext";

type StoreOption = { id: string; storeCode: string; storeName: string; storeType: string };
type MappingRow = {
  id: string;
  requestingStoreId: string;
  supplyingStoreId: string;
  approvalRole: string | null;
  slaDurationMinutes: number | null;
  isEmergencyOverride: boolean;
  requestingStore?: { storeCode: string; storeName: string; storeType: string };
  supplyingStore?: { storeCode: string; storeName: string; storeType: string };
};

export default function IndentMappingPage() {
  const { toast } = useToast();
  const { branchId } = useBranchContext();

  const [mappings, setMappings] = React.useState<MappingRow[]>([]);
  const [stores, setStores] = React.useState<StoreOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<any>({});

  const load = React.useCallback(async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      const [mappingData, storeData] = await Promise.all([
        apiFetch(`/infrastructure/pharmacy/indent-mappings`),
        apiFetch(`/infrastructure/pharmacy/stores?pageSize=200`),
      ]);
      setMappings(Array.isArray(mappingData) ? mappingData : mappingData.rows ?? []);
      setStores(storeData.rows ?? []);
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  React.useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try {
      await apiFetch(`/infrastructure/pharmacy/indent-mappings`, {
        method: "POST",
        body: form,
      });
      setDialogOpen(false);
      setForm({});
      toast({ title: "Success", description: "Indent mapping created" });
      load();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/infrastructure/pharmacy/indent-mappings/${id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Mapping removed" });
      load();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  };

  const formatSla = (mins: number | null) => {
    if (!mins) return "—";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ""}`.trim();
  };

  return (
    <AppShell>
      <RequirePerm perm="INFRA_PHARMACY_STORE_READ">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Store-to-Store Indent Mapping</h1>
              <p className="text-sm text-muted-foreground">
                Configure which stores can raise indents to which parent stores, with approval rules and SLAs
              </p>
            </div>
            <RequirePerm perm="INFRA_PHARMACY_STORE_UPDATE">
              <Button onClick={() => setDialogOpen(true)}>Add Mapping</Button>
            </RequirePerm>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Indent Flow Rules ({mappings.length})</CardTitle>
              <CardDescription>
                Each mapping defines how drugs flow between stores within the hospital
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground py-8 text-center">Loading...</p>
              ) : mappings.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No indent mappings configured. Add store-to-store flow rules.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requesting Store</TableHead>
                      <TableHead>→</TableHead>
                      <TableHead>Supplying Store</TableHead>
                      <TableHead>Approval Role</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>Emergency Override</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="font-medium">{m.requestingStore?.storeName ?? m.requestingStoreId}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {m.requestingStore?.storeCode} ({m.requestingStore?.storeType})
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">→</TableCell>
                        <TableCell>
                          <div className="font-medium">{m.supplyingStore?.storeName ?? m.supplyingStoreId}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {m.supplyingStore?.storeCode} ({m.supplyingStore?.storeType})
                          </div>
                        </TableCell>
                        <TableCell>{m.approvalRole || "—"}</TableCell>
                        <TableCell>{formatSla(m.slaDurationMinutes)}</TableCell>
                        <TableCell>
                          {m.isEmergencyOverride ? (
                            <Badge variant="destructive">Yes</Badge>
                          ) : (
                            <Badge variant="secondary">No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <RequirePerm perm="INFRA_PHARMACY_STORE_UPDATE">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(m.id)}
                            >
                              Remove
                            </Button>
                          </RequirePerm>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Create Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Indent Mapping</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Requesting Store *</Label>
                  <Select
                    value={form.requestingStoreId ?? ""}
                    onValueChange={(v) => setForm({ ...form, requestingStoreId: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select requesting store" /></SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.storeCode} — {s.storeName} ({s.storeType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Supplying Store *</Label>
                  <Select
                    value={form.supplyingStoreId ?? ""}
                    onValueChange={(v) => setForm({ ...form, supplyingStoreId: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select supplying store" /></SelectTrigger>
                    <SelectContent>
                      {stores.filter((s) => s.id !== form.requestingStoreId).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.storeCode} — {s.storeName} ({s.storeType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Approval Role</Label>
                  <Input
                    value={form.approvalRole ?? ""}
                    onChange={(e) => setForm({ ...form, approvalRole: e.target.value })}
                    placeholder="e.g., Pharmacist, Sr. Pharmacist, Store Manager"
                  />
                </div>
                <div>
                  <Label>SLA Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={form.slaDurationMinutes ?? ""}
                    onChange={(e) => setForm({ ...form, slaDurationMinutes: Number(e.target.value) || undefined })}
                    placeholder="e.g., 60 for 1 hour"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.isEmergencyOverride ?? false}
                    onCheckedChange={(v) => setForm({ ...form, isEmergencyOverride: v })}
                  />
                  <Label>Emergency Override (bypass approval for critical drugs)</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleCreate}
                  disabled={!form.requestingStoreId || !form.supplyingStoreId}
                >
                  Create Mapping
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </RequirePerm>
    </AppShell>
  );
}
