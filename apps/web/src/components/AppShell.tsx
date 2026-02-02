"use client";

import * as React from "react";
import { LinkWithLoader as Link } from "@/components/LinkWithLoader";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/lib/auth/store";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BranchSelector } from "@/components/BranchSelector";
import { initActiveBranchSync } from "@/lib/branch/active-branch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"; // Added Dialog imports
import { ToastHost } from "@/components/ToastHost";
import {
  IconBed,
  IconBrain,
  IconBuilding,
  IconZypoCare,
  IconChart,
  IconChevronDown,
  IconChevronRight,
  IconClipboard,
  IconDashboard,
  IconFlask,
  IconKeyboard,
  IconLogout,
  IconPlus,
  IconPanelLeft,
  IconPanelRight,
  IconPill,
  IconReceipt,
  IconSearch,
  IconShield,
  IconStethoscope,
  IconUsers,
  type IconProps,
} from "@/components/icons";

// --- Types & Data ---

type NavBadgeDef = { label: string; tone?: "neutral" | "info" | "new" | "soon" };

type NavChildLink = {
  type?: "link";
  label: string;
  href: string;
  badge?: NavBadgeDef;
};

type NavChildGroup = {
  type: "group";
  label: string;
  children: NavChildLink[];
};

type NavChild = NavChildLink | NavChildGroup;

type NavNode = {
  label: string;
  href: string;
  icon: React.ComponentType<IconProps>;
  badge?: NavBadgeDef;
  children?: NavChild[];
};

type NavGroup = {
  title: string;
  items: NavNode[];
};

function resolveRoleScope(user: any): "GLOBAL" | "BRANCH" | null {
  if (!user) return null;
  const scope = user.roleScope as ("GLOBAL" | "BRANCH" | null | undefined);
  if (scope === "GLOBAL" || scope === "BRANCH") return scope;

  const roleCode = normRole(user.roleCode ?? user.role);
  if (roleCode === "SUPER_ADMIN" || roleCode === "CORPORATE_ADMIN" || roleCode === "GLOBAL_ADMIN") return "GLOBAL";
  if (roleCode === "BRANCH_ADMIN") return "BRANCH";
  if (user.branchId) return "BRANCH";
  return null;
}

function roleLabel(user: any) {
  return String(user?.roleCode ?? user?.role ?? "").replaceAll("_", " ") || "UNKNOWN";
}

function buildAllNavItems(groups: NavGroup[]) {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => {
      const results: {
        label: string;
        href: string;
        icon: React.ComponentType<IconProps>;
        group: string;
        type: "Parent" | "Child";
        parent?: string;
      }[] = [
          {
            label: item.label,
            href: item.href,
            icon: item.icon,
            group: group.title,
            type: "Parent",
          },
        ];

      const childLinks = flattenChildLinks(item.children);
      if (childLinks.length) {
        results.push(
          ...childLinks.map(({ link, groupLabel }) => ({
            label: link.label,
            href: link.href,
            icon: item.icon,
            group: group.title,
            type: "Child" as const,
            parent: groupLabel ? `${item.label} - ${groupLabel}` : item.label,
          }))
        );
      }
      return results;
    })
  );
}

const NAV_WORKSPACES: NavNode[] = [
  {
    label: "Welcome",
    href: "/welcome",
    icon: IconZypoCare,
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: IconDashboard,
  },
  {
    label: "Central Console",
    href: "/dashboard/global",
    icon: IconDashboard,
    children: [
      // { label: "Overview", href: "/dashboard/global" },
      { label: "Branches", href: "/branches" },
      { label: "Users", href: "/users" },
      { label: "Policy Governance", href: "/policy" },
      { label: "Policy Presets", href: "/policy/presets" },
      { label: "Policies", href: "/policy/policies" },
      { label: "Approvals", href: "/policy/approvals" },
      { label: "Audit Trail", href: "/policy/audit" },
      { label: "Access Control", href: "/access" },
    ],
  },
  {
    label: "Infrastructure Setup",
    href: "/infrastructure",
    icon: IconBuilding,
    children: [
      { label: "Overview", href: "/infrastructure" },
      {
        type: "group",
        label: "Org & Clinical Structure",
        children: [
          { label: "Facilities", href: "/infrastructure/facilities" },
          { label: "Departments", href: "/infrastructure/departments" },
          { label: "Specialties", href: "/infrastructure/specialties" },
        ],
      },
      {
        type: "group",
        label: "Infra Core",
        children: [
          { label: "Locations (Building)", href: "/infrastructure/locations" },
          { label: "Unit Types", href: "/infrastructure/unit-types" },
          { label: "Units", href: "/infrastructure/units" },
          { label: "Rooms / Bays", href: "/infrastructure/rooms" },
          { label: "Resources", href: "/infrastructure/resources" },
          { label: "Housekeeping Gate", href: "/infrastructure/bed-policy" },
        ],
      },
      {
        type: "group",
        label: "Clinical Facilities",
        children: [
          { label: "OT Setup", href: "/infrastructure/ot" },
          { label: "Diagnostics Configuration", href: "/infrastructure/diagnostics" },
          { label: "Equipment Register", href: "/infrastructure/equipment" },
        ],
      },
      {
        type: "group",
        label: "Billing Setup",
        children: [
          { label: "Tax Codes (GST)", href: "/infrastructure/tax-codes" },
          { label: "Charge Master", href: "/infrastructure/charge-master" },
          { label: "Tariff Plans & Rates", href: "/infrastructure/tariff-plans" },
        ],
      },
      {
        type: "group",
        label: "Service Catalogue",
        children: [
          { label: "Service Items", href: "/infrastructure/service-items" },
          { label: "Service Library", href: "/infrastructure/service-library" },
          { label: "Service <-> Charge Mapping", href: "/infrastructure/service-mapping" },
          { label: "Service Catalogue", href: "/infrastructure/service-catalogues" },
          { label: "Service Packages", href: "/infrastructure/service-packages" },
          { label: "Order Sets", href: "/infrastructure/order-sets" },
          { label: "Service Availability", href: "/infrastructure/service-availability" },
        ],
      },
      {
        type: "group",
        label: "Readiness & Ops",
        children: [
          { label: "Fix-It Queue", href: "/infrastructure/fixit" },
          { label: "Go-Live Validator", href: "/infrastructure/golive" },
          { label: "Bulk Import (CSV/XLS)", href: "/infrastructure/import" },
        ],
      },
    ],
  },

];

