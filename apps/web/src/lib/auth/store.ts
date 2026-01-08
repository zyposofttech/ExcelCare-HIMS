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

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  login: (user: AuthUser, token: string | null) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => void;
};

function setAuthCookie() {
  document.cookie = `excelcare_auth=1; Path=/; SameSite=Lax`;
}

function clearAuthCookie() {
  document.cookie = `excelcare_auth=; Max-Age=0; Path=/; SameSite=Lax`;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

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
          localStorage.removeItem("access_token");
          sessionStorage.removeItem("access_token");
        } catch {
          // ignore
        }
        set({ user: null, token: null });
      },
    }),
    {
      name: "excelcare-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
);
