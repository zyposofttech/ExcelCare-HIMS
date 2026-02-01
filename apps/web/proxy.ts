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
  // "superadmin" workspace has been removed. Use dashboard routes.
  if (scope === "BRANCH") return "/dashboard";
  if (scope === "GLOBAL") return "/dashboard/global";
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
  // Legacy route compatibility
  // -------------------------
  // The /superadmin workspace was removed; redirect stale links to their new homes.
  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) {
    const url = req.nextUrl.clone();

    // Branch users should never land in global console.
    if (scope === "BRANCH") {
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // GLOBAL users: map known subtrees.
    if (pathname.startsWith("/superadmin/infrastructure")) {
      url.pathname = pathname.replace("/superadmin/infrastructure", "/infrastructure") || "/infrastructure";
    } else if (pathname.startsWith("/superadmin/branches")) {
      url.pathname = pathname.replace("/superadmin/branches", "/branches") || "/branches";
    } else if (pathname.startsWith("/superadmin/policy")) {
      url.pathname = pathname.replace("/superadmin/policy", "/policy") || "/policy";
    } else if (pathname.startsWith("/superadmin/users")) {
      url.pathname = pathname.replace("/superadmin/users", "/users") || "/users";
    } else if (pathname.startsWith("/superadmin/dashboard")) {
      url.pathname = "/dashboard/global";
    } else {
      url.pathname = "/dashboard/global";
    }

    url.search = "";
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
      url.pathname = "/dashboard/global";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Policy governance is SUPER_ADMIN only
  if (pathname.startsWith("/policy") && scope === "GLOBAL") {
    const roleCode = getRoleCode(req);
    if (roleCode !== "SUPER_ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard/global";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Infrastructure setup: SUPER_ADMIN + CORPORATE_ADMIN (+ optionally GLOBAL_ADMIN)
  if (pathname.startsWith("/infrastructure") && scope === "GLOBAL") {
    const roleCode = getRoleCode(req);
    const ok = roleCode === "SUPER_ADMIN" || roleCode === "CORPORATE_ADMIN" || roleCode === "GLOBAL_ADMIN";
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard/global";
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
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Branch users must not enter GLOBAL-only areas.
    if (pathname.startsWith("/access") || pathname.startsWith("/policy") || pathname.startsWith("/dashboard/global") || pathname.startsWith("/branches")) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Global users should operate from Central Console
  if (scope === "GLOBAL") {
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard/global";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/admin")) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard/global";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
