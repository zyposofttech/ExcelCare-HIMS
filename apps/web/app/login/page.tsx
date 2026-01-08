"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore, type AuthUser } from "@/lib/auth/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";

const DEMO_SUPERADMIN: AuthUser = {
  id: "u_sa_001",
  name: "Jitendra Prakash",
  email: "superadmin@excelcare.demo",
  role: "SUPER_ADMIN",
  facilityId: "fac_blr_01",
  facilityName: "ExcelCare Hospital, Bengaluru, India",
};

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/superadmin";
  // Next.js 15 + Zustand: returning a new object from the selector can trigger
  // "getServerSnapshot should be cached" warnings / loops. Select fields separately.
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = React.useState(DEMO_SUPERADMIN.email);
  const [password, setPassword] = React.useState("demo");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    // If already logged in, send them onward.
    if (user) router.replace(next);
  }, [user, router, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (!email.trim()) {
        setErr("Email is required.");
        return;
      }
      if (!password.trim()) {
        setErr("Password is required (demo).");
        return;
      }
      // Demo-only: accept only the seeded super admin account.
      if (email.toLowerCase() !== DEMO_SUPERADMIN.email.toLowerCase()) {
        setErr("Demo login only: use superadmin@excelcare.demo");
        return;
      }
      login(DEMO_SUPERADMIN);
      router.replace(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-xc-bg">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="relative hidden lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(var(--xc-accent2)),transparent_40%),radial-gradient(circle_at_85%_30%,rgb(var(--xc-accent)),transparent_45%),linear-gradient(135deg,rgb(var(--xc-panel)),rgb(8_12_20))] opacity-90" />
          <div className="relative flex h-full flex-col justify-between p-10">
            <div>
              <div className="text-sm font-semibold text-xc-text">ExcelCare</div>
              <h1 className="mt-3 text-3xl font-semibold leading-tight text-xc-text">
                Enterprise Hospital Console
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-xc-muted">
                Secure, audit-ready operations UI for multi-facility workflows.
                Demo today. API-ready integration tomorrow.
              </p>
            </div>

            <div className="rounded-2xl border border-xc-border bg-xc-card/60 p-5 shadow-elev-2 backdrop-blur">
              <div className="text-sm font-semibold text-xc-text">Dark-first UI</div>
              <div className="mt-1 text-sm text-xc-muted">
                Toggle light mode anytime. UI tokens stay consistent.
              </div>
            </div>
          </div>
        </div>

        {/* Login panel */}
        <div className="flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-xc-muted">
                  ExcelCare Hospital, Bengaluru
                </div>
                <div className="mt-2 text-2xl font-semibold text-xc-text">Sign in</div>
                <div className="mt-1 text-sm text-xc-muted">
                  Demo access for Super Admin.
                </div>
              </div>
              <ThemeToggle />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>
                  Use the seeded credentials to continue.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="superadmin@excelcare.demo"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="demo"
                    />
                  </div>

                  {err ? (
                    <div className="rounded-xl border border-[rgb(var(--xc-danger))] bg-[rgb(var(--xc-danger)/0.08)] px-3 py-2 text-sm text-xc-text">
                      {err}
                    </div>
                  ) : null}

                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Signing in…" : "Sign in"}
                  </Button>

                  <div className="rounded-xl border border-xc-border bg-xc-panel p-3 text-xs text-xc-muted">
                    <div className="font-semibold text-xc-text">Seeded demo</div>
                    <div className="mt-1">
                      Email: <span className="text-xc-text">superadmin@excelcare.demo</span>
                      <br />
                      Password: <span className="text-xc-text">any</span>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
