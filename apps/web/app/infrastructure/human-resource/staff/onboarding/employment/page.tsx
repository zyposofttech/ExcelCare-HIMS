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

type EngagementType = "EMPLOYEE" | "CONSULTANT" | "VISITING" | "CONTRACTOR" | "INTERN";
type EmploymentStatus = "PERMANENT" | "CONTRACT" | "VISITING" | "TEMPORARY";
type ProfessionalTrack = "CLINICAL" | "NON_CLINICAL";

type StaffCategory =
  | "DOCTOR"
  | "NURSE"
  | "PARAMEDIC"
  | "PHARMACIST"
  | "TECHNICIAN"
  | "ADMIN"
  | "STAFF"
  | "SECURITY"
  | "HOUSEKEEPING";

type ProfessionalDetailsDraft = {
  track: ProfessionalTrack | string;
  staff_category: StaffCategory | string;

  designation: string;
  department: string;

  primary_specialty?: string;
  secondary_specialties?: string[];

  reporting_manager?: string;
  reporting_manager_code?: string;

  years_experience?: number | null;
  qualifications?: string;
  languages?: string[];

  profile_summary?: string;
  notes?: string;
};

type EmploymentDetailsDraft = {
  staff_category?: StaffCategory | string;
  engagement_type?: EngagementType | string;
  employment_status?: EmploymentStatus | string;

  date_of_joining?: string; // YYYY-MM-DD

  // merged professional fields
  designation?: string;
  department?: string;
  reporting_manager?: string;

  professional_details?: ProfessionalDetailsDraft;

  // general notes
  notes?: string;
};

type IdentityDocumentDraft = {
  id: string;
  doc_type: string;
  doc_number: string;
  is_primary: boolean;
  verification_status?: string;
};

type StaffOnboardingDraft = {
  personal_details?: {
    identity_consent_acknowledged?: boolean;
    identity_documents?: IdentityDocumentDraft[];
    [k: string]: any;
  };
  contact_details?: Record<string, any>;
  employment_details?: EmploymentDetailsDraft;
  medical_details?: Record<string, any>;
  system_access?: Record<string, any>;
  assignments?: any[];
};

type FieldErrorMap = Record<string, string>;

const BASE = "/infrastructure/human-resource/staff/onboarding";
const CLINICAL_CATEGORIES = new Set(["DOCTOR", "NURSE", "PARAMEDIC", "PHARMACIST", "TECHNICIAN"]);

