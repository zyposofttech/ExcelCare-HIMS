"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

// Move your existing /admin page logic here.
export default function AdminClient() {
  const sp = useSearchParams();
  const tab = sp.get("tab") ?? "overview";

  return (
    <div className="p-6">
      {/* your existing /admin UI */}
      <div className="text-sm text-zc-muted">Tab: {tab}</div>
    </div>
  );
}
