import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  // Clear edge-gating cookies
  res.cookies.delete("zypocare_auth");
  res.cookies.delete("zypocare_scope");
  res.cookies.delete("zypocare_role");

  // If you add CSRF cookie later, clear it too
  // res.cookies.delete("xc_csrf");

  return res;
}
