"use client";

import * as React from "react";
import { syncPrincipalToAuthStore } from "@/lib/api";

/**
 * Bootstraps auth context after hydration:
 * - If access_token exists, fetch /api/iam/me
 * - Normalize principal into Zustand auth store
 * - If token invalid, logout/clear token (handled inside api.ts helper)
 */
export function AuthBootstrapper() {
  React.useEffect(() => {
    // Fire-and-forget; errors are handled inside helper
    void syncPrincipalToAuthStore();
  }, []);

  return null;
}
