"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { OnboardingShell } from "../_components/OnboardingShell";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/use-toast";

type VerificationStatus = "NOT_INITIATED" | "IN_PROGRESS" | "VERIFIED" | "REJECTED" | "EXPIRED";

type BackgroundVerificationDraft = {
  status?: VerificationStatus;
  verified_by?: string; // agency name
  verification_date?: string; // YYYY-MM-DD
  report_url?: string;
  remarks?: string;
  cleared_for_employment?: boolean;
};

type PoliceVerificationDraft = {
  status?: VerificationStatus;
  police_station?: string;
  application_number?: string;
  application_date?: string; // YYYY-MM-DD
  verification_date?: string; // YYYY-MM-DD
  certificate_url?: string;
  expiry_date?: string; // YYYY-MM-DD
  remarks?: string;
};

type StaffOnboardingDraft = {
  personal_details?: Record<string, any>;
  contact_details?: Record<string, any>;
  employment_details?: Record<string, any>;
  medical_details?: Record<string, any>;
  system_access?: Record<string, any>;

  background_verification?: BackgroundVerificationDraft;
  police_verification?: PoliceVerificationDraft;
};

type FieldErrorMap = Record<string, string>;

export default function HrStaffOnboardingBackgroundPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const draftId = sp.get("draftId");

  const [loading, setLoading] = React.useState(true);
  const [dirty, setDirty] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrorMap>({});

  const [bgv, setBgv] = React.useState<BackgroundVerificationDraft>({
    status: "NOT_INITIATED",
    verified_by: "",
    verification_date: "",
    report_url: "",
    remarks: "",
    cleared_for_employment: false,
  });

  const [police, setPolice] = React.useState<PoliceVerificationDraft>({
    status: "NOT_INITIATED",
    police_station: "",
    application_number: "",
    application_date: "",
    verification_date: "",
    certificate_url: "",
    expiry_date: "",
    remarks: "",
  });

  // Ensure a stable draftId in URL
  React.useEffect(() => {
    if (draftId) return;
    const id = makeDraftId();
    const u = new URL(window.location.href);
    u.searchParams.set("draftId", id);
    router.replace((u.pathname + "?" + u.searchParams.toString()) as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  // Load draft
  React.useEffect(() => {
    const id = draftId;
    if (!id) return;

    setLoading(true);
    try {
      const d = readDraft(id);

      const dBgv = (d.background_verification ?? {}) as BackgroundVerificationDraft;
      const dPolice = (d.police_verification ?? {}) as PoliceVerificationDraft;

      setBgv({
        status: (dBgv.status as VerificationStatus) ?? "NOT_INITIATED",
        verified_by: dBgv.verified_by ?? "",
        verification_date: dBgv.verification_date ?? "",
        report_url: dBgv.report_url ?? "",
        remarks: dBgv.remarks ?? "",
        cleared_for_employment: !!dBgv.cleared_for_employment,
      });

      setPolice({
        status: (dPolice.status as VerificationStatus) ?? "NOT_INITIATED",
        police_station: dPolice.police_station ?? "",
        application_number: dPolice.application_number ?? "",
        application_date: dPolice.application_date ?? "",
        verification_date: dPolice.verification_date ?? "",
        certificate_url: dPolice.certificate_url ?? "",
        expiry_date: dPolice.expiry_date ?? "",
        remarks: dPolice.remarks ?? "",
      });
    } finally {
      setLoading(false);
      setDirty(false);
      setErrors({});
    }
  }, [draftId]);

  function updateBgv<K extends keyof BackgroundVerificationDraft>(key: K, value: BackgroundVerificationDraft[K]) {
    setBgv((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setErrors((e) => {
      const n = { ...e };
      delete n[`bgv.${String(key)}`];
      return n;
    });
  }

  function updatePolice<K extends keyof PoliceVerificationDraft>(key: K, value: PoliceVerificationDraft[K]) {
    setPolice((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setErrors((e) => {
      const n = { ...e };
      delete n[`police.${String(key)}`];
      return n;
    });
  }

  function validate(): FieldErrorMap {
    const e: FieldErrorMap = {};

    // --- Background verification rules (practical + aligns with workflow intent)
    if (!bgv.status) e["bgv.status"] = "Status is required.";

    if (bgv.status === "VERIFIED") {
      if (!String(bgv.verified_by ?? "").trim()) e["bgv.verified_by"] = "Agency / verified by is required when verified.";
      if (!String(bgv.verification_date ?? "").trim()) e["bgv.verification_date"] = "Verification date is required when verified.";
      if (bgv.verification_date && !isValidYmd(bgv.verification_date)) e["bgv.verification_date"] = "Invalid date.";
    }

    if (bgv.status === "REJECTED") {
      if (!String(bgv.remarks ?? "").trim()) e["bgv.remarks"] = "Remarks are required when rejected.";
    }

    if (bgv.report_url && !looksLikeUrl(bgv.report_url)) e["bgv.report_url"] = "Please enter a valid URL (or leave blank).";

    // --- Police verification rules
    if (!police.status) e["police.status"] = "Status is required.";

    if (police.status === "VERIFIED") {
      if (!String(police.police_station ?? "").trim()) e["police.police_station"] = "Police station is required when verified.";
      if (!String(police.verification_date ?? "").trim()) e["police.verification_date"] = "Verification date is required when verified.";
      if (police.verification_date && !isValidYmd(police.verification_date)) e["police.verification_date"] = "Invalid date.";
    }

    if (police.status === "REJECTED") {
      if (!String(police.remarks ?? "").trim()) e["police.remarks"] = "Remarks are required when rejected.";
    }

    if (police.application_date && !isValidYmd(police.application_date)) e["police.application_date"] = "Invalid date.";
    if (police.expiry_date && !isValidYmd(police.expiry_date)) e["police.expiry_date"] = "Invalid date.";
    if (police.certificate_url && !looksLikeUrl(police.certificate_url)) e["police.certificate_url"] = "Please enter a valid URL (or leave blank).";

    return e;
  }

  function saveDraftOrThrow() {
    const id = draftId;
    if (!id) return;

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      toast({
        variant: "destructive",
        title: "Fix highlighted fields",
        description: "Some values are missing/invalid based on the selected verification status.",
      });
      throw new Error("validation_failed");
    }

    const existing = readDraft(id);
    const nextDraft: StaffOnboardingDraft = {
      ...existing,
      background_verification: {
        status: bgv.status ?? "NOT_INITIATED",
        verified_by: cleanStr(bgv.verified_by),
        verification_date: cleanDate(bgv.verification_date),
        report_url: cleanStr(bgv.report_url),
        remarks: cleanStr(bgv.remarks),
        cleared_for_employment: !!bgv.cleared_for_employment,
      },
      police_verification: {
        status: police.status ?? "NOT_INITIATED",
        police_station: cleanStr(police.police_station),
        application_number: cleanStr(police.application_number),
        application_date: cleanDate(police.application_date),
        verification_date: cleanDate(police.verification_date),
        certificate_url: cleanStr(police.certificate_url),
        expiry_date: cleanDate(police.expiry_date),
        remarks: cleanStr(police.remarks),
      },
    };

    writeDraft(id, nextDraft);
    setDirty(false);

    toast({
      title: "Saved",
      description: "Background + police verification saved to draft.",
    });
  }

  function onSaveOnly() {
    try {
      saveDraftOrThrow();
    } catch {
      // toast already shown
    }
  }

  function onSaveAndNext() {
    try {
      saveDraftOrThrow();
      router.push(withDraftId("/infrastructure/human-resource/staff/onboarding/health", draftId) as any);
    } catch {
      // handled
    }
  }

  const bgvBadge = statusBadge(bgv.status ?? "NOT_INITIATED");
  const policeBadge = statusBadge(police.status ?? "NOT_INITIATED");

  return (
    <OnboardingShell
      stepKey="background"
      title="Background verification"
      description="BGV and police verification status, reports, validity and audit."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-zc-border"
              onClick={() =>
                router.push(withDraftId("/infrastructure/human-resource/staff/onboarding/system-access", draftId) as any)
              }
            >
              Back
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-zc-border" onClick={onSaveOnly} disabled={loading}>
              Save
            </Button>
            <Button className="bg-zc-accent text-white hover:bg-zc-accent/90" onClick={onSaveAndNext} disabled={loading}>
              Save &amp; Next
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-zc-foreground">Background & police verification</div>
            <div className="mt-1 text-xs text-zc-muted">
              Track verification lifecycle: not initiated → in progress → verified / rejected / expired. When set to
              “Verified”, key dates/authority become mandatory.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn("border border-zc-border", bgvBadge.className)}>
              BGV: {bgvBadge.label}
            </Badge>
            <Badge variant="secondary" className={cn("border border-zc-border", policeBadge.className)}>
              Police: {policeBadge.label}
            </Badge>

            {dirty ? (
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400" variant="secondary">
                Unsaved changes
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" variant="secondary">
                Saved
              </Badge>
            )}
          </div>
        </div>

        <Separator className="bg-zc-border" />

        <div className={cn("grid gap-4", loading ? "opacity-60" : "opacity-100")}>
          {/* Background verification */}
          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Background verification (BGV)</div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Status" required error={errors["bgv.status"]}>
                <Select value={bgv.status ?? ""} onValueChange={(v) => updateBgv("status", v as VerificationStatus)}>
                  <SelectTrigger className={cn("border-zc-border", errors["bgv.status"] ? "border-red-500" : "")}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_INITIATED">Not initiated</SelectItem>
                    <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                    <SelectItem value="VERIFIED">Verified</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Verified by (Agency)"
                required={bgv.status === "VERIFIED"}
                error={errors["bgv.verified_by"]}
              >
                <Input
                  className={cn("border-zc-border", errors["bgv.verified_by"] ? "border-red-500" : "")}
                  value={bgv.verified_by ?? ""}
                  onChange={(e) => updateBgv("verified_by", e.target.value)}
                  placeholder="e.g., ABC BGV Services"
                />
              </Field>

              <Field
                label="Verification date"
                required={bgv.status === "VERIFIED"}
                error={errors["bgv.verification_date"]}
              >
                <Input
                  type="date"
                  className={cn("border-zc-border", errors["bgv.verification_date"] ? "border-red-500" : "")}
                  value={bgv.verification_date ?? ""}
                  onChange={(e) => updateBgv("verification_date", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Report URL" error={errors["bgv.report_url"]}>
                <Input
                  className={cn("border-zc-border", errors["bgv.report_url"] ? "border-red-500" : "")}
                  value={bgv.report_url ?? ""}
                  onChange={(e) => updateBgv("report_url", e.target.value)}
                  placeholder="https://..."
                />
              </Field>

              <Field label="Cleared for employment">
                <div className="flex items-center gap-2 rounded-md border border-zc-border bg-zc-panel/30 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!bgv.cleared_for_employment}
                    onChange={(e) => updateBgv("cleared_for_employment", e.target.checked)}
                  />
                  <span className="text-sm text-zc-foreground">Cleared</span>
                  <span className="text-xs text-zc-muted">(recommended true only when BGV is verified)</span>
                </div>
              </Field>

              <div />
            </div>

            <Field
              label="Remarks"
              required={bgv.status === "REJECTED"}
              error={errors["bgv.remarks"]}
              help={bgv.status === "REJECTED" ? "Mandatory for rejected cases" : "Optional"}
            >
              <Textarea
                className={cn("min-h-[84px] border-zc-border", errors["bgv.remarks"] ? "border-red-500" : "")}
                value={bgv.remarks ?? ""}
                onChange={(e) => updateBgv("remarks", e.target.value)}
                placeholder="Notes, exceptions, clarifications..."
              />
            </Field>
          </div>

          <Separator className="bg-zc-border" />

          {/* Police verification */}
          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Police verification</div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Status" required error={errors["police.status"]}>
                <Select value={police.status ?? ""} onValueChange={(v) => updatePolice("status", v as VerificationStatus)}>
                  <SelectTrigger className={cn("border-zc-border", errors["police.status"] ? "border-red-500" : "")}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_INITIATED">Not initiated</SelectItem>
                    <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                    <SelectItem value="VERIFIED">Verified</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Police station"
                required={police.status === "VERIFIED"}
                error={errors["police.police_station"]}
              >
                <Input
                  className={cn("border-zc-border", errors["police.police_station"] ? "border-red-500" : "")}
                  value={police.police_station ?? ""}
                  onChange={(e) => updatePolice("police_station", e.target.value)}
                  placeholder="e.g., Indiranagar PS"
                />
              </Field>

              <Field label="Application number" error={errors["police.application_number"]}>
                <Input
                  className={cn("border-zc-border", errors["police.application_number"] ? "border-red-500" : "")}
                  value={police.application_number ?? ""}
                  onChange={(e) => updatePolice("application_number", e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Application date" error={errors["police.application_date"]}>
                <Input
                  type="date"
                  className={cn("border-zc-border", errors["police.application_date"] ? "border-red-500" : "")}
                  value={police.application_date ?? ""}
                  onChange={(e) => updatePolice("application_date", e.target.value)}
                />
              </Field>

              <Field
                label="Verification date"
                required={police.status === "VERIFIED"}
                error={errors["police.verification_date"]}
              >
                <Input
                  type="date"
                  className={cn("border-zc-border", errors["police.verification_date"] ? "border-red-500" : "")}
                  value={police.verification_date ?? ""}
                  onChange={(e) => updatePolice("verification_date", e.target.value)}
                />
              </Field>

              <Field label="Expiry date" error={errors["police.expiry_date"]} help="Optional; some certificates expire">
                <Input
                  type="date"
                  className={cn("border-zc-border", errors["police.expiry_date"] ? "border-red-500" : "")}
                  value={police.expiry_date ?? ""}
                  onChange={(e) => updatePolice("expiry_date", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Certificate URL" error={errors["police.certificate_url"]}>
                <Input
                  className={cn("border-zc-border", errors["police.certificate_url"] ? "border-red-500" : "")}
                  value={police.certificate_url ?? ""}
                  onChange={(e) => updatePolice("certificate_url", e.target.value)}
                  placeholder="https://..."
                />
              </Field>

              <div className="md:col-span-2" />
            </div>

            <Field
              label="Remarks"
              required={police.status === "REJECTED"}
              error={errors["police.remarks"]}
              help={police.status === "REJECTED" ? "Mandatory for rejected cases" : "Optional"}
            >
              <Textarea
                className={cn("min-h-[84px] border-zc-border", errors["police.remarks"] ? "border-red-500" : "")}
                value={police.remarks ?? ""}
                onChange={(e) => updatePolice("remarks", e.target.value)}
                placeholder="Notes, exceptions, clarifications..."
              />
            </Field>
          </div>

          <Separator className="bg-zc-border" />

          <div className="rounded-md border border-zc-border bg-zc-panel/40 p-3 text-xs text-zc-muted">
            <div className="font-medium text-zc-foreground">Notes</div>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                Draft keys saved as <span className="font-mono">background_verification</span> and{" "}
                <span className="font-mono">police_verification</span> (snake_case) to keep backend mapping clean.
              </li>
              <li>
                When a status is set to <span className="font-semibold">Verified</span>, authority + date become required.
                When <span className="font-semibold">Rejected</span>, remarks become required.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}

function Field({
  label,
  required,
  help,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-zc-muted">
          {label} {required ? <span className="text-red-500">*</span> : null}
        </Label>
        {help ? <span className="text-[10px] text-zc-muted">{help}</span> : null}
      </div>
      {children}
      {error ? <div className="text-xs text-red-500">{error}</div> : null}
    </div>
  );
}

function statusBadge(status: VerificationStatus) {
  switch (status) {
    case "VERIFIED":
      return { label: "Verified", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
    case "IN_PROGRESS":
      return { label: "In progress", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    case "REJECTED":
      return { label: "Rejected", className: "bg-red-500/15 text-red-600 dark:text-red-400" };
    case "EXPIRED":
      return { label: "Expired", className: "bg-red-500/15 text-red-600 dark:text-red-400" };
    case "NOT_INITIATED":
    default:
      return { label: "Not initiated", className: "text-zc-muted" };
  }
}

function cleanStr(v: any): string | undefined {
  const s = String(v ?? "").trim();
  return s ? s : undefined;
}

function cleanDate(v: any): string | undefined {
  const s = String(v ?? "").trim();
  return s ? s : undefined;
}

function looksLikeUrl(v: string): boolean {
  const s = String(v || "").trim();
  if (!s) return true;
  try {
    // allow http(s) + internal URLs
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidYmd(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}` === v;
}

function makeDraftId(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // ignore
  }
  return `draft_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function withDraftId(href: string, draftId: string | null): string {
  if (!draftId) return href;
  const u = new URL(href, "http://local");
  u.searchParams.set("draftId", draftId);
  return u.pathname + "?" + u.searchParams.toString();
}

function storageKey(draftId: string) {
  return `hrStaffOnboardingDraft:${draftId}`;
}

function readDraft(draftId: string): StaffOnboardingDraft {
  try {
    const raw = localStorage.getItem(storageKey(draftId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StaffOnboardingDraft;
  } catch {
    return {};
  }
}

function writeDraft(draftId: string, draft: StaffOnboardingDraft) {
  try {
    localStorage.setItem(storageKey(draftId), JSON.stringify(draft));
  } catch {
    // ignore
  }
}
