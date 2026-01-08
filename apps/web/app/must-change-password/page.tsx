"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Define the response type for safety
type ChangePasswordResponse = {
  ok: boolean;
  access_token?: string;
  user?: any;
};

export default function MustChangePasswordPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/superadmin";

  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    // If not logged in → back to login
    if (!user) {
      // Cast to 'any' to satisfy typed routes
      router.replace(`/login?next=${encodeURIComponent(next)}` as any);
    }
  }, [user, router, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!currentPassword.trim()) return setErr("Current password is required.");
    if (!newPassword.trim()) return setErr("New password is required.");
    if (newPassword !== confirm) return setErr("New password and confirmation do not match.");

    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Ensure you send the token if your backend requires it (usually via Cookie, but sometimes header)
        // If your backend relies on the cookie, this is fine. 
        // If it needs a header: Authorization: `Bearer ${token}`
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = (await res.json()) as ChangePasswordResponse;

      if (!res.ok) {
        const msg =
          (data as any)?.message ||
          (Array.isArray((data as any)?.errors) ? (data as any).errors.join(" ") : null) ||
          "Password change failed.";
        throw new Error(msg);
      }

      // Store new token (important: backend returns fresh token with mustChangePassword=false)
      if (data.access_token) {
        try {
          localStorage.setItem("access_token", data.access_token);
        } catch {}
      }

      // Update store user
      if (data.user) {
        login(data.user, data.access_token ?? null);
      } else {
        updateUser({ mustChangePassword: false });
      }

      // FIX: Cast 'next' to 'any' here to resolve the error
      router.replace(next as any);
      
    } catch (e: any) {
      if (String(e?.message || "").toLowerCase().includes("invalid token")) {
        logout();
        router.replace(`/login?next=${encodeURIComponent(next)}` as any);
        return;
      }
      setErr(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Change your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account requires a password change before you can continue.
        </p>

        {err && (
          <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-11"
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new">New password</Label>
            <Input
              id="new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-11"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Minimum 10 characters, 1 number, 1 special character, no spaces.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11"
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy ? "Updating..." : "Update password & continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}