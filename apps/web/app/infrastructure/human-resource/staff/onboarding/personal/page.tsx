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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/use-toast";

/**
 * Single-step merge:
 * - Personal details (name + DOB + gender)
 * - Contact details (phone + email + emergency + notes)
 * - Address details (structured current + permanent + sameAsCurrent)
 *
 * Saves into local draft: hrStaffOnboardingDraft:${draftId}
 * Keeps backward-compatible string address inside contact_details for Review/older steps.
 */

type TitleCode = "DR" | "MR" | "MS" | "MRS" | "MX" | "PROF";
type GenderCode = "MALE" | "FEMALE" | "OTHER";
type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED" | "SEPARATED";

type PersonalDetailsDraft = {
  title?: TitleCode;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  display_name?: string;
  date_of_birth?: string; // YYYY-MM-DD
  gender?: GenderCode;
  blood_group?: BloodGroup;
  marital_status?: MaritalStatus;

  // start step fields (keep compatible)
  employee_id?: string;
  full_name?: string;
  staff_category?: "MEDICAL" | "NON_MEDICAL";
};

type ContactDetailsDraft = {
  mobile_primary?: string;
  mobile_secondary?: string;

  email_official?: string;
  email_personal?: string;

  // Backward compatible string addresses (also used by some Review logic)
  current_address?: string;
  permanent_address?: string;

  emergency_contact?: {
    name?: string;
    relation?: string;
    phone?: string;
  } | null;

  notes?: string;
};

type AddressDraft = {
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
};

type AddressDetailsDraft = {
  current_address?: AddressDraft;
  permanent_address?: AddressDraft;
  is_same_as_current?: boolean;
};

type StaffOnboardingDraft = {
  personal_details?: PersonalDetailsDraft;
  contact_details?: ContactDetailsDraft;
  address_details?: AddressDetailsDraft;
  employment_details?: Record<string, any>;
  assignments?: any[];
  system_access?: Record<string, any>;
};

type FieldErrorMap = Record<string, string>;

const BASE = "/infrastructure/human-resource/staff/onboarding";

export default function HrStaffOnboardingPersonalMergedPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const draftId = sp.get("draftId");

  const [loading, setLoading] = React.useState(true);
  const [dirty, setDirty] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrorMap>({});

  // PERSONAL
  const [personal, setPersonal] = React.useState<PersonalDetailsDraft>({
    title: undefined,
    first_name: "",
    middle_name: "",
    last_name: "",
    display_name: "",
    date_of_birth: "",
    gender: undefined,
    blood_group: undefined,
    marital_status: undefined,
  });

  // CONTACT
  const [contact, setContact] = React.useState<ContactDetailsDraft>({
    mobile_primary: "",
    mobile_secondary: "",
    email_official: "",
    email_personal: "",
    emergency_contact: { name: "", relation: "", phone: "" },
    notes: "",
  });

  // ADDRESS (structured)
  const [sameAsCurrent, setSameAsCurrent] = React.useState<boolean>(true);

  const [currentAddr, setCurrentAddr] = React.useState<AddressDraft>({
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
  });

  const [permanentAddr, setPermanentAddr] = React.useState<AddressDraft>({
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
  });

  const age = React.useMemo(() => computeAge(personal.date_of_birth), [personal.date_of_birth]);

  // Require draftId
  React.useEffect(() => {
    if (draftId) return;
    router.replace(`${BASE}/start` as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  // Load draft
  React.useEffect(() => {
    const id = draftId;
    if (!id) return;

    setLoading(true);
    try {
      const draft = readDraft(id);

      const pd = (draft.personal_details ?? {}) as PersonalDetailsDraft;
      const cd = (draft.contact_details ?? {}) as ContactDetailsDraft;
      const ad = (draft.address_details ?? {}) as AddressDetailsDraft;

      // Personal
      setPersonal({
        ...pd,
        title: pd.title,
        first_name: pd.first_name ?? "",
        middle_name: pd.middle_name ?? "",
        last_name: pd.last_name ?? "",
        display_name: pd.display_name ?? "",
        date_of_birth: pd.date_of_birth ?? "",
        gender: pd.gender,
        blood_group: pd.blood_group,
        marital_status: pd.marital_status,
      });

      // Contact
      const emg = cd.emergency_contact ?? { name: "", relation: "", phone: "" };
      setContact({
        mobile_primary: String(cd.mobile_primary ?? "").trim(),
        mobile_secondary: String(cd.mobile_secondary ?? "").trim(),
        email_official: String(cd.email_official ?? "").trim(),
        email_personal: String(cd.email_personal ?? "").trim(),
        current_address: String(cd.current_address ?? "").trim(),
        permanent_address: String(cd.permanent_address ?? "").trim(),
        emergency_contact: {
          name: String((emg as any)?.name ?? "").trim(),
          relation: String((emg as any)?.relation ?? "").trim(),
          phone: String((emg as any)?.phone ?? "").trim(),
        },
        notes: String(cd.notes ?? "").trim(),
      });

      // Address (seed from structured, else derive from string)
      const seededCurrent = ad.current_address ?? seedAddressFromString(cd.current_address);
      const seededPermanent = ad.permanent_address ?? seedAddressFromString(cd.permanent_address);
      const same = ad.is_same_as_current ?? false;

      setSameAsCurrent(!!same);

      setCurrentAddr({
        address_line1: String(seededCurrent?.address_line1 ?? "").trim(),
        address_line2: String(seededCurrent?.address_line2 ?? "").trim(),
        city: String(seededCurrent?.city ?? "").trim(),
        state: String(seededCurrent?.state ?? "").trim(),
        country: String(seededCurrent?.country ?? "India").trim() || "India",
        pincode: String(seededCurrent?.pincode ?? "").trim(),
      });

      setPermanentAddr({
        address_line1: String(seededPermanent?.address_line1 ?? "").trim(),
        address_line2: String(seededPermanent?.address_line2 ?? "").trim(),
        city: String(seededPermanent?.city ?? "").trim(),
        state: String(seededPermanent?.state ?? "").trim(),
        country: String(seededPermanent?.country ?? "India").trim() || "India",
        pincode: String(seededPermanent?.pincode ?? "").trim(),
      });
    } finally {
      setLoading(false);
      setDirty(false);
      setErrors({});
    }
  }, [draftId]);

  // ----- update helpers -----
  function markDirtyClearError(key: string) {
    setDirty(true);
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function updatePersonal<K extends keyof PersonalDetailsDraft>(key: K, value: PersonalDetailsDraft[K]) {
    setPersonal((prev) => ({ ...prev, [key]: value }));
    markDirtyClearError(String(key));
  }

  function updateContact<K extends keyof ContactDetailsDraft>(key: K, value: ContactDetailsDraft[K]) {
    setContact((prev) => ({ ...prev, [key]: value }));
    markDirtyClearError(String(key));
  }

  function updateEmergency<K extends keyof NonNullable<ContactDetailsDraft["emergency_contact"]>>(key: K, value: string) {
    setContact((prev) => ({
      ...prev,
      emergency_contact: {
        ...(prev.emergency_contact ?? {}),
        [key]: value,
      },
    }));
    markDirtyClearError(`emergency_contact.${String(key)}`);
  }

  function updateCurrent<K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) {
    setCurrentAddr((prev) => ({ ...prev, [key]: value }));
    markDirtyClearError(`current.${String(key)}`);
  }

  function updatePermanent<K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) {
    setPermanentAddr((prev) => ({ ...prev, [key]: value }));
    markDirtyClearError(`permanent.${String(key)}`);
  }

  function autoComputeDisplayName() {
    const dn = computeDisplayName(personal.title, personal.first_name, personal.middle_name, personal.last_name);
    updatePersonal("display_name", dn);
  }

  function toggleSame(next: boolean) {
    setSameAsCurrent(next);
    setDirty(true);
    if (next) {
      setPermanentAddr({
        address_line1: currentAddr.address_line1 ?? "",
        address_line2: currentAddr.address_line2 ?? "",
        city: currentAddr.city ?? "",
        state: currentAddr.state ?? "",
        country: currentAddr.country ?? "India",
        pincode: currentAddr.pincode ?? "",
      });
    }
  }

  // ----- validation -----
  function validateAll(): FieldErrorMap {
    const e: FieldErrorMap = {};

    // Personal required
    if (!personal.title) e.title = "Title is required.";
    if (!String(personal.first_name ?? "").trim()) e.first_name = "First name is required.";
    if (!String(personal.last_name ?? "").trim()) e.last_name = "Last name is required.";
    if (!String(personal.display_name ?? "").trim()) e.display_name = "Display name is required.";
    if (!String(personal.date_of_birth ?? "").trim()) e.date_of_birth = "Date of birth is required.";
    if (personal.date_of_birth && !isValidYmd(personal.date_of_birth)) e.date_of_birth = "Invalid date.";
    if (personal.date_of_birth && computeAge(personal.date_of_birth) === null) e.date_of_birth = "Date is out of range.";
    if (!personal.gender) e.gender = "Gender is required.";

    // Contact required by workflow: phone + email
    if (!String(contact.mobile_primary ?? "").trim()) e.mobile_primary = "Primary mobile is required.";
    else if (!isPhone10(contact.mobile_primary ?? "")) e.mobile_primary = "Primary mobile must be exactly 10 digits.";

    if (!String(contact.email_official ?? "").trim()) e.email_official = "Official email is required.";
    else if (!isEmail(contact.email_official ?? "")) e.email_official = "Official email format is invalid.";

    // Optional validations
    if (String(contact.mobile_secondary ?? "").trim() && !isPhone10(contact.mobile_secondary ?? "")) {
      e.mobile_secondary = "Secondary mobile must be exactly 10 digits.";
    }
    if (String(contact.email_personal ?? "").trim() && !isEmail(contact.email_personal ?? "")) {
      e.email_personal = "Personal email format is invalid.";
    }
    const emg = contact.emergency_contact ?? null;
    const emgAny = !!(emg?.name?.trim() || emg?.relation?.trim() || emg?.phone?.trim());
    if (emgAny && emg?.phone?.trim() && !isPhone10(emg.phone)) {
      e["emergency_contact.phone"] = "Emergency phone must be 10 digits.";
    }

    // Address required (structured current always, permanent if not sameAsCurrent)
    if (!String(currentAddr.address_line1 ?? "").trim()) e["current.address_line1"] = "Address line 1 is required.";
    if (!String(currentAddr.city ?? "").trim()) e["current.city"] = "City is required.";
    if (!String(currentAddr.state ?? "").trim()) e["current.state"] = "State is required.";
    if (!String(currentAddr.country ?? "").trim()) e["current.country"] = "Country is required.";
    if (!String(currentAddr.pincode ?? "").trim()) e["current.pincode"] = "Pincode is required.";
    else if (!isPincode(currentAddr.pincode ?? "")) e["current.pincode"] = "Pincode must be 6 digits.";

    if (!sameAsCurrent) {
      if (!String(permanentAddr.address_line1 ?? "").trim()) e["permanent.address_line1"] = "Address line 1 is required.";
      if (!String(permanentAddr.city ?? "").trim()) e["permanent.city"] = "City is required.";
      if (!String(permanentAddr.state ?? "").trim()) e["permanent.state"] = "State is required.";
      if (!String(permanentAddr.country ?? "").trim()) e["permanent.country"] = "Country is required.";
      if (!String(permanentAddr.pincode ?? "").trim()) e["permanent.pincode"] = "Pincode is required.";
      else if (!isPincode(permanentAddr.pincode ?? "")) e["permanent.pincode"] = "Pincode must be 6 digits.";
    }

    return e;
  }

  function saveDraftOrThrow() {
    const id = draftId;
    if (!id) return;

    const nextErrors = validateAll();
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

    const normalizedPersonal = normalizePersonalDraft({
      ...personal,
      display_name:
        String(personal.display_name ?? "").trim() ||
        computeDisplayName(personal.title, personal.first_name, personal.middle_name, personal.last_name),
    });

    const normalizedCurrent: AddressDraft = {
      address_line1: String(currentAddr.address_line1 ?? "").trim(),
      address_line2: currentAddr.address_line2?.trim() ? String(currentAddr.address_line2).trim() : undefined,
      city: String(currentAddr.city ?? "").trim(),
      state: String(currentAddr.state ?? "").trim(),
      country: String(currentAddr.country ?? "").trim(),
      pincode: normalizePincode(currentAddr.pincode),
    };

    const normalizedPermanent: AddressDraft = sameAsCurrent
      ? { ...normalizedCurrent }
      : {
          address_line1: String(permanentAddr.address_line1 ?? "").trim(),
          address_line2: permanentAddr.address_line2?.trim() ? String(permanentAddr.address_line2).trim() : undefined,
          city: String(permanentAddr.city ?? "").trim(),
          state: String(permanentAddr.state ?? "").trim(),
          country: String(permanentAddr.country ?? "").trim(),
          pincode: normalizePincode(permanentAddr.pincode),
        };

    // Backward compatible string copies
    const currentStr = formatAddress(normalizedCurrent);
    const permanentStr = sameAsCurrent ? currentStr : formatAddress(normalizedPermanent);

    const emg = contact.emergency_contact ?? { name: "", relation: "", phone: "" };
    const emgAny = !!(emg.name?.trim() || emg.relation?.trim() || emg.phone?.trim());

    const nextDraft: StaffOnboardingDraft = {
      ...existing,
      personal_details: {
        ...(existing.personal_details ?? {}),
        ...normalizedPersonal,
      },
      address_details: {
        current_address: normalizedCurrent,
        permanent_address: normalizedPermanent,
        is_same_as_current: sameAsCurrent,
      },
      contact_details: {
        ...(existing.contact_details ?? {}),
        mobile_primary: normalizePhone(contact.mobile_primary),
        mobile_secondary: contact.mobile_secondary?.trim() ? normalizePhone(contact.mobile_secondary) : undefined,

        email_official: (contact.email_official ?? "").trim().toLowerCase(),
        email_personal: contact.email_personal?.trim() ? contact.email_personal.trim().toLowerCase() : undefined,

        current_address: currentStr,
        permanent_address: permanentStr,

        emergency_contact: emgAny
          ? {
              name: emg.name?.trim() || undefined,
              relation: emg.relation?.trim() || undefined,
              phone: emg.phone?.trim() ? normalizePhone(emg.phone) : undefined,
            }
          : null,

        notes: contact.notes?.trim() ? contact.notes.trim() : undefined,
      },
    };

    writeDraft(id, nextDraft);
    setDirty(false);

    toast({ title: "Saved", description: "Personal details saved to draft." });
  }

  function onSaveOnly() {
    try {
      saveDraftOrThrow();
    } catch {
      // handled
    }
  }

  function onSaveAndNext() {
    try {
      saveDraftOrThrow();
      // After merge, jump directly to Identity
      router.push(withDraftId(`${BASE}/identity`, draftId) as any);
    } catch {
      // handled
    }
  }

  const currentPostalOk = React.useMemo(() => isPincode(currentAddr.pincode || ""), [currentAddr.pincode]);
  const permanentPostalOk = React.useMemo(() => isPincode(permanentAddr.pincode || ""), [permanentAddr.pincode]);

  return (
    <OnboardingShell
      stepKey="personal"
      title="Personal details"
      description="Add Personal, Contact and Address Details for the staff member. This is the first step of the onboarding process."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            className="border-zc-border"
            onClick={() => router.push("/infrastructure/human-resource/staff" as any)}

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
            <div className="text-sm font-medium text-zc-foreground">Step 1: Personal Details</div>
            <div className="mt-1 text-xs text-zc-muted">
              Required: title + name + DOB + gender + primary mobile + official email + current address.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {age !== null ? (
              <Badge variant="secondary" className="border border-zc-border">
                Age: {age} years
              </Badge>
            ) : (
              <Badge variant="secondary" className="border border-zc-border text-zc-muted">
                Age: —
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
          {/* PERSONAL */}
          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Basic details</div>

            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Title" required error={errors.title}>
                <Select value={personal.title ?? ""} onValueChange={(v) => updatePersonal("title", v as TitleCode)}>
                  <SelectTrigger className={cn("border-zc-border", errors.title ? "border-red-500" : "")}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DR">Dr.</SelectItem>
                    <SelectItem value="MR">Mr.</SelectItem>
                    <SelectItem value="MS">Ms.</SelectItem>
                    <SelectItem value="MRS">Mrs.</SelectItem>
                    <SelectItem value="MX">Mx.</SelectItem>
                    <SelectItem value="PROF">Prof.</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="First name" required error={errors.first_name}>
                <Input
                  className={cn("border-zc-border", errors.first_name ? "border-red-500" : "")}
                  value={personal.first_name ?? ""}
                  onChange={(e) => updatePersonal("first_name", e.target.value)}
                  placeholder="e.g., Rajesh"
                />
              </Field>

              <Field label="Middle name" error={errors.middle_name}>
                <Input
                  className={cn("border-zc-border", errors.middle_name ? "border-red-500" : "")}
                  value={personal.middle_name ?? ""}
                  onChange={(e) => updatePersonal("middle_name", e.target.value)}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Last name" required error={errors.last_name}>
                <Input
                  className={cn("border-zc-border", errors.last_name ? "border-red-500" : "")}
                  value={personal.last_name ?? ""}
                  onChange={(e) => updatePersonal("last_name", e.target.value)}
                  placeholder="e.g., Sharma"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_180px]">
              <Field label="Display name" required help="Auto-computed, but editable" error={errors.display_name}>
                <Input
                  className={cn("border-zc-border", errors.display_name ? "border-red-500" : "")}
                  value={personal.display_name ?? ""}
                  onChange={(e) => updatePersonal("display_name", e.target.value)}
                  placeholder="e.g., Dr. Rajesh Kumar Sharma"
                />
              </Field>
              <div className="grid gap-2">
                <Label className="text-xs text-zc-muted">&nbsp;</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="border-zc-border"
                  onClick={autoComputeDisplayName}
                  disabled={loading}
                >
                  Auto compute
                </Button>
              </div>
            </div>
          </div>

          <Separator className="bg-zc-border" />

          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Personal details</div>

            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Date of birth" required error={errors.date_of_birth}>
                <Input
                  type="date"
                  className={cn("border-zc-border", errors.date_of_birth ? "border-red-500" : "")}
                  value={personal.date_of_birth ?? ""}
                  onChange={(e) => updatePersonal("date_of_birth", e.target.value)}
                />
              </Field>

              <Field label="Gender" required error={errors.gender}>
                <Select value={personal.gender ?? ""} onValueChange={(v) => updatePersonal("gender", v as GenderCode)}>
                  <SelectTrigger className={cn("border-zc-border", errors.gender ? "border-red-500" : "")}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Blood group" error={errors.blood_group}>
                <Select
                  value={personal.blood_group ?? ""}
                  onValueChange={(v) => updatePersonal("blood_group", (v || undefined) as BloodGroup)}
                >
                  <SelectTrigger className={cn("border-zc-border", errors.blood_group ? "border-red-500" : "")}>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Marital status" error={errors.marital_status}>
                <Select
                  value={personal.marital_status ?? ""}
                  onValueChange={(v) => updatePersonal("marital_status", (v || undefined) as MaritalStatus)}
                >
                  <SelectTrigger className={cn("border-zc-border", errors.marital_status ? "border-red-500" : "")}>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE">Single</SelectItem>
                    <SelectItem value="MARRIED">Married</SelectItem>
                    <SelectItem value="DIVORCED">Divorced</SelectItem>
                    <SelectItem value="WIDOWED">Widowed</SelectItem>
                    <SelectItem value="SEPARATED">Separated</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <Separator className="bg-zc-border" />

          {/* CONTACT */}
          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Contact</div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Primary mobile (10 digits)" required error={errors.mobile_primary}>
                <Input
                  className={cn("border-zc-border", errors.mobile_primary ? "border-red-500" : "")}
                  value={contact.mobile_primary ?? ""}
                  onChange={(e) => updateContact("mobile_primary", e.target.value)}
                  placeholder="10-digit mobile"
                />
              </Field>

              <Field label="Official email" required error={errors.email_official}>
                <Input
                  className={cn("border-zc-border", errors.email_official ? "border-red-500" : "")}
                  value={contact.email_official ?? ""}
                  onChange={(e) => updateContact("email_official", e.target.value)}
                  placeholder="name@hospital.com"
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Secondary mobile (10 digits)" error={errors.mobile_secondary}>
                <Input
                  className={cn("border-zc-border", errors.mobile_secondary ? "border-red-500" : "")}
                  value={contact.mobile_secondary ?? ""}
                  onChange={(e) => updateContact("mobile_secondary", e.target.value)}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Personal email" error={errors.email_personal}>
                <Input
                  className={cn("border-zc-border", errors.email_personal ? "border-red-500" : "")}
                  value={contact.email_personal ?? ""}
                  onChange={(e) => updateContact("email_personal", e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>
          </div>

          <Separator className="bg-zc-border" />

          {/* ADDRESS */}
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Address</div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className={cn(
                    "border border-zc-border",
                    currentPostalOk
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {currentPostalOk ? "Current pincode valid" : "Current pincode invalid"}
                </Badge>

                <div className="flex items-center gap-2">
                  <Switch checked={sameAsCurrent} onCheckedChange={toggleSame} />
                  <Label className="text-xs text-zc-muted">Permanent same as current</Label>
                </div>

                {!sameAsCurrent ? (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "border border-zc-border",
                      permanentPostalOk
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {permanentPostalOk ? "Permanent pincode valid" : "Permanent pincode invalid"}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Current address (required)</div>

              <Field label="Address line 1" required error={errors["current.address_line1"]}>
                <Textarea
                  className={cn("border-zc-border", errors["current.address_line1"] ? "border-red-500" : "")}
                  value={currentAddr.address_line1 ?? ""}
                  onChange={(e) => updateCurrent("address_line1", e.target.value)}
                  placeholder="House/Flat, Street, Area..."
                />
              </Field>

              <Field label="Address line 2" help="Optional (landmark, locality)" error={errors["current.address_line2"]}>
                <Textarea
                  className={cn("border-zc-border", errors["current.address_line2"] ? "border-red-500" : "")}
                  value={currentAddr.address_line2 ?? ""}
                  onChange={(e) => updateCurrent("address_line2", e.target.value)}
                  placeholder="Optional"
                />
              </Field>

              <div className="grid gap-3 md:grid-cols-4">
                <Field label="City" required error={errors["current.city"]}>
                  <Input
                    className={cn("border-zc-border", errors["current.city"] ? "border-red-500" : "")}
                    value={currentAddr.city ?? ""}
                    onChange={(e) => updateCurrent("city", e.target.value)}
                    placeholder="City"
                  />
                </Field>

                <Field label="State" required error={errors["current.state"]}>
                  <Input
                    className={cn("border-zc-border", errors["current.state"] ? "border-red-500" : "")}
                    value={currentAddr.state ?? ""}
                    onChange={(e) => updateCurrent("state", e.target.value)}
                    placeholder="State"
                  />
                </Field>

                <Field label="Country" required error={errors["current.country"]}>
                  <Input
                    className={cn("border-zc-border", errors["current.country"] ? "border-red-500" : "")}
                    value={currentAddr.country ?? ""}
                    onChange={(e) => updateCurrent("country", e.target.value)}
                    placeholder="Country"
                  />
                </Field>

                <Field label="Pincode" required error={errors["current.pincode"]}>
                  <Input
                    className={cn("border-zc-border", errors["current.pincode"] ? "border-red-500" : "")}
                    value={currentAddr.pincode ?? ""}
                    onChange={(e) => updateCurrent("pincode", e.target.value)}
                    placeholder="6 digits"
                    inputMode="numeric"
                  />
                </Field>
              </div>
            </div>

            {!sameAsCurrent ? (
              <div className="grid gap-3">
                <Separator className="bg-zc-border" />
                <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">
                  Permanent address (required)
                </div>

                <Field label="Address line 1" required error={errors["permanent.address_line1"]}>
                  <Textarea
                    className={cn("border-zc-border", errors["permanent.address_line1"] ? "border-red-500" : "")}
                    value={permanentAddr.address_line1 ?? ""}
                    onChange={(e) => updatePermanent("address_line1", e.target.value)}
                    placeholder="House/Flat, Street, Area..."
                  />
                </Field>

                <Field
                  label="Address line 2"
                  help="Optional (landmark, locality)"
                  error={errors["permanent.address_line2"]}
                >
                  <Textarea
                    className={cn("border-zc-border", errors["permanent.address_line2"] ? "border-red-500" : "")}
                    value={permanentAddr.address_line2 ?? ""}
                    onChange={(e) => updatePermanent("address_line2", e.target.value)}
                    placeholder="Optional"
                  />
                </Field>

                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="City" required error={errors["permanent.city"]}>
                    <Input
                      className={cn("border-zc-border", errors["permanent.city"] ? "border-red-500" : "")}
                      value={permanentAddr.city ?? ""}
                      onChange={(e) => updatePermanent("city", e.target.value)}
                      placeholder="City"
                    />
                  </Field>

                  <Field label="State" required error={errors["permanent.state"]}>
                    <Input
                      className={cn("border-zc-border", errors["permanent.state"] ? "border-red-500" : "")}
                      value={permanentAddr.state ?? ""}
                      onChange={(e) => updatePermanent("state", e.target.value)}
                      placeholder="State"
                    />
                  </Field>

                  <Field label="Country" required error={errors["permanent.country"]}>
                    <Input
                      className={cn("border-zc-border", errors["permanent.country"] ? "border-red-500" : "")}
                      value={permanentAddr.country ?? ""}
                      onChange={(e) => updatePermanent("country", e.target.value)}
                      placeholder="Country"
                    />
                  </Field>

                  <Field label="Pincode" required error={errors["permanent.pincode"]}>
                    <Input
                      className={cn("border-zc-border", errors["permanent.pincode"] ? "border-red-500" : "")}
                      value={permanentAddr.pincode ?? ""}
                      onChange={(e) => updatePermanent("pincode", e.target.value)}
                      placeholder="6 digits"
                      inputMode="numeric"
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-zc-border bg-zc-panel/40 p-3 text-xs text-zc-muted">
                Permanent address will be stored identical to the current address.
              </div>
            )}
          </div>

          <Separator className="bg-zc-border" />

          {/* Emergency + Notes */}
          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zc-muted">Emergency contact (optional)</div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Name" error={errors["emergency_contact.name"]}>
                <Input
                  className={cn("border-zc-border", errors["emergency_contact.name"] ? "border-red-500" : "")}
                  value={contact.emergency_contact?.name ?? ""}
                  onChange={(e) => updateEmergency("name", e.target.value)}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Relation" error={errors["emergency_contact.relation"]}>
                <Input
                  className={cn("border-zc-border", errors["emergency_contact.relation"] ? "border-red-500" : "")}
                  value={contact.emergency_contact?.relation ?? ""}
                  onChange={(e) => updateEmergency("relation", e.target.value)}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Phone (10 digits)" error={errors["emergency_contact.phone"]}>
                <Input
                  className={cn("border-zc-border", errors["emergency_contact.phone"] ? "border-red-500" : "")}
                  value={contact.emergency_contact?.phone ?? ""}
                  onChange={(e) => updateEmergency("phone", e.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs text-zc-muted">Notes</Label>
              <Textarea
                className="border-zc-border"
                value={contact.notes ?? ""}
                onChange={(e) => updateContact("notes", e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <div className="rounded-md border border-zc-border bg-zc-panel/40 p-3 text-xs text-zc-muted">
            <div className="font-medium text-zc-foreground">Next step</div>
            <div className="mt-1">
              Identity documents: <span className="font-mono">{BASE}/identity</span>
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

// ---------- draft helpers ----------
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

function withDraftId(href: string, draftId: string | null): string {
  if (!draftId) return href;
  const u = new URL(href, "http://local");
  u.searchParams.set("draftId", draftId);
  return u.pathname + "?" + u.searchParams.toString();
}

// ---------- validation helpers ----------
function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim().toLowerCase());
}

function normalizePhone(v: string | undefined) {
  return String(v || "")
    .replace(/[^\d]/g, "")
    .trim();
}

function isPhone10(v: string) {
  return /^\d{10}$/.test(normalizePhone(v));
}

function normalizePincode(v: string | undefined) {
  return String(v || "")
    .replace(/[^\d]/g, "")
    .trim();
}

function isPincode(v: string) {
  return /^\d{6}$/.test(normalizePincode(v));
}

// ---------- personal helpers ----------
function computeDisplayName(
  title: TitleCode | undefined,
  first: string | undefined,
  middle: string | undefined,
  last: string | undefined,
) {
  const t = titleToLabel(title);
  const parts = [t, (first ?? "").trim(), (middle ?? "").trim(), (last ?? "").trim()].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function titleToLabel(title: TitleCode | undefined): string {
  if (!title) return "";
  switch (title) {
    case "DR":
      return "Dr.";
    case "MR":
      return "Mr.";
    case "MS":
      return "Ms.";
    case "MRS":
      return "Mrs.";
    case "MX":
      return "Mx.";
    case "PROF":
      return "Prof.";
    default:
      return "";
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

function computeAge(ymd: string | undefined): number | null {
  if (!ymd || !isValidYmd(ymd)) return null;
  const dob = new Date(ymd + "T00:00:00Z");
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  let age = y - dob.getUTCFullYear();
  const mdiff = m - dob.getUTCMonth();
  if (mdiff < 0 || (mdiff === 0 && d < dob.getUTCDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

function normalizePersonalDraft(d: PersonalDetailsDraft): PersonalDetailsDraft {
  const title = d.title;
  const first = String(d.first_name ?? "").trim();
  const middle = String(d.middle_name ?? "").trim();
  const last = String(d.last_name ?? "").trim();

  const displayRaw = String(d.display_name ?? "").trim();
  const display = displayRaw || computeDisplayName(title, first, middle, last);

  return {
    // keep start step fields if present
    employee_id: d.employee_id,
    full_name: d.full_name,
    staff_category: d.staff_category,

    title,
    first_name: first || undefined,
    middle_name: middle || undefined,
    last_name: last || undefined,
    display_name: display || undefined,
    date_of_birth: String(d.date_of_birth ?? "").trim() || undefined,
    gender: d.gender,
    blood_group: d.blood_group,
    marital_status: d.marital_status,
  };
}

// ---------- address helpers ----------
function seedAddressFromString(raw?: string): AddressDraft {
  const s = String(raw ?? "").trim();
  if (!s) {
    return { address_line1: "", address_line2: "", city: "", state: "", country: "India", pincode: "" };
  }
  const pinMatch = s.match(/(\d{6})(?!.*\d)/);
  const pincode = pinMatch ? pinMatch[1] : "";
  return { address_line1: s, address_line2: "", city: "", state: "", country: "India", pincode };
}

function formatAddress(a: AddressDraft): string {
  const parts = [
    a.address_line1?.trim(),
    a.address_line2?.trim(),
    a.city?.trim(),
    a.state?.trim(),
    a.country?.trim(),
    a.pincode?.trim(),
  ].filter(Boolean);
  return parts.join(", ");
}