const NAV_CARE: NavNode[] = [
  {
    label: "Front Office & QMS",
    href: "/frontoffice",
    icon: IconClipboard,
    children: [
      { label: "Registration (UHID/MPI)", href: "/frontoffice/registration" },
      { label: "Token & Queue Dashboard", href: "/frontoffice/qms" },
      { label: "ABHA Scan & Share", href: "/frontoffice/abha" },
      { label: "Transfers & Audit", href: "/frontoffice/transfers" },
    ],
  },
  {
    label: "Clinical Care",
    href: "/clinical",
    icon: IconStethoscope,
    children: [
      { label: "Clinical Worklist", href: "/clinical/worklist" },
      { label: "OPD Visits", href: "/clinical/opd" },
      { label: "EMR Notes", href: "/clinical/emr-notes" },
      { label: "Orders", href: "/clinical/orders" },
      { label: "Prescriptions", href: "/clinical/prescriptions" },
      { label: "Admissions (IPD)", href: "/clinical/ipd" },
      { label: "OT", href: "/clinical/ot" },
      { label: "ER", href: "/clinical/er" },
    ],
  },
  {
    label: "Nursing & Ward",
    href: "/nursing",
    icon: IconBed,
    children: [
      { label: "Ward Dashboard", href: "/nursing/ward-dashboard" },
      { label: "Bed Board", href: "/nursing/bed-board" },
      { label: "Vitals", href: "/nursing/vitals" },
      { label: "Nursing Notes", href: "/nursing/notes" },
    ],
  },
  {
    label: "Diagnostics (Lab/Imaging)",
    href: "/diagnostics",
    icon: IconFlask,
    children: [
      { label: "Lab Orders", href: "/diagnostics/lab-orders" },
      { label: "Sample Collection", href: "/diagnostics/sample-collection" },
      { label: "Results Validation", href: "/diagnostics/results" },
      { label: "Imaging", href: "/diagnostics/imaging" },
    ],
  },
  {
    label: "Pharmacy & Inventory",
    href: "/pharmacy",
    icon: IconPill,
    children: [
      { label: "Dispensing", href: "/pharmacy/dispensing" },
      { label: "Stock", href: "/pharmacy/stock" },
      { label: "Purchases", href: "/pharmacy/purchases" },
    ],
  },
  {
    label: "Billing, Finance & TPA",
    href: "/billing",
    icon: IconReceipt,
    children: [
      { label: "Tariffs", href: "/billing/tariffs" },
      { label: "Packages", href: "/billing/packages" },
      { label: "Billing Desk", href: "/billing/billing-desk" },
      { label: "Cashier", href: "/billing/cashier" },
      { label: "TPA Claims", href: "/billing/tpa" },
    ],
  },
];

const NAV_GOVERN: NavNode[] = [
  {
    label: "Facilities & Ops",
    href: "/ops",
    icon: IconBuilding,
    children: [
      { label: "Assets & Biomedical", href: "/ops/assets" },
      { label: "Housekeeping", href: "/ops/housekeeping" },
      { label: "IT Requests", href: "/ops/it" },
      { label: "Maintenance", href: "/ops/maintenance" },
    ],
  },
  {
    label: "Compliance & Governance",
    href: "/compliance",
    icon: IconShield,
    children: [
      { label: "Consent Manager", href: "/compliance/consent" },
      { label: "Rights (RTBF)", href: "/compliance/rights" },
      { label: "Audit Ledger", href: "/compliance/audit-ledger" },
      { label: "Records Governance", href: "/compliance/records" },
      { label: "Break Glass", href: "/compliance/break-glass" },
    ],
  },
  {
    label: "Statutory Reporting",
    href: "/statutory",
    icon: IconChart,
    children: [
      { label: "Nikshay", href: "/statutory/nikshay" },
      { label: "IDSP / IHIP", href: "/statutory/idsp-ihip" },
    ],
  },
  {
    label: "AI Copilot",
    href: "/ai",
    icon: IconBrain,
    children: [
      { label: "Copilot", href: "/ai/copilot" },
      { label: "AI Audit", href: "/ai/audit" },
      { label: "AI Governance", href: "/ai/governance" },
      { label: "Model Registry", href: "/ai/models" },
    ],
  },
  {
    label: "Users & Access",
    href: "/access",
    icon: IconUsers,
    children: [
      { label: "Permissions", href: "/access/permissions" },
      { label: "Roles", href: "/access/roles" },
      { label: "App Users", href: "/users" },
      { label: "Audit Trails", href: "/access/audit" },
    ],
  },
];

