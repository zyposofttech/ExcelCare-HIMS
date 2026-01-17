"use client";

import Link, { LinkProps } from "next/link";
import * as React from "react";
import { startNav } from "@/components/global-loading/store";

type Props = LinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  loaderMessage?: string;
};

export function LinkWithLoader({ onClick, loaderMessage, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        startNav(loaderMessage ?? "Loading...");
        onClick?.(e);
      }}
    />
  );
}
