import { Suspense } from "react";
import StatutoryClient from "./StatutoryClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zc-muted">Loading…</div>}>
      <StatutoryClient />
    </Suspense>
  );
}