const NAV_GROUPS: NavGroup[] = [
  { title: "Workspaces", items: NAV_WORKSPACES },
  { title: "Care Delivery", items: NAV_CARE },
  { title: "Governance & Ops", items: NAV_GOVERN },
];
// ----------------------
/* Permission-based Nav Visibility (enterprise RBAC)
   - UI uses permissions (principal.permissions[]) coming from /api/iam/me
   - No role hardcoding for authorization decisions
   - Scope (GLOBAL/BRANCH) still controls which workspace routes exist
*/

function normRole(role?: string | null) {
  const r = String(role ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    ADMIN: "BRANCH_ADMIN",
    BRANCHADMIN: "BRANCH_ADMIN",
    BRANCH_ADMIN: "BRANCH_ADMIN",
    GLOBAL: "GLOBAL_ADMIN",
    GLOBALADMIN: "GLOBAL_ADMIN",
    GLOBAL_ADMIN: "GLOBAL_ADMIN",
    CORP_ADMIN: "CORPORATE_ADMIN",
    CORPORATE: "CORPORATE_ADMIN",
    SUPER: "SUPER_ADMIN",
  };

  return map[r] ?? r;
}

function inferScopeFromUser(user: any): "GLOBAL" | "BRANCH" {
  const s = resolveRoleScope(user);
  return s === "BRANCH" ? "BRANCH" : "GLOBAL";
}

function getUserPerms(user: any): string[] | null {
  const perms = user?.permissions;
  if (!Array.isArray(perms)) return null;
  return perms.filter((p: any) => typeof p === "string" && p.length > 0);
}

function hasAnyPrefix(perms: string[], prefixes: string[]) {
  if (!prefixes.length) return true;
  return perms.some((p) => prefixes.some((pre) => p.startsWith(pre)));
}

type NavCtx = {
  scope: "GLOBAL" | "BRANCH";
  perms: string[] | null; // null => not loaded/unknown
};

/**
 * Central policy for which routes appear in the sidebar / command center.
 * IMPORTANT: This does not replace backend authorization.
 *
 * Strategy:
 * - Scope gates are always applied (GLOBAL/BRANCH workspace split).
 * - If permissions are not yet loaded, we allow links by scope (prevents blank nav on first paint).
 * - Once permissions are loaded, admin surfaces become permission-driven.
 */
function allowHrefByPerm(href: string, ctx: NavCtx) {
  const { scope, perms } = ctx;

  // Scope gates (GLOBAL-only areas)
  if (
    href.startsWith("/access") ||
    href.startsWith("/policy") ||
    href.startsWith("/branches") ||
    href.startsWith("/dashboard/global")
  ) {
    if (scope !== "GLOBAL") return false;
  }

  // Legacy branch workspace (kept for backward compatibility)
  if (href.startsWith("/admin")) {
    if (scope !== "BRANCH") return false;
  }

  // If permissions are not loaded yet, do not over-restrict UI (scope gates already applied).
  if (!perms) return true;

  // Strong gates for sensitive / admin areas
  if (href.startsWith("/access")) {
    return hasAnyPrefix(perms, ["IAM_", "ACCESS_"]);
  }

  if (href.startsWith("/policy")) {
    return hasAnyPrefix(perms, ["POLICY_", "GOV_", "AUDIT_"]) || hasAnyPrefix(perms, ["IAM_"]);
  }

  if (href.startsWith("/branches")) {
    return hasAnyPrefix(perms, ["ORG_", "BRANCH_", "IAM_"]);
  }

  if (href.startsWith("/users")) {
    return hasAnyPrefix(perms, ["IAM_USER_", "IAM_", "ORG_"]);
  }

  if (href.startsWith("/dashboard/global")) {
    return hasAnyPrefix(perms, ["ORG_", "BRANCH_", "IAM_", "REPORT_", "ANALYTICS_", "DASHBOARD_"]);
  }

  if (href.startsWith("/infrastructure")) {
    return hasAnyPrefix(perms, [
      "INFRA_",
      "SERVICE_",
      "CATALOG_",
      "ORDERSET_",
      "TARIFF_",
      "CHARGE_",
      "TAX_",
      "BILLING_SETUP_",
      "BILLING_",
    ]);
  }

  return true;
}

function rewriteHref(label: string, href: string, _ctx: { scope: "GLOBAL" | "BRANCH" }) {
  // Fix “App Users” link so GLOBAL users land on the corporate user screen
  if (label === "App Users") return "/users";
  return href;
}

