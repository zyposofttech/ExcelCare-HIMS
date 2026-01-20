import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AdminClient from "./AdminClient";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zc-muted">Loading…</div>}>
      <AdminClient />
    </Suspense>
  );
}
