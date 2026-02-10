"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  HeartPulse,
  KeyRound,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { apiFetch } from "@/lib/api";

import { STAFF_ONBOARDING_STEPS, StaffOnboardingStepId } from "../_lib/steps";

type Props = {
  title: string;
  description?: string;
  stepId?: StaffOnboardingStepId;
  stepKey?: string;
  draftId?: string;
  onSaveDraft?: () => void | Promise<void>;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

function deriveRoots(pathname: string | null) {
  const p = pathname ?? "";
  const idx = p.indexOf("/onboarding");
  const staffRoot = idx > 0 ? p.slice(0, idx) : "/infrastructure/human-resource/staff";
  const onboardingRoot = `${staffRoot}/onboarding`;
  return { staffRoot, onboardingRoot };
}

const STEP_ICONS: Partial<Record<StaffOnboardingStepId, React.ComponentType<{ className?: string }>>> = {
  personal: User,
  identity: BadgeCheck,
  employment: Briefcase,
  credentials: FileText,
  privileges: ShieldCheck,
  assignments: ClipboardList,
  background: ClipboardCheck,
  health: HeartPulse,
  "system-access": KeyRound,
  review: CheckCircle2,
  done: CheckCircle2,
};

function storageKey(draftId: string) {
  return `hrStaffOnboardingDraft:${draftId}`;
}

function readLocalDraft(draftId: string): any {
  try {
    const raw = localStorage.getItem(storageKey(draftId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function migrateLocalDraft(oldId: string, newId: string) {
  try {
    const raw = localStorage.getItem(storageKey(oldId));
    if (!raw) return;
    localStorage.setItem(storageKey(newId), raw);
    localStorage.removeItem(storageKey(oldId));
  } catch {
    // ignore
  }
}

function mapDob(pd: any) {
  if (!pd || typeof pd !== "object") return pd;
  // your Personal step saves date_of_birth but Review expects dob
  if (!pd.dob && pd.date_of_birth) return { ...pd, dob: pd.date_of_birth };
  return pd;
}

export function OnboardingShell({
  title,
  description,
  stepId: stepIdProp,
  stepKey,
  draftId: draftIdProp,
  onSaveDraft,
  footer,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { toast } = useToast();

  const initialStep = STAFF_ONBOARDING_STEPS[0]?.id ?? "personal";
  const stepId = (stepKey ?? stepIdProp ?? initialStep) as StaffOnboardingStepId;

  const { staffRoot } = React.useMemo(() => deriveRoots(pathname), [pathname]);

  const [draftId, setDraftId] = React.useState<string>(draftIdProp ?? sp.get("draftId") ?? "");
  const [initializing, setInitializing] = React.useState(false);

  // ✅ Ensure draftId always maps to a REAL server staffId
  React.useEffect(() => {
    if (draftId || initializing) return;

    async function initDraft() {
      setInitializing(true);
      try {
        const created = await apiFetch<{ staffId: string }>(`/api/infrastructure/staff/drafts`, {
          method: "POST",
          body: {},
        });
        if (!created?.staffId) throw new Error("No staffId returned");

        setDraftId(created.staffId);

        const url = new URL(window.location.href);
        url.searchParams.set("draftId", created.staffId);
        router.replace((url.pathname + "?" + url.searchParams.toString()) as any);

        toast({ title: "Draft initialized", description: "Created a new staff draft." });
      } catch (e: any) {
        toast({ variant: "destructive", title: "Draft init failed", description: e?.message ?? "Could not create draft." });
      } finally {
        setInitializing(false);
      }
    }

    initDraft();
  }, [draftId, initializing, router, toast]);

  // ✅ If URL draftId exists but server doesn’t have it, create real draft and migrate local data
  React.useEffect(() => {
    if (!draftId) return;
    let cancelled = false;

    async function validateDraft() {
      try {
        await apiFetch(`/api/infrastructure/staff/${encodeURIComponent(draftId)}`);
      } catch {
        // server doesn't know this id => create a new one and migrate localStorage
        try {
          const created = await apiFetch<{ staffId: string }>(`/api/infrastructure/staff/drafts`, {
            method: "POST",
            body: {},
          });
          if (!created?.staffId) throw new Error("No staffId returned");

          if (cancelled) return;

          migrateLocalDraft(draftId, created.staffId);
          setDraftId(created.staffId);

          const url = new URL(window.location.href);
          url.searchParams.set("draftId", created.staffId);
          router.replace((url.pathname + "?" + url.searchParams.toString()) as any);

          toast({
            title: "Draft repaired",
            description: "The previous draftId was invalid. We created a new server draft and migrated your local progress.",
          });
        } catch (e: any) {
          toast({ variant: "destructive", title: "Draft repair failed", description: e?.message ?? "Could not repair draft." });
        }
      }
    }

    validateDraft();
    return () => {
      cancelled = true;
    };
  }, [draftId, router, toast]);

  const goTo = React.useCallback(
    (nextStepId: StaffOnboardingStepId) => {
      const step = STAFF_ONBOARDING_STEPS.find((s) => s.id === nextStepId);
      if (!step) return;

      if (!draftId) return;
      const href = `${step.href}?draftId=${encodeURIComponent(draftId)}`;
      router.push(href as any);
    },
    [draftId, router],
  );

  // ✅ Save draft now syncs local draft JSON to backend
  const handleSaveDraft = async () => {
    if (!draftId) return;

    try {
      if (onSaveDraft) await onSaveDraft();

      const local = readLocalDraft(draftId);
      const patch = {
        onboardingStatus: "DRAFT",
        personal_details: mapDob(local?.personal_details ?? {}),
        contact_details: local?.contact_details ?? {},
        employment_details: local?.employment_details ?? {},
        medical_details: local?.medical_details ?? {},
        system_access: local?.system_access ?? {},
        // keep as-is for backend JSON columns:
        personalDetails: mapDob(local?.personal_details ?? {}),
        contactDetails: local?.contact_details ?? {},
        employmentDetails: local?.employment_details ?? {},
        medicalDetails: local?.medical_details ?? {},
        systemAccess: local?.system_access ?? {},
      };

      await apiFetch(`/api/infrastructure/staff/${encodeURIComponent(draftId)}`, {
        method: "PATCH",
        body: patch,
      });

      toast({ title: "Saved", description: "Draft saved to server successfully." });
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message ?? "Could not save draft.",
        variant: "destructive",
      });
    }
  };

  const visibleSteps = STAFF_ONBOARDING_STEPS.filter((s) => s.id !== "done");
  const ready = Boolean(draftId);

  return (
    <AppShell title="Staff Onboarding">
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="grid gap-6 w-full max-w-full">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between w-full max-w-full">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
                <UserPlus className="h-5 w-5 text-zc-accent" />
              </span>
              <div className="min-w-0">
                <div className="text-3xl font-semibold tracking-tight truncate">{title}</div>
                {description ? <div className="mt-1 text-sm text-zc-muted truncate">{description}</div> : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button variant="outline" className="px-5 gap-2" onClick={handleSaveDraft} disabled={!ready}>
                Save draft
              </Button>
              <Button variant="outline" className="px-5 gap-2" onClick={() => router.push(staffRoot as any)}>
                Exit
              </Button>
            </div>
          </div>

          <Card className="border-zc-border bg-zc-panel w-full max-w-full">
            <CardHeader className="pb-3 w-full max-w-full">
              <Tabs value={stepId} onValueChange={(v) => goTo(v as StaffOnboardingStepId)}>
                <TabsList className={cn("h-10 rounded-2xl border border-zc-border bg-zc-panel/20 p-1")}>
                  {visibleSteps.map((s) => {
                    const Icon = STEP_ICONS[s.id];
                    return (
                      <TabsTrigger
                        key={s.id}
                        value={s.id}
                        className={cn(
                          "rounded-xl px-3",
                          "data-[state=active]:bg-zc-accent data-[state=active]:text-white data-[state=active]:shadow-sm",
                        )}
                      >
                        {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
                        {s.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="w-full max-w-full">
              {!ready ? (
                <div className="py-8 text-sm text-zc-muted">Initializing draft…</div>
              ) : (
                <>
                  {children}
                  {footer ? <div className="mt-4 flex justify-end gap-2">{footer}</div> : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
