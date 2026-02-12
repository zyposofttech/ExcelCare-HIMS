"use client";

import * as React from "react";
import { AppShell } from "@/components/AppShell";
import { RequirePerm } from "@/components/RequirePerm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { usePageInsights } from "@/lib/copilot/usePageInsights";
import { PageInsightBanner } from "@/components/copilot/PageInsightBanner";

type FormularyRow = {
  id: string;
  version: number;
  status: string;
  effectiveDate: string | null;
  publishedAt: string | null;
  notes: string | null;
  _count?: { items: number };
};

type DrugRow = {
  id: string;
  drugCode: string;
  genericName: string;
  brandName: string | null;
  category: string;
  formularyStatus: string;
};

export default function FormularyPage() {
  const { toast } = useToast();
  const { branchId } = useBranchContext();

  const { insights, loading: insightsLoading, dismiss: dismissInsight } = usePageInsights({
    module: "pharmacy-drugs",
    enabled: !!branchId,
  });

  const [formularies, setFormularies] = React.useState<FormularyRow[]>([]);
  const [drugs, setDrugs] = React.useState<DrugRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [selectedFormulary, setSelectedFormulary] = React.useState<FormularyRow | null>(null);
  const [notes, setNotes] = React.useState("");
  const [effectiveDate, setEffectiveDate] = React.useState("");

  // Manage items state
  const [formularyItems, setFormularyItems] = React.useState<any[]>([]);
  const [drugSearch, setDrugSearch] = React.useState("");
  const [bulkTier, setBulkTier] = React.useState("APPROVED");

  const load = React.useCallback(async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      const data = await apiFetch(`/infrastructure/pharmacy/formulary`);
      setFormularies(Array.isArray(data) ? data : data.rows ?? []);
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  React.useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    try {
      await apiFetch(`/infrastructure/pharmacy/formulary`, {
        method: "POST",
        body: {
          effectiveDate: effectiveDate || undefined,
          notes: notes || undefined,
        },
      });
      setCreateOpen(false);
      setNotes("");
      setEffectiveDate("");
      toast({ title: "Success", description: "Formulary draft created" });
      load();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await apiFetch(`/infrastructure/pharmacy/formulary/${id}/publish`, { method: "POST" });
      toast({ title: "Success", description: "Formulary published" });
      load();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  };

  const openManage = async (f: FormularyRow) => {
    setSelectedFormulary(f);
    try {
      const drugsData = await apiFetch(`/infrastructure/pharmacy/drugs?pageSize=500`);
      setDrugs(drugsData.rows ?? []);
    } catch {}
    setManageOpen(true);
  };

  const handleBulkAssign = async () => {
    if (!selectedFormulary) return;
    const filteredDrugs = drugs.filter(
      (d) =>
        !drugSearch ||
        d.genericName.toLowerCase().includes(drugSearch.toLowerCase()) ||
        (d.brandName ?? "").toLowerCase().includes(drugSearch.toLowerCase())
    );
    const items = filteredDrugs.map((d) => ({
      drugMasterId: d.id,
      tier: bulkTier,
    }));
    try {
      await apiFetch(`/infrastructure/pharmacy/formulary/${selectedFormulary.id}/items`, {
        method: "POST",
        body: { items },
      });
      toast({ title: "Success", description: `${items.length} items assigned to formulary` });
      setManageOpen(false);
      load();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED": return <Badge className="bg-green-600">Published</Badge>;
      case "DRAFT": return <Badge variant="outline">Draft</Badge>;
      case "ARCHIVED": return <Badge variant="secondary">Archived</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppShell>
      <RequirePerm perm="INFRA_PHARMACY_FORMULARY_READ">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Formulary Management</h1>
              <p className="text-sm text-muted-foreground">
                Manage drug formulary versions and tier assignments
              </p>
            </div>
            <RequirePerm perm="INFRA_PHARMACY_FORMULARY_CREATE">
              <Button onClick={() => setCreateOpen(true)}>New Formulary Draft</Button>
            </RequirePerm>
          </div>

          {/* AI Insights Banner */}
          <PageInsightBanner insights={insights} loading={insightsLoading} onDismiss={dismissInsight} />

          <Card>
            <CardHeader>
              <CardTitle>Formulary Versions</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground py-8 text-center">Loading...</p>
              ) : formularies.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No formulary versions yet. Create your first formulary draft.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formularies.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono">v{f.version}</TableCell>
                        <TableCell>{statusBadge(f.status)}</TableCell>
                        <TableCell>
                          {f.effectiveDate
                            ? new Date(f.effectiveDate).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {f.publishedAt
                            ? new Date(f.publishedAt).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell>{f._count?.items ?? "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {f.notes || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openManage(f)}
                              disabled={f.status !== "DRAFT"}
                            >
                              Manage Items
                            </Button>
                            {f.status === "DRAFT" && (
                              <RequirePerm perm="INFRA_PHARMACY_FORMULARY_PUBLISH">
                                <Button size="sm" onClick={() => handlePublish(f.id)}>
                                  Publish
                                </Button>
                              </RequirePerm>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Create Dialog */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Formulary Draft</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Effective Date</Label>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes about this formulary version"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create Draft</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Manage Items Dialog */}
          <Dialog open={manageOpen} onOpenChange={setManageOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  Manage Formulary Items — v{selectedFormulary?.version}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label>Search Drugs</Label>
                    <Input
                      value={drugSearch}
                      onChange={(e) => setDrugSearch(e.target.value)}
                      placeholder="Filter by name..."
                    />
                  </div>
                  <div>
                    <Label>Assign Tier</Label>
                    <Select value={bulkTier} onValueChange={setBulkTier}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="RESTRICTED">Restricted</SelectItem>
                        <SelectItem value="NON_FORMULARY">Non-Formulary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {drugs.filter(
                    (d) =>
                      !drugSearch ||
                      d.genericName.toLowerCase().includes(drugSearch.toLowerCase()) ||
                      (d.brandName ?? "").toLowerCase().includes(drugSearch.toLowerCase())
                  ).length}{" "}
                  drugs matching filter will be assigned as{" "}
                  <strong>{bulkTier}</strong>
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setManageOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBulkAssign}>Assign to Formulary</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </RequirePerm>
    </AppShell>
  );
}
