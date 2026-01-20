import * as React from "react";
import NextLink from "next/link";
import type { AppHref } from "@/lib/linking";

type NextLinkProps = React.ComponentProps<typeof NextLink>;

export type AppLinkProps = Omit<NextLinkProps, "href"> & {
  href: AppHref;
};

export function AppLink({ href, ...props }: AppLinkProps) {
  // Cast in one place so pages/components can pass string freely
  return <NextLink href={href as any} {...props} />;
}
