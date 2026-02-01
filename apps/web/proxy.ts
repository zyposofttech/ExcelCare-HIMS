import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.json" ||
    // common static extensions
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?|ttf|eot)$/.test(pathname)
  );
}

function getScope(req: NextRequest): "GLOBAL" | "BRANCH" | null {
  const v = req.cookies.get("zypocare_scope")?.value;
  if (v === "GLOBAL" || v === "BRANCH") return v;
  return null;
}

function getRoleCode(req: NextRequest) {
  return (req.cookies.get("zypocare_role")?.value || "").trim().toUpperCase();
}

function homeForScope(scope: "GLOBAL" | "BRANCH" | null) {
  if (scope === "BRANCH") return "/admin";
  if (scope === "GLOBAL") return "/superadmin";
  return "/"; // unknown scope
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Always allow Next internals + static
  if (isStaticAsset(pathname)) return NextResponse.next();

  // Always allow API (proxy/rewrite will handle it)
  if (pathname.startsWith("/api")) return NextResponse.next();

  const authed = req.cookies.get("zypocare_auth")?.value === "1";
  const scope = getScope(req);

  // If user is already authed and hits /login, send them to their home
  if (pathname.startsWith("/login")) {
    if (authed) {
      const url = req.nextUrl.clone();
      url.pathname = homeForScope(scope);
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Must-change-password should be reachable (the page itself handles redirects)
  if (pathname.startsWith("/must-change-password")) {
    return NextResponse.next();
  }

  // Not authed -> force login with next (include querystring)
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${search || ""}`);
    return NextResponse.redirect(url);
  }

  // -------------------------
  // Role-based route enforcement (defense-in-depth)
  // -------------------------

  // /access/* is restricted to SUPER_ADMIN within the GLOBAL scope
  if (pathname.startsWith("/access") && scope === "GLOBAL") {
    const roleCode = getRoleCode(req);
    if (roleCode !== "SUPER_ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/superadmin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Policy governance is SUPER_ADMIN only
  if (pathname.startsWith("/superadmin/policy") && scope === "GLOBAL") {
    const roleCode = getRoleCode(req);
    if (roleCode !== "SUPER_ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/superadmin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Infrastructure setup: SUPER_ADMIN + CORPORATE_ADMIN (+ optionally GLOBAL_ADMIN)
  if (pathname.startsWith("/superadmin/infrastructure") && scope === "GLOBAL") {
    const roleCode = getRoleCode(req);
    const ok = roleCode === "SUPER_ADMIN" || roleCode === "CORPORATE_ADMIN" || roleCode === "GLOBAL_ADMIN";
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/superadmin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // -------------------------
  // Role-scope route enforcement (when cookie is present)
  // -------------------------

  // Branch-scoped users must not enter Central Console routes
  if (scope === "BRANCH") {
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/superadmin") || pathname.startsWith("/access")) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Global users should operate from Central Console
  if (scope === "GLOBAL") {
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/superadmin";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/admin")) {
      const url = req.nextUrl.clone();
      url.pathname = "/superadmin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
