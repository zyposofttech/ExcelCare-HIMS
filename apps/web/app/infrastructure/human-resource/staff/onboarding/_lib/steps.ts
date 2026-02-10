export type StaffOnboardingStepId =
  | "personal"
  | "identity"
  | "employment"
  | "credentials"
  | "privileges"
  | "assignments"
  | "background"
  | "health"
  | "financial"
  | "insurance"
  | "system-access"
  | "review"
  | "done";

export type StaffOnboardingStep = {
  id: StaffOnboardingStepId;
  label: string;
  href: string;
};

const BASE = "/infrastructure/human-resource/staff/onboarding";

export const STAFF_ONBOARDING_STEPS: StaffOnboardingStep[] = [
  { id: "personal", label: "Personal details", href: `${BASE}/personal` },
  { id: "identity", label: "Identity details", href: `${BASE}/identity` },
  { id: "employment", label: "Employment", href: `${BASE}/employment` },

  { id: "credentials", label: "Credentials", href: `${BASE}/credentials` },
  { id: "privileges", label: "Privileges", href: `${BASE}/privileges` },
  { id: "assignments", label: "Assignments", href: `${BASE}/assignments` },

  // { id: "background", label: "Background", href: `${BASE}/background` },
  { id: "health", label: "Health", href: `${BASE}/health` },
  { id: "system-access", label: "System Access", href: `${BASE}/system-access` },
  { id: "review", label: "Review", href: `${BASE}/review` },
  { id: "done", label: "Done", href: `${BASE}/done` },
];

export function getStepByKey(key: string): StaffOnboardingStep | undefined {
  return STAFF_ONBOARDING_STEPS.find((s) => s.id === (key as StaffOnboardingStepId));
}
