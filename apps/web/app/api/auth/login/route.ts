import { NextRequest, NextResponse } from "next/server";

const CORE_API_URL =
  process.env.CORE_API_URL ??
  (process.env.VERCEL ? "https://zypocare-one.onrender.com" : "http://localhost:4000");

function resolveScope(user: any): "GLOBAL" | "BRANCH" | null {
  if (!user) return null;

  const scope = user.roleScope as ("GLOBAL" | "BRANCH" | null | undefined);
  if (scope === "GLOBAL" || scope === "BRANCH") return scope;

  const roleCode = String(user.roleCode ?? user.role ?? "").trim().toUpperCase();
  if (roleCode === "SUPER_ADMIN" || roleCode === "CORPORATE_ADMIN") return "GLOBAL";
  if (user.branchId) return "BRANCH";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    const upstream = await fetch(`${CORE_API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });

    const ct = upstream.headers.get("content-type") || "";
    const data = ct.includes("application/json")
      ? await upstream.json().catch(() => ({}))
      : await upstream.text().catch(() => "");

    const res = NextResponse.json(data, { status: upstream.status });

    // If login success, set cookies used by proxy.ts/middleware
    if (upstream.ok && (data as any)?.user) {
      const user = (data as any).user;
      const scope = resolveScope(user);
      const roleCode = String(user.roleCode ?? user.role ?? "").trim().toUpperCase();

      res.cookies.set("zypocare_auth", "1", {
        path: "/",
        sameSite: "lax",
      });

      if (scope) {
        res.cookies.set("zypocare_scope", scope, {
          path: "/",
          sameSite: "lax",
        });
      } else {
        res.cookies.delete("zypocare_scope");
      }

      if (roleCode) {
        res.cookies.set("zypocare_role", roleCode, {
          path: "/",
          sameSite: "lax",
        });
      } else {
        res.cookies.delete("zypocare_role");
      }
    }

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message || "Login proxy failed" },
      { status: 502 }
    );
  }
}