function filterNavGroupsForUser(groups: NavGroup[], user: any): NavGroup[] {
  const scope = inferScopeFromUser(user);
  const perms = getUserPerms(user);
  const ctx: NavCtx = { scope, perms };

  // Keep your existing UX:
  // - Admin personas see Workspaces first and hide Care Delivery.
  // - Clinical personas hide Workspaces to keep the menu clean.
  const persona: "ADMIN" | "CLINICAL" | "UNKNOWN" = !perms
    ? "UNKNOWN"
    : hasAnyPrefix(perms, ["IAM_", "INFRA_", "POLICY_", "ORG_", "BRANCH_", "ACCESS_"])
      ? "ADMIN"
      : "CLINICAL";

  const allowedGroupTitle = (title: string) => {
    // During first paint (before /api/iam/me has hydrated permissions), avoid hiding groups.
    if (persona === "UNKNOWN") return true;

    if (persona === "ADMIN") {
      if (title === "Workspaces") return true;
      if (title === "Governance & Ops") return true;
      return false; // hide Care Delivery for admin personas
    }

    // Clinical personas: hide admin workspace group
    if (title === "Workspaces") return false;
    return true;
  };

  const out: NavGroup[] = [];

  for (const g of groups) {
    if (!allowedGroupTitle(g.title)) continue;

    const items: NavNode[] = [];

    for (const n of g.items) {
      const nodeHrefAllowed = allowHrefByPerm(n.href, ctx);

      // Filter children
      let nextChildren: NavChild[] | undefined = undefined;

      if (n.children?.length) {
        const kept: NavChild[] = [];

        for (const child of n.children) {
          if (isChildGroup(child)) {
            const groupChildren = child.children
              .map((c) => ({ ...c, href: rewriteHref(c.label, c.href, { scope }) }))
              .filter((c) => allowHrefByPerm(c.href, ctx));

            if (groupChildren.length) kept.push({ ...child, children: groupChildren });
          } else {
            const updated = { ...child, href: rewriteHref(child.label, child.href, { scope }) };
            if (allowHrefByPerm(updated.href, ctx)) kept.push(updated);
          }
        }

        if (kept.length) nextChildren = kept;
      }

      // Keep the node if:
      // - it’s allowed directly, OR
      // - it has at least one allowed child
      if (!nodeHrefAllowed && (!nextChildren || nextChildren.length === 0)) continue;

      items.push({ ...n, children: nextChildren });
    }

    if (items.length) out.push({ ...g, items });
  }

  return out;
}

// --- Command Center Types ---
type CommandItem = {
  id: string;
  label: string;
  group: string;
  icon: React.ComponentType<IconProps>;
  subtitle?: string;
  keywords?: string[];
  href?: string;
  onSelect?: () => void;
};

const COMMAND_ACTIONS: CommandItem[] = [
  {
    id: "action:create-branch",
    label: "Create Branch",
    group: "Actions",
    icon: IconPlus,
    subtitle: "Open branch create form",
    keywords: ["branch", "create", "new"],
    href: "/branches?create=1",
  },
  {
    id: "action:open-branches",
    label: "Open Branches",
    group: "Actions",
    icon: IconBuilding,
    subtitle: "Branch registry and setup",
    keywords: ["branches", "registry"],
    href: "/branches",
  },
  {
    id: "action:open-diagnostics",
    label: "Diagnostics Configuration",
    group: "Actions",
    icon: IconFlask,
    subtitle: "Packs, catalog, templates",
    keywords: ["diagnostics", "lab", "imaging"],
    href: "/infrastructure/diagnostics",
  },
  {
    id: "action:open-policy-presets",
    label: "Policy Presets",
    group: "Actions",
    icon: IconShield,
    subtitle: "Install governance packs",
    keywords: ["policy", "presets", "governance"],
    href: "/policy/presets",
  },
];

// --- Command Center Helpers ---

function isChildGroup(child: NavChild): child is NavChildGroup {
  return (child as NavChildGroup).type === "group";
}

function flattenChildLinks(children?: NavChild[]) {
  const links: Array<{ link: NavChildLink; groupLabel?: string }> = [];
  if (!children?.length) return links;
  for (const child of children) {
    if (isChildGroup(child)) {
      child.children.forEach((link) => links.push({ link, groupLabel: child.label }));
    } else {
      links.push({ link: child });
    }
  }
  return links;
}

// --- Helpers ---

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavNodeActive(pathname: string, node: NavNode) {
  if (!node.children?.length) return isActivePath(pathname, node.href);
  if (pathname === node.href) return true;
  return flattenChildLinks(node.children).some(({ link }) => isActivePath(pathname, link.href));
}

function readBool(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "1";
  } catch {
    return fallback;
  }
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function writeBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // ignore
  }
}

function NavBadge({ badge }: { badge?: NavBadgeDef }) {
  if (!badge) return null;
  const tone = badge.tone ?? "neutral";
  const cls =
    tone === "new"
      ? "border-zc-accent/40 bg-zc-accent/15 text-zc-accent"
      : tone === "soon"
        ? "border-zc-border/80 bg-[rgb(var(--zc-hover-rgb)/0.04)] text-zc-muted"
        : "border-zc-border/80 bg-[rgb(var(--zc-hover-rgb)/0.04)] text-zc-muted";

  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        cls
      )}
    >
      {badge.label}
    </span>
  );
}

