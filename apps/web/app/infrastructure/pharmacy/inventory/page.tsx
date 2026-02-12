"use client";

import * as React from "react";
import { AppShell } from "@/components/AppShell";
import { RequirePerm } from "@/components/RequirePerm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type StoreOption = { id: string; storeCode: string; storeName: string };
type ConfigRow = {
  id: string;
  pharmacyStoreId: string;
  drugMasterId: string;
  minimumStock: number | null;
  maximumStock: number | null;
  reorderLevel: number | null;
  reorderQuantity: number | null;
  safetyStock: number | null;
  abcClass: string | null;
  vedClass: string | null;
  drugMaster?: { drugCode: string; genericName: string; brandName: string | null };
};

export default function InventoryConfigPage() {
  const { toast } = useToast();
  const { branchId } = useBranchContext();

  const { insights, loading: insightsLoading, dismiss: dismissInsight } = usePageInsights({
    module: "pharmacy-inventory",
    enabled: !!branchId,
  });

  const [stores, setStores] = React.useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = React.useState("");
  const [configs, setConfigs] = React.useState<ConfigRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [editRow, setEditRow] = React.useState<string | null>(null);
  const [editData, setEditData] = React.useState<any>({});

  // Load stores
  React.useEffect(() => {
    if (!branchId) return;
    apiFetch(`/infrastructure/pharmacy/stores?pageSize=200`)
      .then((data) => {
        const storeList = data.rows ?? [];
        setStores(storeList);
        if (storeList.length > 0 && !selectedStore) {
          setSelectedStore(storeList[0].id);
        }
      })
      .catch(() => {});
  }, [branchId]);

  // Load configs when store changes
  React.useEffect(() => {
    if (!selectedStore) return;
    setLoading(true);
    apiFetch(`/infrastructure/pharmacy/inventory-config?storeId=${selectedStore}`)
      .then((data) => {
        setConfigs(data.rows ?? []);
      })
      .catch((err) => {
        toast({ title: "Error", description: String(err), variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [selectedStore]);

  const handleSave = async (row: ConfigRow) => {
    try {
      await apiFetch(`/infrastructure/pharmacy/inventory-config`, {
        method: "POST",
        body: {
          configs: [{
            pharmacyStoreId: row.pharmacyStoreId,
            drugMasterId: row.drugMasterId,
            ...editData,
          }],
        },
      });
      setEditRow(null);
      setEditData({});
      toast({ title: "Success", description: "Inventory config updated" });
      // Reload
      const data = await apiFetch(`/infrastructure/pharmacy/inventory-config?storeId=${selectedStore}`);
      setConfigs(data.rows ?? []);
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  };

  const startEdit = (row: ConfigRow) => {
    setEditRow(row.id);
    setEditData({
      minimumStock: row.minimumStock,
      maximumStock: row.maximumStock,
      reorderLevel: row.reorderLevel,
      reorderQuantity: row.reorderQuantity,
      safetyStock: row.safetyStock,
      abcClass: row.abcClass,
      vedClass: row.vedClass,
    });
  };

  const abcVedBadge = (abc: string | null, ved: string | null) => {
    if (!abc && !ved) return "—";
    return (
      <div className="flex gap-1">
        {abc && <Badge variant="outline">{abc}</Badge>}
        {ved && (
          <Badge
            variant={ved === "V" ? "destructive" : ved === "E" ? "default" : "secondary"}
          >
            {ved}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <AppShell>
      <RequirePerm perm="INFRA_PHARMACY_INVENTORY_READ">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Inventory Configuration</h1>
            <p className="text-sm text-muted-foreground">
              Configure min/max stock levels, reorder points, and ABC-VED classification per store
            </p>
          </div>

          {/* AI Insights Banner */}
          <PageInsightBanner insights={insights} loading={insightsLoading} onDismiss={dismissInsight} />

          <div className="flex gap-4 items-end">
            <div>
              <Label>Select Store</Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Choose a pharmacy store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.storeCode} — {s.storeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Stock Level Configuration
                {selectedStore && ` — ${stores.find((s) => s.id === selectedStore)?.storeName ?? ""}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground py-8 text-center">Loading...</p>
              ) : !selectedStore ? (
                <p className="text-muted-foreground py-8 text-center">Select a store to view configurations</p>
              ) : configs.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No inventory configurations set for this store yet. Configurations are created when drugs are assigned stock levels.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Drug Code</TableHead>
                      <TableHead>Drug Name</TableHead>
                      <TableHead>Min Stock</TableHead>
                      <TableHead>Max Stock</TableHead>
                      <TableHead>Reorder Level</TableHead>
                      <TableHead>Reorder Qty</TableHead>
                      <TableHead>Safety Stock</TableHead>
                      <TableHead>ABC/VED</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">
                          {c.drugMaster?.drugCode ?? "—"}
                        </TableCell>
                        <TableCell>
                          {c.drugMaster?.genericName ?? "—"}
                          {c.drugMaster?.brandName && (
                            <span className="block text-xs text-muted-foreground">
                              {c.drugMaster.brandName}
                            </span>
                          )}
                        </TableCell>
                        {editRow === c.id ? (
                          <>
                            <TableCell>
                              <Input
                                type="number"
                                className="w-20"
                                value={editData.minimumStock ?? ""}
                                onChange={(e) => setEditData({ ...editData, minimumStock: Number(e.target.value) || null })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="w-20" value={editData.maximumStock ?? ""} onChange={(e) => setEditData({ ...editData, maximumStock: Number(e.target.value) || null })} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="w-20" value={editData.reorderLevel ?? ""} onChange={(e) => setEditData({ ...editData, reorderLevel: Number(e.target.value) || null })} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="w-20" value={editData.reorderQuantity ?? ""} onChange={(e) => setEditData({ ...editData, reorderQuantity: Number(e.target.value) || null })} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" className="w-20" value={editData.safetyStock ?? ""} onChange={(e) => setEditData({ ...editData, safetyStock: Number(e.target.value) || null })} />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Select value={editData.abcClass ?? ""} onValueChange={(v) => setEditData({ ...editData, abcClass: v || null })}>
                                  <SelectTrigger className="w-16"><SelectValue placeholder="ABC" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="A">A</SelectItem>
                                    <SelectItem value="B">B</SelectItem>
                                    <SelectItem value="C">C</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Select value={editData.vedClass ?? ""} onValueChange={(v) => setEditData({ ...editData, vedClass: v || null })}>
                                  <SelectTrigger className="w-16"><SelectValue placeholder="VED" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="V">V</SelectItem>
                                    <SelectItem value="E">E</SelectItem>
                                    <SelectItem value="D">D</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => handleSave(c)}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{c.minimumStock ?? "—"}</TableCell>
                            <TableCell>{c.maximumStock ?? "—"}</TableCell>
                            <TableCell>{c.reorderLevel ?? "—"}</TableCell>
                            <TableCell>{c.reorderQuantity ?? "—"}</TableCell>
                            <TableCell>{c.safetyStock ?? "—"}</TableCell>
                            <TableCell>{abcVedBadge(c.abcClass, c.vedClass)}</TableCell>
                            <TableCell>
                              <RequirePerm perm="INFRA_PHARMACY_INVENTORY_UPDATE">
                                <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                                  Edit
                                </Button>
                              </RequirePerm>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </RequirePerm>
    </AppShell>
  );
}
