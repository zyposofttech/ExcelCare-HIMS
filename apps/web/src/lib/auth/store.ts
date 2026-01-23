"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AppRole =
  | "SUPER_ADMIN"
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
  branchId?: string | null;
  branchName?: string | null;
  mustChangePassword?: boolean;
  isActive?: boolean;
};

const REMEMBER_DEVICE_KEY = "zypocare-remember-device";

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  _hasHydrated: boolean; //  New Flag
  login: (user: AuthUser, token: string | null) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => void;
  setHydrated: (state: boolean) => void;
};

function setAuthCookie() {
  document.cookie = `zypocare_auth=1; Path=/; SameSite=Lax`;
}

function clearAuthCookie() {
  document.cookie = `zypocare_auth=; Max-Age=0; Path=/; SameSite=Lax`;
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
      _hasHydrated: false, // Default false

      login: (user, token) => {
        setAuthCookie();
        set({ user, token });
      },

      updateUser: (patch) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...patch } });
      },

      logout: () => {
        clearAuthCookie();
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
      //  Update flag when storage is loaded
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
