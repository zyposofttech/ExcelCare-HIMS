import { redirect } from "next/navigation";

function pickDraftId(searchParams: any): string | null {
  const v = searchParams?.draftId;
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  return null;
}

function newDraftId(): string {
  try {
    // Node runtime supports randomUUID
    // @ts-ignore
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {}
  return `draft_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function StartRedirectPage({ searchParams }: { searchParams?: Record<string, any> }) {
  const incoming = pickDraftId(searchParams);
  const draftId = incoming ?? newDraftId();

  redirect(
    `/infrastructure/human-resource/staff/onboarding/personal?draftId=${encodeURIComponent(draftId)}`
  );
}
