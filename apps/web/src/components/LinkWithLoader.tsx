"use client";

import Link from "next/link";
import * as React from "react";
import type { UrlObject } from "url";
import type { Route } from "next";
import { startNav } from "@/components/global-loading/store";

type AppHref = string | UrlObject | Route<string>;

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: AppHref;
  loaderMessage?: string;

  // Next/link common props (keep what you use)
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  locale?: string | false;
};

export function LinkWithLoader({ onClick, loaderMessage, href, ...props }: Props) {
  return (
    <Link
      href={href as any} // cast once here, so rest of app can pass string freely
      {...props}
      onClick={(e) => {
        startNav(loaderMessage ?? "Loading...");
        onClick?.(e);
      }}
    />
  );
}
