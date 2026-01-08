import { IconCog, IconDashboard, IconPlus } from "@/components/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoon({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-xc-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-xc-warn/10 blur-3xl" />
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              This screen is scaffolded as part of the enterprise UI foundation.
            </CardDescription>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="inline-flex items-center gap-2 rounded-full border border-xc-border bg-xc-panel/30 px-3 py-1 text-xs font-semibold text-xc-text">
              <IconDashboard className="h-3.5 w-3.5 text-xc-accent" />
              Demo-ready
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-xc-border bg-xc-panel/30 px-3 py-1 text-xs font-semibold text-xc-text">
              <IconCog className="h-3.5 w-3.5 text-xc-muted" />
              Backend-ready
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-xc-muted">
          {hint ??
            "We will build this module next using the same tokens, primitives, and shell patterns (list, detail, create/edit) — wired so you can later connect real APIs without redesigning screens."}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-xc-border bg-xc-panel/25 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-xc-text">
              <span className="grid h-9 w-9 place-items-center rounded-2xl border border-xc-border bg-xc-panel/40">
                <IconPlus className="h-4 w-4 text-xc-accent" />
              </span>
              Module build plan
            </div>
            <div className="mt-2 text-xs text-xc-muted">
              CRUD pages (list, detail, create/edit), seeded demo data, and consistent validation patterns.
            </div>
          </div>
          <div className="rounded-2xl border border-xc-border bg-xc-panel/25 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-xc-text">
              <span className="grid h-9 w-9 place-items-center rounded-2xl border border-xc-border bg-xc-panel/40">
                <IconDashboard className="h-4 w-4 text-xc-warn" />
              </span>
              Demo polish
            </div>
            <div className="mt-2 text-xs text-xc-muted">
              Realistic seeded records, empty states, and quick actions so the demo feels production-grade.
            </div>
          </div>
          <div className="rounded-2xl border border-xc-border bg-xc-panel/25 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-xc-text">
              <span className="grid h-9 w-9 place-items-center rounded-2xl border border-xc-border bg-xc-panel/40">
                <IconCog className="h-4 w-4 text-xc-accent2" />
              </span>
              API handoff
            </div>
            <div className="mt-2 text-xs text-xc-muted">
              Store/actions are kept separate so you can swap seeded data with API calls cleanly.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
