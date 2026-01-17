"use client";

import * as React from "react";

type State = {
  pending: number; // data fetch + CRUD
  nav: number;     // route navigation
  message?: string;
};

let state: State = { pending: 0, nav: 0, message: undefined };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(partial: Partial<State>) {
  state = { ...state, ...partial };
  emit();
}

function getSnapshot() {
  return state;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

let navFallbackTimer: any = null;

export function startLoading(message?: string) {
  setState({ pending: state.pending + 1, message: message ?? state.message });
}

export function stopLoading() {
  const next = Math.max(0, state.pending - 1);
  setState({ pending: next, message: next === 0 && state.nav === 0 ? undefined : state.message });
}

export function startNav(message = "Loading...") {
  setState({ nav: state.nav + 1, message });

  // Safety: if navigation never completes, stop nav loader after 8s
  if (navFallbackTimer) clearTimeout(navFallbackTimer);
  navFallbackTimer = setTimeout(() => {
    stopNav();
  }, 8000);
}

export function stopNav() {
  const next = Math.max(0, state.nav - 1);
  setState({ nav: next, message: state.pending === 0 && next === 0 ? undefined : state.message });

  if (navFallbackTimer && next === 0) {
    clearTimeout(navFallbackTimer);
    navFallbackTimer = null;
  }
}

export function useGlobalLoading() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
