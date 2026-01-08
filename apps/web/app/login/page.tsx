"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/cn";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Server,
  Shield,
} from "lucide-react";

// API Configuration (safe override for environments)
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/superadmin";

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);
  const [remember, setRemember] = React.useState(true);

  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (user) router.replace(next);
  }, [user, router, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      if (!email.trim()) throw new Error("Email is required.");
      if (!password.trim()) throw new Error("Password is required.");

      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      // Guard: some backends might not return JSON on errors
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;

      if (!res.ok) {
        throw new Error((data as any)?.message || "Login failed. Please verify your credentials.");
      }

      const accessToken = (data as any)?.access_token;
      const loggedInUser = (data as any)?.user;

      if (accessToken) {
        if (remember) localStorage.setItem("access_token", accessToken);
        else sessionStorage.setItem("access_token", accessToken);
      }

      if (loggedInUser) login(loggedInUser);

      // Optional: if backend supports “force password change” flags
      const mustChange =
        (data as any)?.mustChangePassword ??
        (data as any)?.must_change_password ??
        loggedInUser?.mustChangePassword ??
        loggedInUser?.must_change_password;

      if (mustChange) {
        router.replace(`/auth/must-change-password?next=${encodeURIComponent(next)}`);
        return;
      }

      router.replace(next);
    } catch (error: any) {
      setErr(error?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="grid min-h-screen w-full lg:grid-cols-2">
        {/* LEFT: Enterprise brand / trust panel */}
        <aside className="relative hidden overflow-hidden border-r bg-zinc-950 text-white lg:block">
          {/* Subtle gradients + grid */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-[20%] -top-[30%] h-[70%] w-[70%] rounded-full bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/15 blur-[120px]" />
            <div className="absolute -bottom-[25%] -right-[25%] h-[70%] w-[70%] rounded-full bg-gradient-to-tl from-teal-500/15 via-blue-500/15 to-purple-500/10 blur-[120px]" />
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.10]" />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/10 via-zinc-950/40 to-zinc-950/80" />
          </div>

          <div className="relative z-10 flex h-full flex-col p-10">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10 backdrop-blur">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-lg font-semibold tracking-tight">ExcelCare HIMS</div>
                  <div className="text-xs text-white/60">Enterprise Hospital OS</div>
                </div>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Secure Sign-in
              </span>
            </div>

            {/* Body */}
            <div className="mt-14 max-w-lg">
              <h2 className="text-3xl font-semibold leading-tight tracking-tight">
                Operational confidence for clinical teams.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                ExcelCare is designed for multi-facility control, audit-grade access governance, and predictable
                workflows—built for real hospital operations.
              </p>

              <div className="mt-8 grid gap-3">
                <Feature
                  icon={<Building2 className="h-5 w-5" />}
                  title="Multi-facility ready"
                  desc="Operate campuses with standardized roles, policies, and controls."
                />
                <Feature
                  icon={<Shield className="h-5 w-5" />}
                  title="Access governance"
                  desc="Role-based access, controlled sessions, and secure authentication pathways."
                />
                <Feature
                  icon={<BadgeCheck className="h-5 w-5" />}
                  title="Audit-ready by design"
                  desc="Change visibility, traceability, and governance-aligned workflows."
                />
                <Feature
                  icon={<Server className="h-5 w-5" />}
                  title="Production posture"
                  desc="Built to integrate with real backend services and enterprise deployment patterns."
                />
              </div>

              <div className="mt-10 flex flex-wrap gap-2">
                <Chip>RBAC</Chip>
                <Chip>Audit Trails</Chip>
                <Chip>Least Privilege</Chip>
                <Chip>Session Controls</Chip>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto flex items-center justify-between pt-10 text-xs text-white/45">
              <span>© 2026 ExcelCare Systems</span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Platform Status: Online
              </span>
            </div>
          </div>
        </aside>

        {/* RIGHT: Login */}
        <main className="relative flex items-center justify-center px-6 py-10 lg:px-16">
          {/* Top-right Theme toggle */}
          <div className="absolute right-6 top-6 lg:right-10 lg:top-10">
            <ThemeToggle />
          </div>

          <div className="w-full max-w-[440px]">
            {/* Mobile brand header */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold leading-none">ExcelCare HIMS</div>
                <div className="mt-1 text-xs text-muted-foreground">Enterprise Hospital OS</div>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-sm ring-1 ring-border/40 sm:p-8">
              <div className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Access your secure workspace and administrative controls.
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                      <Mail className="h-4.5 w-4.5" />
                    </div>
                    <Input
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="superadmin@excelcare.local"
                      className="h-11 pl-10"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <a
                      href="#"
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>

                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                      <Lock className="h-4.5 w-4.5" />
                    </div>

                    <Input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="h-11 pl-10 pr-11"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className={cn(
                        "absolute inset-y-0 right-0 flex items-center px-3",
                        "text-muted-foreground hover:text-foreground",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      )}
                      aria-label={showPwd ? "Hide password" : "Show password"}
                    >
                      {showPwd ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="h-4 w-4 rounded border-input bg-background align-middle"
                      />
                      Remember me on this device
                    </label>

                    <span className="text-xs text-muted-foreground">
                      Secure session enforced
                    </span>
                  </div>
                </div>

                {/* Error */}
                {err && (
                  <div className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-medium">Sign-in failed</div>
                      <div className="text-xs opacity-90">{err}</div>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>

                {/* Security note */}
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    Enterprise security notice
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Access is monitored and logged for compliance and operational security.
                    If you believe this is an error, contact your system administrator.
                  </p>
                </div>

                <div className="pt-2 text-center text-xs text-muted-foreground">
                  By continuing, you agree to the applicable policies.{" "}
                  <a href="#" className="underline underline-offset-4 hover:text-primary">
                    Terms
                  </a>{" "}
                  &bull;{" "}
                  <a href="#" className="underline underline-offset-4 hover:text-primary">
                    Privacy
                  </a>
                </div>
              </form>
            </div>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Need help signing in? Contact IT Support.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-white/90">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-white/60">{desc}</div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
      {children}
    </span>
  );
}
