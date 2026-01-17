"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { stopNav } from "./store";

export function GlobalNavWatcher() {
  const pathname = usePathname();
  const sp = useSearchParams();

  React.useEffect(() => {
    // Route finished (at least from the client perspective)
    stopNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, sp?.toString()]);

  return null;
}