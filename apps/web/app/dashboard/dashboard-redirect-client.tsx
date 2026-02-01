"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";

export default function DashboardRedirectClient() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (!user) {
      router.replace("/login?next=/dashboard");
      return;
    }

    const scope =
      (user as any).roleScope === "BRANCH"
        ? "BRANCH"
        : (user as any).roleScope === "GLOBAL"
          ? "GLOBAL"
          : (user as any).branchId
            ? "BRANCH"
            : "GLOBAL";

    router.replace(scope === "BRANCH" ? "/dashboard/branch" : "/dashboard/global");
  }, [user, router]);

  return null;
}
