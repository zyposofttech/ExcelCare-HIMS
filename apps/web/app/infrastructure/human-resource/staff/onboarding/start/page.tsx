"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

/**
 * FIXED:
 * - Old code generated random UUID draftId (not a real Prisma staffId) → backend 404.
 * - Now we create a REAL draft staff record on server and redirect with its staffId.
 */
export default function StartPage() {
  const router = useRouter();
  const sp = useSearchParams();

  React.useEffect(() => {
    const existing = sp.get("draftId");

    async function boot() {
      try {
        // If draftId exists and server recognizes it, continue.
        if (existing) {
          try {
            await apiFetch(`/api/infrastructure/staff/${encodeURIComponent(existing)}`);
            router.replace(
              `/infrastructure/human-resource/staff/onboarding/personal?draftId=${encodeURIComponent(existing)}` as any,
            );
            return;
          } catch {
            // fallthrough -> create a new server draft and migrate later
          }
        }

        // Create a real server draft
        const created = await apiFetch<{ staffId: string }>(`/api/infrastructure/staff/drafts`, {
          method: "POST",
          body: {},
        });

        if (!created?.staffId) throw new Error("Draft creation failed (no staffId returned)");

        router.replace(
          `/infrastructure/human-resource/staff/onboarding/personal?draftId=${encodeURIComponent(created.staffId)}` as any,
        );
      } catch {
        router.replace(`/infrastructure/human-resource/staff` as any);
      }
    }

    boot();
  }, [router, sp]);

  return <div className="p-6 text-sm text-zc-muted">Initializing onboarding draft…</div>;
}
