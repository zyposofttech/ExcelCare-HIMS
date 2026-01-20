import type { Route } from "next";
import type { UrlObject } from "url";

/** Accept strings app-wide (loose), but still compatible with Next Link */
export type AppHref = string | UrlObject | Route<string>;
