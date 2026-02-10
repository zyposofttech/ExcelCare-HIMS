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

function newDraftId(): string {
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function deriveRoots(pathname: string | null) {
  // /infrastructure/.../staff/onboarding/<step>
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

  // ✅ If draftId missing (because you removed Start), create one and rewrite URL ONCE
  React.useEffect(() => {
    if (draftId) return;

    const id = newDraftId();
    setDraftId(id);

    // preserve current path + other params, just inject draftId
    const url = new URL(window.location.href);
    url.searchParams.set("draftId", id);
    router.replace(url.pathname + "?" + url.searchParams.toString() as any);

    toast({
      title: "Draft initialized",
      description: "Created a new onboarding draft.",
    });
  }, [draftId, router, toast]);

  const goTo = React.useCallback(
    (nextStepId: StaffOnboardingStepId) => {
      const step = STAFF_ONBOARDING_STEPS.find((s) => s.id === nextStepId);
      if (!step) return;

      // draftId should exist, but in case user clicks too fast:
      const id = draftId || newDraftId();
      if (!draftId) setDraftId(id);

      const href = `${step.href}?draftId=${encodeURIComponent(id)}`;
      router.push(href as any);
    },
    [draftId, router],
  );

  const handleSaveDraft = async () => {
    try {
      if (onSaveDraft) await onSaveDraft();
      toast({
        title: "Saved",
        description: onSaveDraft
          ? "Draft saved."
          : "Draft is stored locally in this browser (auto-saved as you type as well).",
      });
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message ?? "Could not save draft.",
        variant: "destructive",
      });
    }
  };

  const visibleSteps = STAFF_ONBOARDING_STEPS.filter((s) => s.id !== "done");

  // ✅ Prevent your child pages from running with empty draftId
  const ready = Boolean(draftId);

  return (
    <AppShell title="Staff Onboarding">
      <div className="w-full max-w-full overflow-x-hidden">
        <div className="grid gap-6 w-full max-w-full">
          {/* Header */}
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
              <Button variant="outline" className="px-5 gap-2" onClick={handleSaveDraft}>
                Save draft
              </Button>
              <Button variant="outline" className="px-5 gap-2" onClick={() => router.push(staffRoot as any)}>
                Exit
              </Button>
            </div>
          </div>

          {/* Wizard */}
          <Card className="border-zc-border bg-zc-panel w-full max-w-full">
            <CardHeader className="pb-3 w-full max-w-full">
              {/* ✅ wrap (no horizontal scrollbar) */}
              <Tabs value={stepId} onValueChange={(v) => goTo(v as StaffOnboardingStepId)}>
                <TabsList
                  className={cn("h-10 rounded-2xl border border-zc-border bg-zc-panel/20 p-1")}
                >
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
