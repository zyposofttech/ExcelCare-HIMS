"use client";

import * as React from "react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { apiFetch } from "@/lib/api";
import { useActiveBranchStore } from "@/lib/branch/active-branch";

type BranchRow = {
  id: string;
  code: string;
  name: string;
  city?: string;
  isActive?: boolean;
};

function buildLabel(b: BranchRow | null) {
  if (!b) return "";
  const codePart = b.code ? `${b.code} • ` : "";
  const cityPart = b.city ? ` — ${b.city}` : "";
  return `${codePart}${b.name}${cityPart}`;
}

function buildShortLabel(b: BranchRow | null) {
  if (!b) return "";
  // Short label for header (prevents wrap): code + name only
  const codePart = b.code ? `${b.code} • ` : "";
  return `${codePart}${b.name}`;
}

export function BranchSelector({ className }: { className?: string }) {
  const activeBranchId = useActiveBranchStore((s) => s.activeBranchId);
  const setActiveBranchId = useActiveBranchStore((s) => s.setActiveBranchId);

  const [branches, setBranches] = React.useState<BranchRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<BranchRow[]>("/api/branches", { showLoader: false });
      const sorted = [...(data ?? [])].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      const activeFirst = sorted.sort((a, b) => Number(Boolean(b.isActive)) - Number(Boolean(a.isActive)));
      setBranches(activeFirst);
    } catch (e: any) {
      setError(e?.message || "Failed to load branches");
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Ensure there is always a usable active branch once branches are loaded.
  React.useEffect(() => {
    if (!branches.length) return;
    if (activeBranchId && branches.some((b) => b.id === activeBranchId)) return;

    const next = branches.find((b) => b.isActive) ?? branches[0];
    if (next?.id) setActiveBranchId(next.id);
  }, [branches, activeBranchId, setActiveBranchId]);

  const selected = React.useMemo(() => {
    return branches.find((b) => b.id === activeBranchId) ?? null;
  }, [branches, activeBranchId]);

  const placeholder = loading ? "Loading branches…" : error ? "Branches unavailable" : "Select branch";
  const disabled = loading || !branches.length;

  const fullLabel = buildLabel(selected);
  const shortLabel = buildShortLabel(selected);

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="hidden lg:block whitespace-nowrap text-xs font-medium text-zc-muted">
        Active Branch
      </span>

      <Select value={activeBranchId ?? ""} onValueChange={(v) => setActiveBranchId(v || null)} disabled={disabled}>
        <SelectTrigger
          className={cn(
            // IMPORTANT: prevent header height changes
            "h-9 min-w-0 overflow-hidden",
            // responsive width to fit header nicely
            "w-[260px] xl:w-[340px]",
            "rounded-lg",
            "bg-zc-card border-zc-border",
            disabled ? "opacity-80" : ""
          )}
        >
          <span
            className={cn(
              // IMPORTANT: single-line + ellipsis
              "min-w-0 flex-1 truncate whitespace-nowrap",
              // show muted style when no selection
              !selected ? "text-zc-muted" : ""
            )}
            title={selected ? fullLabel : ""}
          >
            {selected ? shortLabel : placeholder}
          </span>
        </SelectTrigger>

        <SelectContent className="max-h-[320px]">
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {buildLabel(b)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
