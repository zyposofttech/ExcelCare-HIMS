"use client";

import { create } from "zustand";

export const ACTIVE_BRANCH_STORAGE_KEY = "zc.activeBranchId";
const ACTIVE_BRANCH_EVENT = "zc:active-branch-changed";

type ActiveBranchChangedDetail = { branchId: string | null };

function readStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY);
    return v ? String(v) : null;
  } catch {
    return null;
  }
}

function writeStorage(branchId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (branchId) localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, branchId);
    else localStorage.removeItem(ACTIVE_BRANCH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function dispatchChanged(branchId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const detail: ActiveBranchChangedDetail = { branchId };
    window.dispatchEvent(new CustomEvent(ACTIVE_BRANCH_EVENT, { detail }));
  } catch {
    // ignore
  }
}

let patched = false;
function patchLocalStorage() {
  if (patched) return;
  if (typeof window === "undefined") return;

  try {
    const ls = window.localStorage as Storage & { __zcPatchedActiveBranch?: boolean };
    if (ls.__zcPatchedActiveBranch) {
      patched = true;
      return;
    }

    const origSetItem = ls.setItem.bind(ls);
    const origRemoveItem = ls.removeItem.bind(ls);

    ls.setItem = ((key: string, value: string) => {
      origSetItem(key, value);
      if (key === ACTIVE_BRANCH_STORAGE_KEY) {
        dispatchChanged(value || null);
      }
    }) as any;

    ls.removeItem = ((key: string) => {
      origRemoveItem(key);
      if (key === ACTIVE_BRANCH_STORAGE_KEY) {
        dispatchChanged(null);
      }
    }) as any;

    ls.__zcPatchedActiveBranch = true;
    patched = true;
  } catch {
    // ignore
  }
}

export type ActiveBranchState = {
  /** Active branch for GLOBAL-scope users. */
  activeBranchId: string | null;
  setActiveBranchId: (branchId: string | null) => void;
  rehydrateFromStorage: () => void;
};

export const useActiveBranchStore = create<ActiveBranchState>((set) => ({
  activeBranchId: readStorage(),

  setActiveBranchId: (branchId) => {
    set({ activeBranchId: branchId });
    writeStorage(branchId);
    // Safety: dispatch even if storage patch is not installed yet
    dispatchChanged(branchId);
  },

  rehydrateFromStorage: () => set({ activeBranchId: readStorage() }),
}));

let syncInitialized = false;

/**
 * Call once from a long-lived client component (e.g., AppShell) to keep the store
 * in sync when other parts of the app write to localStorage.
 */
export function initActiveBranchSync() {
  if (syncInitialized) return;
  if (typeof window === "undefined") return;

  patchLocalStorage();
  syncInitialized = true;

  useActiveBranchStore.getState().rehydrateFromStorage();

  const onChanged = (ev: Event) => {
    const ce = ev as CustomEvent<ActiveBranchChangedDetail>;
    const branchId = ce?.detail?.branchId ?? readStorage();
    useActiveBranchStore.setState({ activeBranchId: branchId });
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== ACTIVE_BRANCH_STORAGE_KEY) return;
    useActiveBranchStore.setState({ activeBranchId: e.newValue || null });
  };

  window.addEventListener(ACTIVE_BRANCH_EVENT, onChanged as any);
  window.addEventListener("storage", onStorage);
}
