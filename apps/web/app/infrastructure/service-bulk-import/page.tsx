"use client";

import * as React from "react";
import { AppShell } from "@/components/AppShell";
import { RequirePerm } from "@/components/RequirePerm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { ApiError, apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useBranchContext } from "@/lib/branch/useBranchContext";
import { useActiveBranchStore } from "@/lib/branch/active-branch";
import { usePageInsights } from "@/lib/copilot/usePageInsights";
import { PageInsightBanner } from "@/components/copilot/PageInsightBanner";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  Upload,
  XCircle,
} from "lucide-react";

/* Types */
type BranchRow = { id: string; code: string; name: string; city: string };
type EntityType = "SERVICE_ITEMS" | "CHARGE_MASTER" | "PAYERS";
type ImportMode = "CREATE" | "UPDATE" | "UPSERT";

type ValidationRow = {
  row: number;
  status: "ok" | "error" | "warning";
  message?: string;
  data: Record<string, any>;
};

type ImportResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  details: ValidationRow[];
};

/* Page */
export default function ServiceBulkImportPage() {
  const { toast } = useToast();
  const branchCtx = useBranchContext();
  const activeBranchId = useActiveBranchStore((s) => s.activeBranchId);
  const setActiveBranchId = useActiveBranchStore((s) => s.setActiveBranchId);

  const isGlobalScope = branchCtx.scope === "GLOBAL";
  const effectiveBranchId = branchCtx.branchId ?? activeBranchId ?? "";

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [branchId, setBranchId] = React.useState<string>("");

  // AI Copilot
  const { insights, loading: insightsLoading, dismiss: dismissInsight } = usePageInsights({
    module: "service-bulk-import",
    enabled: !!branchId,
  });

  const [entityType, setEntityType] = React.useState<EntityType>("SERVICE_ITEMS");
  const [importMode, setImportMode] = React.useState<ImportMode>("CREATE");
  const [file, setFile] = React.useState<File | null>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const [validating, setValidating] = React.useState(false);
  const [validated, setValidated] = React.useState(false);
  const [validationRows, setValidationRows] = React.useState<ValidationRow[]>([]);

  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);

  async function loadBranches() {
    const list = (await apiFetch<BranchRow[]>("/api/branches")) || [];
    setBranches(list);
    const stored = effectiveBranchId || null;
    const first = list[0]?.id || null;
    const next = (stored && list.some((b) => b.id === stored) ? stored : null) || first;
    if (next) if (isGlobalScope) setActiveBranchId(next || null);
    setBranchId(next || "");
  }

  React.useEffect(() => { void loadBranches(); }, []);

  function onBranchChange(nextId: string) {
    setBranchId(nextId);
    if (isGlobalScope) setActiveBranchId(nextId || null);
    resetState();
  }

  function resetState() {
    setFile(null);
    setValidated(false);
    setValidationRows([]);
    setImportResult(null);
  }

  function onFileSelect(f: File | null) {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
      toast({ title: "Invalid file type", description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)", variant: "destructive" });
      return;
    }
    setFile(f);
    setValidated(false);
    setValidationRows([]);
    setImportResult(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFileSelect(f);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  async function validateFile() {
    if (!file || !branchId) return;
    setValidating(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("importMode", importMode);
      formData.append("branchId", branchId);

      const res = await apiFetch<{ rows: ValidationRow[] }>(
        "/api/infrastructure/bulk-import/validate",
        { method: "POST", body: formData, headers: {} } as any,
      );
      setValidationRows(res.rows || []);
      setValidated(true);
      toast({ title: "Validation complete" });
    } catch (e: any) {
      toast({ title: "Validation failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setValidating(false);
    }
  }

  async function runImport() {
    if (!file || !branchId || !validated) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("importMode", importMode);
      formData.append("branchId", branchId);

      const res = await apiFetch<ImportResult>(
        "/api/infrastructure/bulk-import/execute",
        { method: "POST", body: formData, headers: {} } as any,
      );
      setImportResult(res);
      toast({ title: `Import complete: ${res.created} created, ${res.updated} updated, ${res.errors} errors` });
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  const errorCount = validationRows.filter((r) => r.status === "error").length;
  const warningCount = validationRows.filter((r) => r.status === "warning").length;
  const okCount = validationRows.filter((r) => r.status === "ok").length;

  return (
    <AppShell title="Infrastructure - Service Bulk Import">
      <RequirePerm perm="INFRA_SERVICE_CREATE">
        <div className="grid gap-6">
          {/* Header */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
                <Upload className="h-5 w-5 text-zc-accent" />
              </span>
              <div className="min-w-0">
                <div className="text-3xl font-semibold tracking-tight">Service Bulk Import</div>
                <div className="mt-1 text-sm text-zc-muted">
                  Import services, charge master items, or payers from CSV/Excel files.
                </div>
              </div>
            </div>
          </div>

          {/* Config */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Import Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Branch</Label>
                <Select value={branchId || ""} onValueChange={onBranchChange}>
                  <SelectTrigger className="h-11 w-full rounded-xl border-zc-border bg-zc-card">
                    <SelectValue placeholder="Select branch..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px] overflow-y-auto">
                    {branches.filter((b) => b.id).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.code} - {b.name} ({b.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Entity Type</Label>
                  <Select value={entityType} onValueChange={(v) => { setEntityType(v as EntityType); resetState(); }}>
                    <SelectTrigger className="h-11 rounded-xl border-zc-border bg-zc-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SERVICE_ITEMS">Service Items</SelectItem>
                      <SelectItem value="CHARGE_MASTER">Charge Master Items</SelectItem>
                      <SelectItem value="PAYERS">Payers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Import Mode</Label>
                  <Select value={importMode} onValueChange={(v) => { setImportMode(v as ImportMode); resetState(); }}>
                    <SelectTrigger className="h-11 rounded-xl border-zc-border bg-zc-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREATE">Create Only</SelectItem>
                      <SelectItem value="UPDATE">Update Only</SelectItem>
                      <SelectItem value="UPSERT">Create or Update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <PageInsightBanner insights={insights} loading={insightsLoading} onDismiss={dismissInsight} />

          {/* File Upload */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">File Upload</CardTitle>
              <CardDescription>Upload a CSV or Excel file. Max 5000 rows per import.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors",
                  dragOver ? "border-zc-accent bg-zc-accent/5" : "border-zc-border",
                  !branchId && "pointer-events-none opacity-50",
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setDragOver(false)}
              >
                <FileUp className="h-8 w-8 text-zc-muted" />
                <div className="text-sm text-zc-muted text-center">
                  {file ? (
                    <span className="font-semibold text-zc-text">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                  ) : (
                    <>Drag & drop your file here, or click to browse</>
                  )}
                </div>
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" className="pointer-events-none gap-2">
                    <Download className="h-4 w-4" /> Choose File
                  </Button>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
                    disabled={!branchId}
                  />
                </label>
              </div>

              {file && (
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={validateFile}
                    disabled={validating || !branchId}
                  >
                    {validating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-zc-accent border-t-transparent" /> : <CheckCircle2 className="h-4 w-4" />}
                    {validating ? "Validating..." : "Validate"}
                  </Button>
                  {validated && errorCount === 0 && (
                    <Button
                      className="gap-2"
                      onClick={runImport}
                      disabled={importing}
                    >
                      {importing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Upload className="h-4 w-4" />}
                      {importing ? "Importing..." : "Run Import"}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={resetState}>Clear</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation Results */}
          {validated && (
            <Card>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Validation Results</CardTitle>
                  <div className="flex items-center gap-3">
                    {okCount > 0 && <Badge variant="ok" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {okCount} OK</Badge>}
                    {warningCount > 0 && <Badge variant="warning" className="gap-1"><AlertTriangle className="h-3 w-3" /> {warningCount} Warnings</Badge>}
                    {errorCount > 0 && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {errorCount} Errors</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {errorCount > 0 && (
                  <div className="mb-4 rounded-xl border border-zc-danger/40 bg-zc-danger/5 p-3 text-sm text-zc-danger">
                    {errorCount} row(s) have errors that must be fixed before importing. Please correct your file and re-upload.
                  </div>
                )}
                <div className="rounded-xl border border-zc-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">Row</TableHead>
                        <TableHead className="w-[80px]">Status</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Data Preview</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationRows.slice(0, 100).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.row}</TableCell>
                          <TableCell>
                            {r.status === "ok" && <Badge variant="ok">OK</Badge>}
                            {r.status === "error" && <Badge variant="destructive">Error</Badge>}
                            {r.status === "warning" && <Badge variant="warning">Warning</Badge>}
                          </TableCell>
                          <TableCell className="text-sm text-zc-muted">{r.message || "-"}</TableCell>
                          <TableCell>
                            <div className="max-w-[300px] truncate text-xs text-zc-muted font-mono">
                              {JSON.stringify(r.data).slice(0, 100)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {validationRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-sm text-zc-muted py-6">
                            No rows to display.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {validationRows.length > 100 && (
                    <div className="border-t border-zc-border p-3 text-sm text-zc-muted text-center">
                      Showing first 100 of {validationRows.length} rows.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import Results */}
          {importResult && (
            <Card className="border-emerald-200 dark:border-emerald-900/50">
              <CardHeader className="py-4">
                <CardTitle className="text-base text-emerald-700 dark:text-emerald-300">Import Complete</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
                    <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Rows</div>
                    <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{importResult.total}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                    <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Created</div>
                    <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{importResult.created}</div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
                    <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Updated</div>
                    <div className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">{importResult.updated}</div>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-900/10">
                    <div className="text-xs font-medium text-rose-600 dark:text-rose-400">Errors</div>
                    <div className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">{importResult.errors}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </RequirePerm>
    </AppShell>
  );
}
