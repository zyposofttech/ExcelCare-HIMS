import { useAuthStore } from "@/lib/auth/store";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token") ||
      null
    );
  } catch {
    return null;
  }
}

export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");

  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (mutating) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, method, headers });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data as any)?.message || `Request failed (${res.status})`);
  return data as T;
}
