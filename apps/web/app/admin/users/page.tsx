"use client";

import * as React from "react";
import { AppShell } from "@/components/AppShell";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/lib/auth/store";

import { IconPlus, IconSearch } from "@/components/icons";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Users2,
} from "lucide-react";

type Role = {
  roleCode: string;
  roleName: string;
  scope: "GLOBAL" | "BRANCH";
  version: number;
  permissions: string[];
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  roleCode: string;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
};

type BranchLite = {
  id: string;
  code: string;
  name: string;
  city?: string;
};

function tonePill(kind: "active" | "inactive" | "mcp") {
  if (kind === "active")
    return "border-emerald-200/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-200";
  if (kind === "inactive")
    return "border-zinc-200/70 bg-zinc-50/70 text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-900/25 dark:text-zinc-200";
  return "border-amber-200/70 bg-amber-50/70 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200";
}

function StatusPill({ label, kind }: { label: string; kind: "active" | "inactive" | "mcp" }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold", tonePill(kind))}>
      {label}
    </span>
  );
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

export default function UsersPage() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);

  const isSuperAdmin = user?.role === "SUPER_ADMIN" || (user as any)?.roleCode === "SUPER_ADMIN";

  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [branches, setBranches] = React.useState<BranchLite[]>([]);

  const [err, setErr] = React.useState<string | null>(null);

  // Create modal
  const [createOpen, setCreateOpen] = React.useState(false);
  const [busyCreate, setBusyCreate] = React.useState(false);
  const [form, setForm] = React.useState({
    email: "",
    name: "",
    roleCode: "BRANCH_ADMIN",
    branchId: "",
  });

  // Password dialog (used for create + reset)
  const [pwOpen, setPwOpen] = React.useState(false);
  const [pwCtx, setPwCtx] = React.useState<{ title: string; email: string; password: string } | null>(null);

  // Per-row action busy state
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);

  // Details/edit dialog
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsUser, setDetailsUser] = React.useState<UserRow | null>(null);
  const [detailsForm, setDetailsForm] = React.useState({
    name: "",
    email: "",
    roleCode: "",
    branchId: "",
  });
  const [busyDetails, setBusyDetails] = React.useState(false);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return (users ?? []).filter((u) => {
      const hay = `${u.name} ${u.email} ${u.roleCode} ${u.branchName ?? ""} ${u.branchId ?? ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [users, q]);

  const activeCount = React.useMemo(() => filtered.filter((u) => u.isActive).length, [filtered]);
  const inactiveCount = React.useMemo(() => filtered.filter((u) => !u.isActive).length, [filtered]);
  const mcpCount = React.useMemo(() => filtered.filter((u) => u.mustChangePassword).length, [filtered]);

  const selectedRole = React.useMemo(() => roles.find((r) => r.roleCode === form.roleCode) || null, [roles, form.roleCode]);
  const needsBranch = selectedRole?.scope === "BRANCH" || form.roleCode.toUpperCase().includes("BRANCH");

  const selectedDetailsRole = React.useMemo(
    () => roles.find((r) => r.roleCode === detailsForm.roleCode) || null,
    [roles, detailsForm.roleCode],
  );
  const detailsNeedsBranch = selectedDetailsRole?.scope === "BRANCH" || detailsForm.roleCode.toUpperCase().includes("BRANCH");

  async function refresh(showToast = false) {
    setErr(null);
    setLoading(true);
    try {
      const [r, u, b] = await Promise.all([
        apiFetch<Role[]>("/api/iam/roles"),
        apiFetch<UserRow[]>("/api/iam/users"),
        apiFetch<BranchLite[]>("/api/branches").catch(() => [] as BranchLite[]), // optional convenience
      ]);

      const rolesSorted = [...(r ?? [])].sort((a, b) => (a.roleCode || "").localeCompare(b.roleCode || ""));
      const usersSorted = [...(u ?? [])].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      const branchesSorted = [...(b ?? [])].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      setRoles(rolesSorted);
      setUsers(usersSorted);
      setBranches(branchesSorted);

      if (showToast) {
        toast({
          title: "Users refreshed",
          description: `Loaded ${usersSorted.length} users and ${rolesSorted.length} roles.`,
        });
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to load users";
      setErr(msg);
      toast({ variant: "destructive", title: "Refresh failed", description: msg });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openDetails(u: UserRow) {
    setErr(null);
    setDetailsUser(u);
    setDetailsForm({
      name: u.name ?? "",
      email: u.email ?? "",
      roleCode: u.roleCode ?? "",
      branchId: u.branchId ?? "",
    });
    setDetailsOpen(true);
  }

  async function onCreate() {
    setErr(null);

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const roleCode = form.roleCode.trim();
    const branchId = form.branchId.trim();

    if (!name) return setErr("Full name is required");
    if (!email || !isEmail(email)) return setErr("A valid email is required");
    if (!roleCode) return setErr("Role is required");
    if (needsBranch && !branchId) return setErr("Branch is required for BRANCH-scoped roles");

    setBusyCreate(true);
    try {
      const payload: any = { email, name, roleCode };
      if (branchId) payload.branchId = branchId;

      const res = await apiFetch<{ userId: string; email: string; tempPassword?: string }>("/api/iam/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast({
        title: "User created",
        description: `Created ${res.email}.`,
        variant: "success" as any,
      });

      setCreateOpen(false);
      setForm({ email: "", name: "", roleCode: "BRANCH_ADMIN", branchId: "" });

      if (res?.tempPassword) {
        setPwCtx({ title: "Temporary Password", email: res.email, password: res.tempPassword });
        setPwOpen(true);
      }

      await refresh(false);
    } catch (e: any) {
      const msg = e?.message || "Create failed";
      setErr(msg);
      toast({ variant: "destructive", title: "Create failed", description: msg });
    } finally {
      setBusyCreate(false);
    }
  }

  async function onUpdateUser() {
    if (!detailsUser) return;
    setErr(null);

    const name = detailsForm.name.trim();
    const email = detailsForm.email.trim().toLowerCase();
    const roleCode = detailsForm.roleCode.trim();
    const branchId = detailsForm.branchId.trim();

    if (!name) return setErr("Full name is required");
    if (!email || !isEmail(email)) return setErr("A valid email is required");
    if (!roleCode) return setErr("Role is required");
    if (detailsNeedsBranch && !branchId) return setErr("Branch is required for BRANCH-scoped roles");

    setBusyDetails(true);
    try {
      const payload: any = { name, email, roleCode };
      payload.branchId = branchId || null;

      await apiFetch(`/api/iam/users/${detailsUser.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast({
        title: "User updated",
        description: `Updated ${email}.`,
        variant: "success" as any,
      });

      setDetailsOpen(false);
      setDetailsUser(null);
      await refresh(false);
    } catch (e: any) {
      const msg = e?.message || "Update failed";
      setErr(msg);
      toast({ variant: "destructive", title: "Update failed", description: msg });
    } finally {
      setBusyDetails(false);
    }
  }

  async function toggleActive(u: UserRow) {
    setErr(null);
    setBusyUserId(u.id);
    try {
      await apiFetch(`/api/iam/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !u.isActive }),
      });

      toast({
        title: u.isActive ? "User deactivated" : "User activated",
        description: `${u.email} is now ${u.isActive ? "inactive" : "active"}.`,
        variant: "success" as any,
      });

      await refresh(false);
    } catch (e: any) {
      const msg = e?.message || "Update failed";
      setErr(msg);
      toast({ variant: "destructive", title: "Update failed", description: msg });
    } finally {
      setBusyUserId(null);
    }
  }

  async function resetPassword(u: UserRow) {
    setErr(null);
    setBusyUserId(u.id);
    try {
      const res = await apiFetch<{ ok: true; tempPassword?: string }>(`/api/iam/users/${u.id}/reset-password`, { method: "POST" });

      toast({
        title: "Password reset requested",
        description: res?.tempPassword ? `Temporary password generated for ${u.email}.` : `Reset completed for ${u.email}.`,
        variant: "success" as any,
      });

      if (res?.tempPassword) {
        setPwCtx({ title: "Temporary Password (Reset)", email: u.email, password: res.tempPassword });
        setPwOpen(true);
      }

      await refresh(false);
    } catch (e: any) {
      const msg = e?.message || "Reset failed";
      setErr(msg);
      toast({ variant: "destructive", title: "Reset failed", description: msg });
    } finally {
      setBusyUserId(null);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Copied to clipboard." });
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Clipboard permission blocked by browser." });
    }
  }

  return (
    <AppShell title="Users">
      <div className="grid gap-6">
        {/* Header (match Branch page) */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-zc-border bg-zc-panel/30">
              <Users2 className="h-5 w-5 text-zc-accent" />
            </span>
            <div className="min-w-0">
              <div className="text-3xl font-semibold tracking-tight">User Management</div>
              <div className="mt-1 text-sm text-zc-muted">Create users, assign roles, activate/deactivate, and reset passwords.</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="px-5 gap-2" onClick={() => void refresh(true)} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>

            {isSuperAdmin ? (
              <Button variant="primary" className="px-5 gap-2" onClick={() => setCreateOpen(true)}>
                <IconPlus className="h-4 w-4" />
                Create User
              </Button>
            ) : null}
          </div>
        </div>

        {/* Overview (match Branch page card) */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Overview</CardTitle>
            <CardDescription className="text-sm">
              Search and manage users. Branch-scoped roles should be created with a branch assigned.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Users (filtered)</div>
                <div className="mt-1 text-lg font-bold text-blue-700 dark:text-blue-300">{filtered.length}</div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Active</div>
                <div className="mt-1 text-lg font-bold text-emerald-800 dark:text-emerald-200">{activeCount}</div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
                <div className="text-xs font-medium text-amber-800 dark:text-amber-300">Must Change Password</div>
                <div className="mt-1 text-lg font-bold text-amber-900 dark:text-amber-200">{mcpCount}</div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <IconSearch className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zc-muted" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  placeholder="Search by name, email, role, branch…"
                  className="pl-10"
                />
              </div>

              <div className="text-xs text-zc-muted">
                Showing <span className="font-semibold tabular-nums text-zc-text">{filtered.length}</span> of{" "}
                <span className="font-semibold tabular-nums text-zc-text">{users.length}</span> users
              </div>
            </div>

            {err ? (
              <div className="flex items-start gap-2 rounded-xl border border-[rgb(var(--zc-danger-rgb)/0.35)] bg-[rgb(var(--zc-danger-rgb)/0.12)] px-3 py-2 text-sm text-[rgb(var(--zc-danger))]">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div className="min-w-0">{err}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Table (match Branch page card + header + separator) */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">User Registry</CardTitle>
            <CardDescription className="text-sm">Activate/deactivate accounts and reset passwords when required.</CardDescription>
          </CardHeader>
          <Separator />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zc-panel/20 text-xs text-zc-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                  <th className="px-4 py-3 text-left font-semibold">Branch</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>

              <tbody>
                {!filtered.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-zc-muted">
                      {loading ? "Loading users…" : "No users found."}
                    </td>
                  </tr>
                ) : null}

                {filtered.map((u) => {
                  const rowBusy = busyUserId === u.id;
                  return (
                    <tr key={u.id} className="border-t border-zc-border hover:bg-zc-panel/20">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zc-text">{u.name}</div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-zc-text">{u.email}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-lg border border-zc-border bg-zc-accent/20 px-2.5 py-1 font-mono text-xs text-zc-text">
                          {u.roleCode}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-zc-muted">
                        {u.branchName || (u.branchId ? <span className="font-mono text-xs">{u.branchId}</span> : "-")}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {u.isActive ? <StatusPill label="Active" kind="active" /> : <StatusPill label="Inactive" kind="inactive" />}
                          {u.mustChangePassword ? <StatusPill label="MCP" kind="mcp" /> : null}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" className="px-3 gap-2" onClick={() => openDetails(u)} title="View or edit user">
                            <Eye className="h-4 w-4" />
                            View
                          </Button>

                          <Button
                            variant={u.isActive ? "secondary" : "success"}
                            className="px-3 gap-2"
                            disabled={rowBusy}
                            onClick={() => void toggleActive(u)}
                            title={u.isActive ? "Deactivate user" : "Activate user"}
                          >
                            {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : u.isActive ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                            {u.isActive ? "Deactivate" : "Activate"}
                          </Button>

                          <Button
                            variant="outline"
                            className="px-3 gap-2"
                            disabled={rowBusy}
                            onClick={() => void resetPassword(u)}
                            title="Reset password"
                          >
                            {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                            Reset
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Callout (same as Branch page onboarding box) */}
        <div className="rounded-2xl border border-zc-border bg-zc-panel/20 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zc-text">Operational guidance</div>
              <div className="mt-1 text-sm text-zc-muted">
                For branch-scoped roles, always assign a branch. Use password reset when onboarding or when a user is locked out.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create User Dialog (styled like Branch Editor Dialog) */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          if (!v) {
            setErr(null);
            setBusyCreate(false);
            setCreateOpen(false);
          }
        }}
      >
        <DialogContent
          className="w-[95vw] sm:max-w-[620px] max-h-[85vh] overflow-y-auto border-indigo-200/50 dark:border-indigo-800/50 shadow-2xl shadow-indigo-500/10"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              Create User
            </DialogTitle>
            <DialogDescription>Create a user account and assign the correct role. A temporary password may be generated.</DialogDescription>
          </DialogHeader>

          <Separator className="my-4" />

          {err ? (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-[rgb(var(--zc-danger-rgb)/0.35)] bg-[rgb(var(--zc-danger-rgb)/0.12)] px-3 py-2 text-sm text-[rgb(var(--zc-danger))]">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div className="min-w-0">{err}</div>
            </div>
          ) : null}

          <div className="grid gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Full Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="e.g. Dr. Ananya Sharma"
                />
              </div>

              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  placeholder="e.g. ananya@hospital.com"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Role</Label>
              <select
                className={cn(
                  "w-full rounded-md border border-zc-border bg-zc-card px-3 py-2 text-sm text-zc-text",
                  "focus:outline-none focus:ring-2 focus:ring-zc-accent/50",
                )}
                value={form.roleCode}
                onChange={(e) => setForm((s) => ({ ...s, roleCode: e.target.value }))}
              >
                {roles.map((r) => (
                  <option key={r.roleCode} value={r.roleCode}>
                    {r.roleCode} (v{r.version}) · {r.scope}
                  </option>
                ))}
              </select>

              {selectedRole ? (
                <div className="flex items-center gap-2 text-[11px] text-zc-muted">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>
                    {selectedRole.roleName} · <span className="font-mono">{selectedRole.scope}</span> scope
                  </span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Branch</Label>
              <select
                className={cn(
                  "w-full rounded-md border border-zc-border bg-zc-card px-3 py-2 text-sm text-zc-text",
                  "focus:outline-none focus:ring-2 focus:ring-zc-accent/50",
                  needsBranch && !form.branchId ? "border-amber-300/70 dark:border-amber-700/60" : "",
                )}
                value={form.branchId}
                onChange={(e) => setForm((s) => ({ ...s, branchId: e.target.value }))}
              >
                <option value="">{needsBranch ? "Select branch (required)" : "Select branch (optional)"}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zc-muted">
                {needsBranch ? "Required for BRANCH-scoped roles." : "Optional for GLOBAL roles."}
              </p>
            </div>

            <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-zc-accent" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zc-text">Onboarding note</div>
                  <div className="mt-1 text-sm text-zc-muted">
                    If a temporary password is generated, copy it immediately and share securely. The user will be forced to change it on first login.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setErr(null);
                }}
                disabled={busyCreate}
              >
                Cancel
              </Button>

              <Button variant="primary" onClick={() => void onCreate()} disabled={busyCreate} className="gap-2">
                {busyCreate ? <Loader2 className="h-4 w-4 animate-spin" /> : <IconPlus className="h-4 w-4" />}
                Create User
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog
        open={detailsOpen}
        onOpenChange={(v) => {
          if (!v) {
            setDetailsOpen(false);
            setDetailsUser(null);
            setBusyDetails(false);
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900/40">
                <Users2 className="h-5 w-5 text-slate-700 dark:text-slate-200" />
              </div>
              User Details
            </DialogTitle>
            <DialogDescription>Review account details and update role assignments as needed.</DialogDescription>
          </DialogHeader>

          <Separator className="my-3" />

          {detailsUser ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zc-muted">
              {detailsUser.isActive ? <StatusPill label="Active" kind="active" /> : <StatusPill label="Inactive" kind="inactive" />}
              {detailsUser.mustChangePassword ? <StatusPill label="MCP" kind="mcp" /> : null}
            </div>
          ) : null}

          {err ? (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-[rgb(var(--zc-danger-rgb)/0.35)] bg-[rgb(var(--zc-danger-rgb)/0.12)] px-3 py-2 text-sm text-[rgb(var(--zc-danger))]">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div className="min-w-0">{err}</div>
            </div>
          ) : null}

          <div className="grid gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Full Name</Label>
                <Input
                  value={detailsForm.name}
                  onChange={(e) => setDetailsForm((s) => ({ ...s, name: e.target.value }))}
                  disabled={!isSuperAdmin}
                />
              </div>

              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  value={detailsForm.email}
                  onChange={(e) => setDetailsForm((s) => ({ ...s, email: e.target.value }))}
                  disabled={!isSuperAdmin}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Role</Label>
              <select
                className={cn(
                  "w-full rounded-md border border-zc-border bg-zc-card px-3 py-2 text-sm text-zc-text",
                  "focus:outline-none focus:ring-2 focus:ring-zc-accent/50",
                )}
                value={detailsForm.roleCode}
                onChange={(e) => setDetailsForm((s) => ({ ...s, roleCode: e.target.value }))}
                disabled={!isSuperAdmin}
              >
                {roles.map((r) => (
                  <option key={r.roleCode} value={r.roleCode}>
                    {r.roleCode} (v{r.version}) · {r.scope}
                  </option>
                ))}
              </select>

              {selectedDetailsRole ? (
                <div className="flex items-center gap-2 text-[11px] text-zc-muted">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>
                    {selectedDetailsRole.roleName} · <span className="font-mono">{selectedDetailsRole.scope}</span> scope
                  </span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Branch</Label>
              <select
                className={cn(
                  "w-full rounded-md border border-zc-border bg-zc-card px-3 py-2 text-sm text-zc-text",
                  "focus:outline-none focus:ring-2 focus:ring-zc-accent/50",
                  detailsNeedsBranch && !detailsForm.branchId ? "border-amber-300/70 dark:border-amber-700/60" : "",
                )}
                value={detailsForm.branchId}
                onChange={(e) => setDetailsForm((s) => ({ ...s, branchId: e.target.value }))}
                disabled={!isSuperAdmin}
              >
                <option value="">{detailsNeedsBranch ? "Select branch (required)" : "Select branch (optional)"}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zc-muted">
                {detailsNeedsBranch ? "Required for BRANCH-scoped roles." : "Optional for GLOBAL roles."}
              </p>
            </div>

            {!isSuperAdmin ? (
              <div className="rounded-xl border border-zc-border bg-zc-panel/20 p-3 text-xs text-zc-muted">
                Only super administrators can edit user details.
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDetailsOpen(false);
                  setDetailsUser(null);
                }}
                disabled={busyDetails}
              >
                {isSuperAdmin ? "Cancel" : "Close"}
              </Button>

              {isSuperAdmin ? (
                <Button variant="primary" onClick={() => void onUpdateUser()} disabled={busyDetails} className="gap-2">
                  {busyDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Save Changes
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Password Dialog */}
      <Dialog
        open={pwOpen}
        onOpenChange={(v) => {
          if (!v) {
            setPwOpen(false);
            setPwCtx(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <KeyRound className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              </div>
              {pwCtx?.title || "Temporary Password"}
            </DialogTitle>
            <DialogDescription>
              {pwCtx?.email ? (
                <>
                  For <span className="font-mono text-xs">{pwCtx.email}</span>. Copy and share securely.
                </>
              ) : (
                "Copy and share securely."
              )}
            </DialogDescription>
          </DialogHeader>

          <Separator className="my-3" />

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25">
            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-200">Temporary password</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0 truncate font-mono text-sm font-semibold text-zc-text">{pwCtx?.password || "-"}</div>
              <Button variant="outline" className="gap-2" onClick={() => pwCtx?.password && void copyToClipboard(pwCtx.password)}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
            <div className="mt-3 text-xs text-zc-muted">
              In production, your API may not return the password. If that happens, share reset instructions instead.
            </div>
          </div>

          <DialogFooter>
            <Button variant="primary" onClick={() => setPwOpen(false)} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
