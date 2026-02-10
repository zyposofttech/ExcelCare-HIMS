import { redirect } from "next/navigation";

export default function OnboardingIndexPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const draftId =
    typeof searchParams?.draftId === "string"
      ? searchParams.draftId
      : Array.isArray(searchParams?.draftId)
      ? searchParams?.draftId?.[0]
      : null;

  redirect(
    draftId
      ? `/infrastructure/human-resource/staff/onboarding/personal?draftId=${encodeURIComponent(draftId)}`
      : "/infrastructure/human-resource/staff/onboarding/personal"
  );
}