// --- Component ---

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const handleLogout = React.useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore network failures; still logout locally
    } finally {
      logout();
      router.replace("/login");
    }
  }, [logout, router]);

  const scope = resolveRoleScope(user);
  const isGlobalScope = scope === "GLOBAL";

  React.useEffect(() => {
    initActiveBranchSync();
  }, []);

  // Role-based navigation filtering (single menu with role-aware visibility)
  const navGroupsForUser = React.useMemo<NavGroup[]>(() => {
    return filterNavGroupsForUser(NAV_GROUPS, user);
  }, [user]);

  // Guard: keep users inside their workspace (defense-in-depth; proxy/middleware should also enforce this)
  React.useEffect(() => {
    if (!scope || !pathname) return;

    const perms = getUserPerms(user);
    const navCtx: NavCtx = { scope: inferScopeFromUser(user), perms };

    // BRANCH users: never allow GLOBAL-only workspaces
    if (
      scope === "BRANCH" &&
      (pathname.startsWith("/access") ||
        pathname.startsWith("/policy") ||
        pathname.startsWith("/branches") ||
        pathname.startsWith("/dashboard/global") ||
        pathname.startsWith("/superadmin"))
    ) {
      router.replace("/welcome");
      return;
    }

    // GLOBAL users: avoid /admin workspace
    if (scope === "GLOBAL" && pathname.startsWith("/admin")) {
      router.replace("/welcome");
      return;
    }

    // If permissions are known and the current route is not allowed, bounce to welcome.
    // (Backend remains the true authority.)
    if (!allowHrefByPerm(pathname, navCtx)) {
      router.replace("/welcome");
    }
  }, [scope, pathname, router, user]);


  // Initialize state
  const [collapsed, setCollapsed] = React.useState(false);
  const [openMap, setOpenMap] = React.useState<Record<string, boolean>>({});
  const [groupOpenMap, setGroupOpenMap] = React.useState<Record<string, boolean>>({});
  const [navQuery, setNavQuery] = React.useState("");

  // Command Center State
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [commandQuery, setCommandQuery] = React.useState("");
  const [commandIndex, setCommandIndex] = React.useState(0);
  const [recentCommandIds, setRecentCommandIds] = React.useState<string[]>([]);

  // Hydrate state from local storage on mount
  React.useEffect(() => {
    setCollapsed(readBool("zc.sidebarCollapsed", false));
    setOpenMap(readJSON<Record<string, boolean>>("zc.sidebarOpenMap", {}));
    setGroupOpenMap(
      readJSON<Record<string, boolean>>("zc.sidebarGroupOpenMap", {
        Workspaces: true,
        "Care Delivery": true,
        "Governance & Ops": true,
      })
    );
  }, []);

  // Keyboard Shortcut Effect (Ctrl+K / Cmd+K)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (commandOpen) {
      setCommandQuery("");
      setCommandIndex(0);
      setRecentCommandIds(readJSON<string[]>("zc.command.recent", []));
    }
  }, [commandOpen]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      writeBool("zc.sidebarCollapsed", next);
      return next;
    });
  }

  function toggleOpen(key: string) {
    setOpenMap((m) => {
      const next = { ...m, [key]: !(m[key] ?? true) };
      writeJSON("zc.sidebarOpenMap", next);
      return next;
    });
  }

  function toggleGroup(key: string) {
    setGroupOpenMap((m) => {
      const next = { ...m, [key]: !(m[key] ?? true) };
      writeJSON("zc.sidebarGroupOpenMap", next);
      return next;
    });
  }

  const roleCommandActions = React.useMemo<CommandItem[]>(() => {
    const scope = inferScopeFromUser(user);
    const perms = getUserPerms(user);
    const ctx: NavCtx = { scope, perms };

    return COMMAND_ACTIONS
      .map((a) => ({
        ...a,
        href: a.href ? rewriteHref(a.label, a.href, { scope }) : a.href,
      }))
      .filter((a) => !a.href || allowHrefByPerm(a.href, ctx));
  }, [user]);


  const allNavItems = React.useMemo(() => buildAllNavItems(navGroupsForUser), [navGroupsForUser]);

  // Command Center helpers
  const commandNavItems = React.useMemo<CommandItem[]>(() => {
    const scope = inferScopeFromUser(user);
    const perms = getUserPerms(user);
    const ctx: NavCtx = { scope, perms };

    return allNavItems
      .map((item) => ({ ...item, href: rewriteHref(item.label, item.href, { scope }) }))
      .filter((item) => allowHrefByPerm(item.href, ctx))
      .map((item) => ({
        id: `nav:${item.href}`,
        label: item.label,
        group: item.group,
        icon: item.icon,
        subtitle: item.parent ? `${item.parent} • ${item.group}` : item.group,
        keywords: [item.parent, item.group, item.label].filter(Boolean) as string[],
        href: item.href,
      }));
  }, [user, allNavItems]);



  const commandItems = React.useMemo<CommandItem[]>(() => [...roleCommandActions, ...commandNavItems], [roleCommandActions, commandNavItems]);

  function recordRecentCommand(id: string) {
    const next = [id, ...recentCommandIds.filter((x) => x !== id)].slice(0, 6);
    setRecentCommandIds(next);
    writeJSON("zc.command.recent", next);
  }

  function scoreCommand(item: CommandItem, q: string) {
    const query = q.trim().toLowerCase();
    if (!query) return 0;
    const hay = `${item.label} ${item.subtitle ?? ""} ${(item.keywords || []).join(" ")}`.toLowerCase();
    if (hay.startsWith(query)) return 120;
    if (hay.includes(query)) return 80;
    // fuzzy-ish: count ordered character matches
    let score = 0;
    let qi = 0;
    for (let i = 0; i < hay.length && qi < query.length; i++) {
      if (hay[i] === query[qi]) {
        score += 2;
        qi += 1;
      }
    }
    return qi === query.length ? score : 0;
  }

  const filteredCommandItems = React.useMemo(() => {
    const q = commandQuery.trim();
    if (!q) return [] as CommandItem[];
    return commandItems
      .map((item) => ({ item, score: scoreCommand(item, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.item)
      .slice(0, 12);
  }, [commandItems, commandQuery]);

  const recentCommandItems = React.useMemo(() => {
    if (!recentCommandIds.length) return [] as CommandItem[];
    const map = new Map(commandItems.map((i) => [i.id, i]));
    return recentCommandIds.map((id) => map.get(id)).filter(Boolean) as CommandItem[];
  }, [commandItems, recentCommandIds]);

  const suggestedCommandItems = React.useMemo(() => {
    const topNavParents = commandNavItems.filter((i) => i.subtitle?.includes("Workspaces") || i.subtitle?.includes("Care Delivery")).slice(0, 6);
    return [...roleCommandActions, ...topNavParents].slice(0, 8);
  }, [commandNavItems, roleCommandActions]);

  const commandSections = React.useMemo(() => {
    if (commandQuery.trim()) {
      return [{ title: "Results", items: filteredCommandItems }];
    }
    const sections: Array<{ title: string; items: CommandItem[] }> = [];
    if (recentCommandItems.length) sections.push({ title: "Recent", items: recentCommandItems });
    if (roleCommandActions.length) sections.push({ title: "Actions", items: roleCommandActions });
    sections.push({ title: "Navigation", items: suggestedCommandItems });
    return sections;
  }, [commandQuery, filteredCommandItems, recentCommandItems, suggestedCommandItems, roleCommandActions]);

  const flatCommandItems = React.useMemo(
    () => commandSections.flatMap((s) => s.items),
    [commandSections]
  );

  React.useEffect(() => {
    if (!commandOpen) return;
    setCommandIndex(0);
  }, [commandQuery, commandOpen, flatCommandItems.length]);

  function executeCommand(item: CommandItem) {
    if (item.onSelect) item.onSelect();
    if (item.href) router.push(item.href as any);
    recordRecentCommand(item.id);
    setCommandOpen(false);
    setCommandQuery("");
  }

  const visibleGroups = React.useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return navGroupsForUser;

    const filtered: NavGroup[] = [];
    for (const g of navGroupsForUser) {
      const items: NavNode[] = [];
      for (const n of g.items) {
        const selfMatch = n.label.toLowerCase().includes(q) || n.href.toLowerCase().includes(q);
        const filteredChildren: NavChild[] = [];
        for (const child of n.children ?? []) {
          if (isChildGroup(child)) {
            const groupMatch = child.label.toLowerCase().includes(q);
            const groupChildren = child.children.filter((c) =>
              (c.label + " " + c.href).toLowerCase().includes(q)
            );
            if (groupMatch) {
              filteredChildren.push(child);
            } else if (groupChildren.length) {
              filteredChildren.push({ ...child, children: groupChildren });
            }
          } else if ((child.label + " " + child.href).toLowerCase().includes(q)) {
            filteredChildren.push(child);
          }
        }

        if (!selfMatch && filteredChildren.length === 0) continue;
        items.push({ ...n, children: selfMatch ? n.children : filteredChildren });
      }
      if (items.length) filtered.push({ ...g, items });
    }
    return filtered;
  }, [navQuery, navGroupsForUser]);


  const sidebarW = collapsed ? "w-[72px]" : "w-[280px]";
  const rowHover = "hover:bg-[rgb(var(--zc-hover-rgb)/0.06)]";
  const rowActive = "bg-[rgb(var(--zc-hover-rgb)/0.10)]";

  return (
    <div className="h-screen overflow-hidden bg-zc-bg text-zc-text">
      {/* Command Center Dialog */}
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent className="p-0 gap-0 overflow-hidden max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700/70 shadow-[0_30px_120px_-40px_rgba(15,23,42,0.8)] ring-1 ring-zinc-200/60 dark:ring-zinc-700/60">
          <DialogTitle className="sr-only">Command Center</DialogTitle>
          <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-4 py-1">
            <IconSearch className="mr-2 h-5 w-5 shrink-0 text-zinc-400" />
            <input
              className="flex h-12 w-full bg-transparent py-3 text-base outline-none placeholder:text-zinc-400 text-zinc-900 dark:text-zinc-100"
              placeholder="Type a command, page, or action..."
              value={commandQuery}
              onChange={(e) => setCommandQuery(e.target.value)}
              onKeyDown={(e) => {
                if (!flatCommandItems.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCommandIndex((i) => (i + 1) % flatCommandItems.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCommandIndex((i) => (i - 1 + flatCommandItems.length) % flatCommandItems.length);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const item = flatCommandItems[commandIndex];
                  if (item) executeCommand(item);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setCommandOpen(false);
                }
              }}
              autoFocus
            />
            {/* <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-zinc-200 bg-zinc-100 px-1.5 font-mono text-[10px] font-medium text-zinc-500 opacity-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 mr-9">
              <span className="text-xs">ESC</span>
            </kbd> */}
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {!commandQuery && commandSections.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                <IconKeyboard className="mx-auto h-8 w-8 mb-3 opacity-50" />
                <p>Start typing to search apps, pages, and actions.</p>
              </div>
            ) : null}

            {commandQuery && filteredCommandItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-zinc-500">
                No results found for "{commandQuery}"
              </div>
            ) : null}

            {(() => {
              let runningIndex = -1;
              return commandSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  <h4 className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {section.title}
                  </h4>
                  {section.items.map((item) => {
                    runningIndex += 1;
                    const active = runningIndex === commandIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => executeCommand(item)}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                          active
                            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/60 dark:text-zinc-100"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        )}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                          <item.icon className="h-4 w-4 text-zinc-500" />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-medium truncate">{item.label}</span>
                          {item.subtitle ? (
                            <span className="text-xs text-zinc-400 truncate">{item.subtitle}</span>
                          ) : null}
                        </div>
                        <IconChevronRight className={cn("h-4 w-4 text-zinc-400", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
                      </button>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-4 py-2.5 text-[10px] text-zinc-500">
            <div>↑/↓ to navigate • Enter to open</div>
            <div>Zypocare Command Center</div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex h-screen min-w-0">
        {/* Sidebar */}
        <aside
          className={cn(
            "hidden lg:flex h-screen flex-col",
            sidebarW,
            "shrink-0 border-r border-zc-border bg-zc-panel transition-[width] duration-300 ease-in-out", // Added smooth width transition
            "overflow-x-hidden"
          )}
        >
          {/* Top Header (Unified) */}
          <div className={cn("shrink-0 relative", collapsed ? "p-3" : "p-4")}>
            <div
              className={cn(
                "flex items-center",
                collapsed ? "flex-col justify-center gap-4" : "justify-between"
              )}
            >
              {/* Brand Section */}
              <div
                className={cn(
                  "flex items-center gap-3 overflow-hidden transition-all duration-300",
                  collapsed ? "justify-center" : ""
                )}
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zc-border bg-zc-card">
                  <IconZypoCare className="h-5 w-5 text-zc-accent" />
                </div>

                <div
                  className={cn(
                    "flex min-w-0 flex-col transition-all duration-300",
                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                  )}
                >
                  <div className="truncate text-sm font-semibold tracking-tight">ZypoCare ONE</div>
                  <div className="mt-0.5 truncate text-xs text-zc-muted">
                    {user ? roleLabel(user) : "SUPER ADMIN"}
                  </div>
                </div>
              </div>

              {/* Toggle Button */}
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 text-muted-foreground", collapsed ? "" : "shrink-0")}
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <IconPanelRight className="h-4 w-4" />
                ) : (
                  <IconPanelLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Sidebar Search */}
          {!collapsed ? (
            <div className="shrink-0 px-4 pb-3">
              {/* <div className="relative">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zc-muted" />
                <Input
                  value={navQuery}
                  onChange={(e) => setNavQuery(e.target.value)}
                  placeholder="Search modules"
                  className={cn(
                    "h-10 pl-10 rounded-lg",
                    "bg-zc-card border-zc-border",
                    "focus-visible:ring-2 focus-visible:ring-zc-ring"
                  )}
                />
              </div> */}
            </div>
          ) : (
            <div className="shrink-0 px-3 pb-3">
              <Separator className="bg-zc-border" />
            </div>
          )}

          {/* Navigation Items */}
          <nav
            className={cn(
              "flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
              collapsed ? "px-2 pb-4" : "px-3 pb-4",
              "zc-scroll-no-track"
            )}
          >
            <div className={cn("grid", collapsed ? "gap-4" : "gap-6")}>
              {visibleGroups.map((group) => {
                const groupOpen = navQuery.trim() ? true : (groupOpenMap[group.title] ?? true);

                return (
                  <div key={group.title} className="grid gap-2">
                    {!collapsed && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.title)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5",
                          "text-[11px] font-semibold uppercase tracking-wide text-zc-muted",
                          "hover:text-zc-text",
                          rowHover,
                          "transition"
                        )}
                      >
                        {groupOpen ? (
                          <IconChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <IconChevronRight className="h-3.5 w-3.5" />
                        )}
                        <span className="truncate">{group.title}</span>
                      </button>
                    )}

                    <div
                      className={cn(
                        "grid gap-1",
                        !collapsed && !groupOpen ? "hidden" : "block"
                      )}
                    >
                      {group.items.map((node) => {
                        const Icon = node.icon;
                        const active = isNavNodeActive(pathname, node);
                        const hasActiveChild = flattenChildLinks(node.children).some(({ link }) =>
                          isActivePath(pathname, link.href)
                        );
                        const open = !collapsed && (openMap[node.href] ?? true);

                        const linkBase = cn(
                          "group flex min-w-0 items-center gap-3 rounded-lg",
                          collapsed ? "px-0 py-2 justify-center" : "px-3 py-2",
                          "text-sm font-medium transition-colors duration-200", // Smooth hover/active transition
                          rowHover
                        );

                        return (
                          <div key={node.href} className="min-w-0">
                            <div className="relative">
                              <Link
                                href={node.href as any}
                                title={collapsed ? node.label : undefined}
                                className={cn(linkBase, active ? rowActive : "")}
                                aria-current={active ? "page" : undefined}
                              >
                                <Icon
                                  className={cn(
                                    "h-4 w-4 shrink-0 transition-colors",
                                    active
                                      ? "text-zc-accent"
                                      : "text-zc-muted group-hover:text-zc-text"
                                  )}
                                />

                                {!collapsed && (
                                  <span
                                    className={cn(
                                      "min-w-0 flex-1 truncate transition-colors",
                                      active ? "text-zc-text" : "text-zc-text/90"
                                    )}
                                  >
                                    {node.label}
                                  </span>
                                )}

                                {!collapsed && <NavBadge badge={node.badge} />}
                              </Link>

                              {!collapsed && node.children?.length ? (
                                <button
                                  type="button"
                                  className={cn(
                                    "absolute right-2 top-1/2 -translate-y-1/2",
                                    "grid h-7 w-7 place-items-center rounded-md",
                                    "text-zc-muted",
                                    rowHover,
                                    "transition-colors"
                                  )}
                                  aria-label={open ? "Collapse section" : "Expand section"}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleOpen(node.href);
                                  }}
                                >
                                  {open ? (
                                    <IconChevronDown className="h-4 w-4" />
                                  ) : (
                                    <IconChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                              ) : null}
                            </div>

                            {!collapsed && node.children?.length && open ? (
                              <div className="mt-1 grid gap-2 pl-9 animate-in slide-in-from-top-1 duration-200">
                                {node.children.map((c) => {
                                  if (isChildGroup(c)) {
                                    return (
                                      <div key={`group-${c.label}`} className="grid gap-1">
                                        <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-zc-muted">
                                          {c.label}
                                        </div>
                                        {c.children.map((child) => {
                                          const childActive =
                                            child.href === node.href ? pathname === child.href : isActivePath(pathname, child.href);
                                          return (
                                            <Link
                                              key={child.href}
                                              href={child.href as any}
                                              className={cn(
                                                "group flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors",
                                                childActive ? rowActive : "",
                                                rowHover
                                              )}
                                              aria-current={childActive ? "page" : undefined}
                                            >
                                              <span
                                                className={cn(
                                                  "h-1.5 w-1.5 rounded-full transition-colors",
                                                  childActive ? "bg-zc-accent" : "bg-zc-border"
                                                )}
                                              />
                                              <span
                                                className={cn(
                                                  "min-w-0 flex-1 truncate transition-colors",
                                                  childActive
                                                    ? "text-zc-text"
                                                    : "text-zc-muted group-hover:text-zc-text"
                                                )}
                                              >
                                                {child.label}
                                              </span>
                                              <NavBadge badge={child.badge} />
                                            </Link>
                                          );
                                        })}
                                      </div>
                                    );
                                  }

                                  const childActive = c.href === node.href ? pathname === c.href : isActivePath(pathname, c.href);
                                  return (
                                    <Link
                                      key={c.href}
                                      href={c.href as any}
                                      className={cn(
                                        "group flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors",
                                        childActive ? rowActive : "",
                                        rowHover
                                      )}
                                      aria-current={childActive ? "page" : undefined}
                                    >
                                      <span
                                        className={cn(
                                          "h-1.5 w-1.5 rounded-full transition-colors",
                                          childActive ? "bg-zc-accent" : "bg-zc-border"
                                        )}
                                      />
                                      <span
                                        className={cn(
                                          "min-w-0 flex-1 truncate transition-colors",
                                          childActive ? "text-zc-text" : "text-zc-muted group-hover:text-zc-text"
                                        )}
                                      >
                                        {c.label}
                                      </span>
                                      <NavBadge badge={c.badge} />
                                    </Link>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Bottom Footer */}
          <div className={cn("shrink-0 border-t border-zc-border", collapsed ? "p-3" : "p-4")}>
            <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
              {!collapsed ? (
                <>
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-zc-card border border-zc-border text-xs font-semibold">
                    {(user?.name || "ZypoCare")
                      .split(" ")
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {user?.name ?? "Super Admin"}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-zc-muted">
                      ZypoCare Hospital • Bengaluru
                    </div>
                  </div>
                </>
              ) : null}

              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
                className="rounded-full"
              >
                <IconLogout className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="min-w-0 flex-1 flex h-screen flex-col bg-zc-bg">
          <header className="shrink-0 sticky top-0 z-40 border-b border-zc-border bg-zc-panel/95 backdrop-blur supports-[backdrop-filter]:bg-zc-panel/75">

            <div className="flex flex-nowrap items-center gap-3 px-4 py-3 md:px-6">

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-tight">{title}</div>
                {user ? (
                  <div className="mt-0.5 truncate text-xs text-zc-muted">
                    {user.name} • {roleLabel(user)}
                  </div>
                ) : null}
              </div>

              <div className="hidden min-w-0 flex-1 px-3 md:flex">
                <div className="relative w-full max-w-[720px]">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zc-muted" />
                  {/* Updated Header Input to trigger Command Center */}
                  <Input
                    onClick={() => setCommandOpen(true)} // Open Command on click
                    readOnly // Prevent typing directly, use modal instead
                    placeholder="Search… (Ctrl/Cmd + K)"
                    className={cn(
                      "h-10 pl-10 rounded-lg cursor-pointer",
                      "bg-zc-card border-zc-border",
                      "focus-visible:ring-2 focus-visible:ring-zc-ring hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    )}
                  />
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {isGlobalScope ? <BranchSelector className="hidden lg:flex" /> : null}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCommandOpen(true)} // Updated Button to Open Command
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition"
                >
                  <IconKeyboard className="h-4 w-4" />
                  Command Center
                </Button>
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  aria-label="Logout"
                  title="Logout"
                  className="rounded-full"
                >
                  <IconLogout className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 min-h-0 overflow-y-auto p-4 md:p-6 zc-scroll-no-track">
            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>
      <ToastHost />
    </div>
  );
}
