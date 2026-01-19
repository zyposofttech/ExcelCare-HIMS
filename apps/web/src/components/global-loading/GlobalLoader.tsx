"use client";

import * as React from "react";
import { useGlobalLoading } from "./store";

export function GlobalLoader() {
  const s = useGlobalLoading();
  const active = (s.pending + s.nav) > 0;

  if (!active) return null;

  return (
    <>
      {/* Indeterminate top bar */}
      <div className="fixed left-0 right-0 top-0 z-[1000] h-[3px] overflow-hidden">
        <div className="xc-indeterminate-bar h-full" />
      </div>

      {/* Glass overlay */}
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
        <div className="flex items-center gap-3 rounded-xl border bg-white/90 px-4 py-3 shadow-lg dark:bg-zinc-950/90">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" />
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {s.message ?? "Loading..."}
          </div>
        </div>
      </div>

      {/* Local CSS for indeterminate bar (no need to edit global.css) */}
      <style jsx global>{`
        .xc-indeterminate-bar {
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(131, 33, 192, 0.95), transparent);
          animation: xc-indeterminate 1.1s ease-in-out infinite;
        }
        @keyframes xc-indeterminate {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </>
  );
}
