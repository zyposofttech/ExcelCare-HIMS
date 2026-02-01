"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AppRole =
  | "SUPER_ADMIN"
  | "CORPORATE_ADMIN"
  | "GLOBAL_ADMIN"
  | "BRANCH_ADMIN"
  | "FRONT_OFFICE"
  | "DOCTOR"
  | "NURSE"
  | "BILLING";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole | string;
  roleCode?: AppRole | string | null;
  branchId?: string | null;
  branchName?: string | null;
  mustChangePassword?: boolean;
  isActive?: boolean;

  // Optional (if your backend already sends it)
  roleScope?: "GLOBAL" | "BRANCH" | string | null;
};

const REMEMBER_DEVICE_KEY = "zypocare-remember-device";

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  _hasHydrated: boolean;
  login: (user: AuthUser, token: string | null) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => void;
  setHydrated: (state: boolean) => void;
};

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function setAuthCookie() {
  setCookie("zypocare_auth", "1");
}

function clearAuthCookie() {
  clearCookie("zypocare_auth");
}

function inferScopeFromUser(u: AuthUser): "GLOBAL" | "BRANCH" {
  // Prefer explicit scope if backend provides it
  const scope = String(u.roleScope || "").toUpperCase();
  if (scope === "BRANCH") return "BRANCH";
  if (scope === "GLOBAL") return "GLOBAL";

  // Fallback: branchId implies BRANCH scope
  if (u.branchId) return "BRANCH";
  return "GLOBAL";
}
// ✅ Exported helper used by Access pages and other UI gating
export function getRoleCode(user?: AuthUser | null): string {
  if (!user) return "";
  const raw = (user as any)?.roleCode ?? user.role ?? "";
  const r = String(raw).trim().toUpperCase();
  const map: Record<string, string> = {
    SUPER: "SUPER_ADMIN",
    SUPERADMIN: "SUPER_ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
    CORPORATE: "CORPORATE_ADMIN",
    CORPORATEADMIN: "CORPORATE_ADMIN",
    CORPORATE_ADMIN: "CORPORATE_ADMIN",
    GLOBAL: "GLOBAL_ADMIN",
    GLOBALADMIN: "GLOBAL_ADMIN",
    GLOBAL_ADMIN: "GLOBAL_ADMIN",
    BRANCH: "BRANCH_ADMIN",
    BRANCHADMIN: "BRANCH_ADMIN",
    BRANCH_ADMIN: "BRANCH_ADMIN",
  };
  return map[r] ?? r;
}

function setRoleScopeCookies(u: AuthUser) {
  const roleCode = String(u.role || "").trim().toUpperCase();
  const scope = inferScopeFromUser(u);
  setCookie("zypocare_role", roleCode || "UNKNOWN");
  setCookie("zypocare_scope", scope);
}

function clearRoleScopeCookies() {
  clearCookie("zypocare_role");
  clearCookie("zypocare_scope");
}

function getPreferredStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    if (localStorage.getItem(REMEMBER_DEVICE_KEY) === "1") return localStorage;
    if (sessionStorage.getItem(REMEMBER_DEVICE_KEY) === "1") return sessionStorage;
  } catch {}
  return null;
}

const authStorage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return null;
    try {
      const preferred = getPreferredStorage();
      if (preferred) return preferred.getItem(name);
      return localStorage.getItem(name) ?? sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") return;
    try {
      const preferred = getPreferredStorage();
      (preferred ?? localStorage).setItem(name, value);
    } catch {}
  },
  removeItem: (name: string) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(name);
      sessionStorage.removeItem(name);
    } catch {}
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      _hasHydrated: false,

      login: (user, token) => {
        setAuthCookie();
        setRoleScopeCookies(user);
        set({ user, token });
      },

      updateUser: (patch) => {
        const current = get().user;
        if (!current) return;
        const nextUser = { ...current, ...patch };
        // Keep cookies aligned if role/scope/branch changes
        try {
          setRoleScopeCookies(nextUser);
        } catch {}
        set({ user: nextUser });
      },

      logout: () => {
        clearAuthCookie();
        clearRoleScopeCookies();
        try {
          localStorage.removeItem(REMEMBER_DEVICE_KEY);
          sessionStorage.removeItem(REMEMBER_DEVICE_KEY);
          localStorage.removeItem("access_token");
          sessionStorage.removeItem("access_token");
        } catch {}
        set({ user: null, token: null });
      },

      setHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "zypocare-auth",
      storage: createJSONStorage(() => authStorage),
      partialize: (s) => ({ user: s.user, token: s.token }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
