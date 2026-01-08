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
  role: AppRole;
  facilityId?: string;
  facilityName?: string;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null; // demo only; swap with real JWT later
  login: (user: AuthUser) => void;
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
    (set) => ({
      user: null,
      token: null,
      login: (user) => {
        setAuthCookie();
        set({ user, token: "demo-token" });
      },
      logout: () => {
        clearAuthCookie();
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
