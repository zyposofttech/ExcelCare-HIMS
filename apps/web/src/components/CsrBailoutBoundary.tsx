import { Suspense } from "react";

export function CsrBailoutBoundary({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        fallback ?? <div className="p-6 text-sm text-zc-muted">Loading…</div>
      }
    >
      {children}
    </Suspense>
  );
}