export default function HrStaffOnboardingEmploymentMergedPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const draftId = sp.get("draftId");

  const [loading, setLoading] = React.useState(true);
  const [dirty, setDirty] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrorMap>({});

  const [form, setForm] = React.useState<EmploymentDetailsDraft>({
    staff_category: "STAFF",
    engagement_type: "EMPLOYEE",
    employment_status: "PERMANENT",
    date_of_joining: "",
    designation: "",
    department: "",
    reporting_manager: "",
    professional_details: {
      track: "NON_CLINICAL",
      staff_category: "STAFF",
      designation: "",
      department: "",
      primary_specialty: "",
      secondary_specialties: [],
      reporting_manager: "",
      reporting_manager_code: "",
      years_experience: null,
      qualifications: "",
      languages: [],
      profile_summary: "",
      notes: "",
    },
    notes: "",
  });

  // Load local draft
  React.useEffect(() => {
    const id = draftId;
    if (!id) return;

    setLoading(true);
    try {
      const draft = readDraft(id);
      const ed = (draft.employment_details ?? {}) as EmploymentDetailsDraft;

      const pdRaw: any = ed.professional_details ?? {};
      const staff_category = String(ed.staff_category ?? pdRaw.staff_category ?? "STAFF").toUpperCase();
      const inferredTrack: ProfessionalTrack =
        CLINICAL_CATEGORIES.has(staff_category) ? "CLINICAL" : "NON_CLINICAL";
      const track = String(pdRaw.track ?? inferredTrack).toUpperCase();

      const secondary = Array.isArray(pdRaw.secondary_specialties)
        ? pdRaw.secondary_specialties.map((x: any) => String(x).trim()).filter(Boolean)
        : [];
      const langs = Array.isArray(pdRaw.languages)
        ? pdRaw.languages.map((x: any) => String(x).trim()).filter(Boolean)
        : [];

      const designation = String(ed.designation ?? pdRaw.designation ?? "").trim();
      const department = String(ed.department ?? pdRaw.department ?? "").trim();
      const reporting_manager = String(ed.reporting_manager ?? pdRaw.reporting_manager ?? "").trim();

      setForm({
        staff_category: (staff_category as any) || "STAFF",
        engagement_type: (String(ed.engagement_type ?? "EMPLOYEE").toUpperCase() as any) || "EMPLOYEE",
        employment_status: (String(ed.employment_status ?? "PERMANENT").toUpperCase() as any) || "PERMANENT",
        date_of_joining: String(ed.date_of_joining ?? "").slice(0, 10),

        designation,
        department,
        reporting_manager,

        professional_details: {
          track: (track as any) || inferredTrack,
          staff_category: (staff_category as any) || "STAFF",

          designation,
          department,

          primary_specialty: String(pdRaw.primary_specialty ?? "").trim(),
          secondary_specialties: secondary,

          reporting_manager,
          reporting_manager_code: String(pdRaw.reporting_manager_code ?? "").trim(),

          years_experience:
            pdRaw.years_experience === null || pdRaw.years_experience === undefined || pdRaw.years_experience === ""
              ? null
              : Number(pdRaw.years_experience),

          qualifications: String(pdRaw.qualifications ?? "").trim(),
          languages: langs,

          profile_summary: String(pdRaw.profile_summary ?? "").trim(),
          notes: String(pdRaw.notes ?? "").trim(),
        },

        notes: String(ed.notes ?? "").trim(),
      });
    } finally {
      setLoading(false);
      setDirty(false);
      setErrors({});
    }
  }, [draftId]);

  const derivedCategory = React.useMemo(() => deriveCategory(String(form.staff_category || "")), [form.staff_category]);

  const isClinical = React.useMemo(() => {
    const sc = String(form.staff_category ?? "").toUpperCase();
    const track = String(form.professional_details?.track ?? "").toUpperCase();
    return track === "CLINICAL" || CLINICAL_CATEGORIES.has(sc);
  }, [form.staff_category, form.professional_details?.track]);

  const identityGate = React.useMemo(() => {
    if (!draftId) return { ok: true, reason: "" };
    const d = readDraft(draftId);
    const consent = !!d.personal_details?.identity_consent_acknowledged;
    const docs = Array.isArray(d.personal_details?.identity_documents) ? d.personal_details?.identity_documents : [];
    const hasPrimary = docs.some((x) => x && x.is_primary && String((x as any).doc_number || "").trim());
    const ok = consent && docs.length > 0 && hasPrimary;
    return {
      ok,
      reason: ok ? "" : "Identity step is incomplete (consent + at least one primary ID document required).",
    };
  }, [draftId]);

  function clearErr(key: string) {
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function update<K extends keyof EmploymentDetailsDraft>(key: K, value: EmploymentDetailsDraft[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    clearErr(String(key));
  }

  function updateProfessional<K extends keyof ProfessionalDetailsDraft>(key: K, value: ProfessionalDetailsDraft[K]) {
    setForm((prev) => ({
      ...prev,
      professional_details: {
        ...(prev.professional_details ?? ({} as any)),
        [key]: value,
      },
    }));
    setDirty(true);
    clearErr(`pd.${String(key)}`);
  }

  function updateCategory(v: string) {
    const staff_category = String(v || "").toUpperCase();
    const inferredTrack: ProfessionalTrack =
      CLINICAL_CATEGORIES.has(staff_category) ? "CLINICAL" : "NON_CLINICAL";

    setForm((prev) => {
      const prevPd = prev.professional_details ?? ({} as any);
      const nextPd: ProfessionalDetailsDraft = {
        ...prevPd,
        staff_category: staff_category as any,
        track: inferredTrack,
        // if switching to non-clinical, clear specialties
        primary_specialty: inferredTrack === "NON_CLINICAL" ? "" : String(prevPd.primary_specialty ?? ""),
        secondary_specialties: inferredTrack === "NON_CLINICAL" ? [] : (prevPd.secondary_specialties ?? []),
      };
      return {
        ...prev,
        staff_category: staff_category as any,
        professional_details: nextPd,
      };
    });

    setDirty(true);
    clearErr("staff_category");
    clearErr("pd.staff_category");
    clearErr("pd.track");
    clearErr("pd.primary_specialty");
  }

  function updateSecondarySpecialties(csv: string) {
    const arr = String(csv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateProfessional("secondary_specialties", arr);
  }

  function updateLanguages(csv: string) {
    const arr = String(csv || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateProfessional("languages", arr);
  }

  function validate(): FieldErrorMap {
    const e: FieldErrorMap = {};

    if (!String(form.staff_category ?? "").trim()) e.staff_category = "Staff category is required.";
    if (!String(form.engagement_type ?? "").trim()) e.engagement_type = "Engagement type is required.";
    if (!String(form.employment_status ?? "").trim()) e.employment_status = "Employment status is required.";

    if (!String(form.date_of_joining ?? "").trim()) e.date_of_joining = "Date of joining is required.";
    else if (!isValidYmd(String(form.date_of_joining))) e.date_of_joining = "Invalid date.";

    const pd = form.professional_details ?? ({} as any);

    const track = String(pd.track ?? "").trim();
    if (!track) e["pd.track"] = "Track is required.";

    const designation = String(form.designation ?? "").trim();
    const department = String(form.department ?? "").trim();
    if (!designation) e.designation = "Designation is required.";
    if (!department) e.department = "Department is required.";

    if (isClinical) {
      const ps = String(pd.primary_specialty ?? "").trim();
      if (!ps) e["pd.primary_specialty"] = "Primary specialty is required for clinical staff.";
    }

    const ye = pd.years_experience;
    if (ye !== null && ye !== undefined && String(ye) !== "") {
      const n = Number(ye);
      if (Number.isNaN(n) || n < 0 || n > 80) e["pd.years_experience"] = "Years of experience must be between 0 and 80.";
    }

    return e;
  }

  function normalizeEmploymentDraft(d: EmploymentDetailsDraft): EmploymentDetailsDraft {
    const staffCategory = String(d.staff_category ?? "").trim().toUpperCase();
    const engagementType = String(d.engagement_type ?? "").trim().toUpperCase();
    const employmentStatus = String(d.employment_status ?? "").trim().toUpperCase();

    const designation = String(d.designation ?? "").trim();
    const department = String(d.department ?? "").trim();
    const reporting_manager = String(d.reporting_manager ?? "").trim();

    const pd = d.professional_details ?? ({} as any);

    const pdTrack = String(pd.track ?? "").toUpperCase();
    const inferredTrack: ProfessionalTrack =
      CLINICAL_CATEGORIES.has(staffCategory) ? "CLINICAL" : "NON_CLINICAL";

    const normalizedPd: ProfessionalDetailsDraft = {
      track: (pdTrack as any) || inferredTrack,
      staff_category: (staffCategory as any) || "STAFF",

      designation,
      department,

      primary_specialty:
        isClinical ? String(pd.primary_specialty ?? "").trim() || undefined : undefined,
      secondary_specialties: isClinical
        ? (Array.isArray(pd.secondary_specialties)
            ? pd.secondary_specialties.map((x: any) => String(x).trim()).filter(Boolean)
            : [])
        : [],

      reporting_manager: reporting_manager || undefined,
      reporting_manager_code: String(pd.reporting_manager_code ?? "").trim() || undefined,

      years_experience:
        pd.years_experience === null || pd.years_experience === undefined || String(pd.years_experience) === ""
          ? null
          : Number(pd.years_experience),

      qualifications: String(pd.qualifications ?? "").trim() || undefined,
      languages: Array.isArray(pd.languages) ? pd.languages.map((x: any) => String(x).trim()).filter(Boolean) : [],

      profile_summary: String(pd.profile_summary ?? "").trim() || undefined,
      notes: String(pd.notes ?? "").trim() || undefined,
    };

    return {
      staff_category: staffCategory || undefined,
      engagement_type: engagementType || undefined,
      employment_status: employmentStatus || undefined,

      date_of_joining: String(d.date_of_joining ?? "").trim() || undefined,

      designation: designation || undefined,
      department: department || undefined,
      reporting_manager: reporting_manager || undefined,

      professional_details: normalizedPd,

      notes: String(d.notes ?? "").trim() || undefined,
    };
  }

  function saveDraftOrThrow() {
    const id = draftId;
    if (!id) return;

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      toast({
        variant: "destructive",
        title: "Missing required fields",
        description: "Please fix the highlighted fields to continue.",
      });
      throw new Error("validation_failed");
    }

    const existing = readDraft(id);

    // keep convenience fields aligned with professional_details
    const merged: EmploymentDetailsDraft = {
      ...form,
      professional_details: {
        ...(form.professional_details as any),
        staff_category: String(form.staff_category ?? "").toUpperCase(),
        designation: String(form.designation ?? "").trim(),
        department: String(form.department ?? "").trim(),
        reporting_manager: String(form.reporting_manager ?? "").trim(),
      },
    };

    const nextDraft: StaffOnboardingDraft = {
      ...existing,
      employment_details: normalizeEmploymentDraft(merged),
    };

    writeDraft(id, nextDraft);
    setDirty(false);

    toast({ title: "Saved", description: "Employment + professional details saved to draft." });
  }

  function onSaveOnly() {
    try {
      saveDraftOrThrow();
    } catch {}
  }

  function onSaveAndNext() {
    try {
      saveDraftOrThrow();
      if (!identityGate.ok) {
        toast({
          variant: "destructive",
          title: "Complete Identity step first",
          description: identityGate.reason,
        });
        return;
      }
      router.push(withDraftId(`${BASE}/credentials`, draftId) as any);
    } catch {}
  }

  const secondaryCsv = (form.professional_details?.secondary_specialties ?? []).join(", ");
  const langCsv = (form.professional_details?.languages ?? []).join(", ");

  return (
    <OnboardingShell
      stepKey="employment"
      title="Employment & professional details"
      description="Add employment details like staff category, employment status, designation, and department. Also capture professional details and profile summary."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            className="border-zc-border"
            onClick={() => router.push(withDraftId(`${BASE}/identity`, draftId) as any)}
          >
            Back
          </Button>

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
            <div className="text-sm font-medium text-zc-foreground">Step 3: Professional Details</div>
            <div className="mt-1 text-xs text-zc-muted">
              Required: staff category + engagement + employment status + date of joining + designation + department.
              Clinical staff also require primary specialty.
            </div>
            {!identityGate.ok ? (
              <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                {identityGate.reason}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="border border-zc-border">
              Derived category: {derivedCategory}
            </Badge>

            {isClinical ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" variant="secondary">
                Clinical
              </Badge>
            ) : (
              <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400" variant="secondary">
                Non-clinical
              </Badge>
            )}

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
          {/* Employment core */}
          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Employment (required)</div>

            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Staff category" required error={errors.staff_category}>
                <Select value={String(form.staff_category ?? "")} onValueChange={updateCategory}>
                  <SelectTrigger className={cn("border-zc-border", errors.staff_category ? "border-red-500" : "")}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOCTOR">Doctor</SelectItem>
                    <SelectItem value="NURSE">Nurse</SelectItem>
                    <SelectItem value="PARAMEDIC">Paramedic</SelectItem>
                    <SelectItem value="PHARMACIST">Pharmacist</SelectItem>
                    <SelectItem value="TECHNICIAN">Technician</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="SECURITY">Security</SelectItem>
                    <SelectItem value="HOUSEKEEPING">Housekeeping</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Engagement type" required error={errors.engagement_type}>
                <Select value={String(form.engagement_type ?? "")} onValueChange={(v) => update("engagement_type", v)}>
                  <SelectTrigger className={cn("border-zc-border", errors.engagement_type ? "border-red-500" : "")}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="CONSULTANT">Consultant</SelectItem>
                    <SelectItem value="VISITING">Visiting</SelectItem>
                    <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                    <SelectItem value="INTERN">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Employment status" required error={errors.employment_status}>
                <Select value={String(form.employment_status ?? "")} onValueChange={(v) => update("employment_status", v)}>
                  <SelectTrigger className={cn("border-zc-border", errors.employment_status ? "border-red-500" : "")}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERMANENT">Permanent</SelectItem>
                    <SelectItem value="CONTRACT">Contract</SelectItem>
                    <SelectItem value="VISITING">Visiting</SelectItem>
                    <SelectItem value="TEMPORARY">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Date of joining" required error={errors.date_of_joining}>
                <Input
                  type="date"
                  className={cn("border-zc-border", errors.date_of_joining ? "border-red-500" : "")}
                  value={String(form.date_of_joining ?? "")}
                  onChange={(e) => update("date_of_joining", e.target.value)}
                />
              </Field>
            </div>
          </div>

          <Separator className="bg-zc-border" />

          {/* Professional core */}
          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Professional (required)</div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Track" required error={errors["pd.track"]}>
                <Select
                  value={String(form.professional_details?.track ?? "")}
                  onValueChange={(v) => updateProfessional("track", String(v).toUpperCase() as any)}
                >
                  <SelectTrigger className={cn("border-zc-border", errors["pd.track"] ? "border-red-500" : "")}>
                    <SelectValue placeholder="Select track" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLINICAL">Clinical</SelectItem>
                    <SelectItem value="NON_CLINICAL">Non-clinical</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Years of experience" help="Optional" error={errors["pd.years_experience"]}>
                <Input
                  className={cn("border-zc-border", errors["pd.years_experience"] ? "border-red-500" : "")}
                  value={
                    form.professional_details?.years_experience === null || form.professional_details?.years_experience === undefined
                      ? ""
                      : String(form.professional_details?.years_experience)
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    updateProfessional("years_experience", v === "" ? null : Number(v));
                  }}
                  inputMode="numeric"
                  placeholder="e.g., 5"
                />
              </Field>

              <Field label="Reporting manager" help="Optional">
                <Input
                  className="border-zc-border"
                  value={String(form.reporting_manager ?? "")}
                  onChange={(e) => update("reporting_manager", e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Designation" required error={errors.designation}>
                <Input
                  className={cn("border-zc-border", errors.designation ? "border-red-500" : "")}
                  value={String(form.designation ?? "")}
                  onChange={(e) => update("designation", e.target.value)}
                  placeholder="e.g., Consultant / Staff Nurse / Technician"
                />
              </Field>

              <Field label="Department" required error={errors.department}>
                <Input
                  className={cn("border-zc-border", errors.department ? "border-red-500" : "")}
                  value={String(form.department ?? "")}
                  onChange={(e) => update("department", e.target.value)}
                  placeholder="e.g., Cardiology / OT / Admin"
                />
              </Field>
            </div>

            {isClinical ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Primary specialty" required error={errors["pd.primary_specialty"]}>
                  <Input
                    className={cn("border-zc-border", errors["pd.primary_specialty"] ? "border-red-500" : "")}
                    value={String(form.professional_details?.primary_specialty ?? "")}
                    onChange={(e) => updateProfessional("primary_specialty", e.target.value)}
                    placeholder="e.g., Interventional Cardiology"
                  />
                </Field>

                <Field label="Secondary specialties" help="Comma separated">
                  <Input
                    className="border-zc-border"
                    value={secondaryCsv}
                    onChange={(e) => updateSecondarySpecialties(e.target.value)}
                    placeholder="e.g., Echocardiography, Critical Care"
                  />
                </Field>
              </div>
            ) : (
              <div className="rounded-md border border-zc-border bg-zc-panel/40 p-3 text-xs text-zc-muted">
                <div className="font-medium text-zc-foreground">Clinical specialties</div>
                <div className="mt-1">Not applicable for non-clinical staff categories.</div>
              </div>
            )}
          </div>

          <Separator className="bg-zc-border" />

          {/* Optional profile */}
          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Profile (optional)</div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Reporting manager code" help="Optional">
                <Input
                  className="border-zc-border"
                  value={String(form.professional_details?.reporting_manager_code ?? "")}
                  onChange={(e) => updateProfessional("reporting_manager_code", e.target.value)}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Languages" help="Comma separated">
                <Input
                  className="border-zc-border"
                  value={langCsv}
                  onChange={(e) => updateLanguages(e.target.value)}
                  placeholder="e.g., English, Hindi, Kannada"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Qualifications" help="Free text">
                <Textarea
                  className="border-zc-border"
                  value={String(form.professional_details?.qualifications ?? "")}
                  onChange={(e) => updateProfessional("qualifications", e.target.value)}
                  placeholder="e.g., MBBS, MD / BSc Nursing / Diploma etc."
                />
              </Field>

              <Field label="Profile summary" help="Optional (1–3 lines)">
                <Textarea
                  className="border-zc-border"
                  value={String(form.professional_details?.profile_summary ?? "")}
                  onChange={(e) => updateProfessional("profile_summary", e.target.value)}
                  placeholder="Short professional summary…"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Professional notes" help="Optional">
                <Textarea
                  className="border-zc-border"
                  value={String(form.professional_details?.notes ?? "")}
                  onChange={(e) => updateProfessional("notes", e.target.value)}
                  placeholder="Internal notes…"
                />
              </Field>

              <Field label="General notes" help="Optional">
                <Textarea
                  className="border-zc-border"
                  value={String(form.notes ?? "")}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Optional notes…"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-md border border-zc-border bg-zc-panel/40 p-3 text-xs text-zc-muted">
            <div className="font-medium text-zc-foreground">Next step</div>
            <div className="mt-1">
              Credentials: <span className="font-mono">/onboarding/credentials</span>
            </div>
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

function isValidYmd(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}` === v;
}

function deriveCategory(staffCategory: string): "CLINICAL" | "NON_CLINICAL" {
  const s = String(staffCategory || "").toUpperCase();
  if (["DOCTOR", "NURSE", "PARAMEDIC", "PHARMACIST", "TECHNICIAN"].includes(s)) return "CLINICAL";
  return "NON_CLINICAL";
}
