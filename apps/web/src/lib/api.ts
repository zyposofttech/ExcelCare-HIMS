import { zcLoading } from "@/lib/loading-events";

export class ApiError<TData = any> extends Error {
  status: number;
  data?: TData;
  url?: string;
  method?: string;

  constructor(
    message: string,
    opts: { status: number; data?: TData; url?: string; method?: string } = { status: 0 },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.data = opts.data;
    this.url = opts.url;
    this.method = opts.method;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
}

function clearAccessToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
  } catch {
    // ignore
  }
}

function isAbsoluteUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/**
 * Your frontend mostly routes via Next rewrites (/api/*).
 * Some pages call apiFetch("/branches") etc — normalize to /api by default.
 */
function normalizeApiUrl(url: string): string {
  if (!url) return url;
  if (isAbsoluteUrl(url)) return url;

  if (url === "/api" || url.startsWith("/api/")) return url;

  // if caller passes "branches" (no leading slash), do not alter
  if (!url.startsWith("/")) return url;

  return `/api${url}`;
}

// Optional: integrate with GlobalLoader store (won't break if missing)
let loadingStore: any | null = null;
async function getLoadingStore() {
  if (typeof window === "undefined") return null;
  if (loadingStore) return loadingStore;
  try {
    loadingStore = await import("@/components/global-loading/store");
    return loadingStore;
  } catch {
    return null;
  }
}

type ApiFetchOptions = RequestInit & {
  showLoader?: boolean; // default true
  loaderMessage?: string; // overrides default label
  /** If true, do NOT auto logout on 401/403 */
  noAutoLogout?: boolean;
};

/**
 * NO refresh tokens in backend:
 * Any 401/403 should trigger hard logout to avoid "cookie says logged-in but token expired".
 */
let isLoggingOut = false;
async function hardLogoutIfBrowser() {
  if (typeof window === "undefined") return;
  if (isLoggingOut) return;
  isLoggingOut = true;

  try {
    // clears proxy-gating cookies server-side
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  } finally {
    clearAccessToken();

    try {
      const mod = await import("@/lib/auth/store");
      mod.useAuthStore.getState().logout();
    } catch {
      // ignore
    }

    try {
      const here = window.location.pathname + window.location.search;
      const next = encodeURIComponent(here);
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = `/login?next=${next}`;
      }
    } catch {
      // ignore
    }
  }
}

export async function apiFetch<T>(url: string, init: ApiFetchOptions = {}): Promise<T> {
  const { showLoader = true, loaderMessage, noAutoLogout = false, ...fetchInit } = init;

  const normalizedUrl = normalizeApiUrl(url);

  const method = (fetchInit.method ?? "GET").toUpperCase();
  const headers = new Headers(fetchInit.headers || {});
  headers.set("Accept", "application/json");

  // Attach token for protected APIs
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const isRead = ["GET", "HEAD", "OPTIONS"].includes(method);
  const label = loaderMessage ?? (isRead ? "Loading…" : "Saving changes…");

  const loadingId = zcLoading.start({
    kind: "api",
    method,
    url: normalizedUrl,
    label,
  });

  const store = showLoader ? await getLoadingStore() : null;
  if (showLoader && store?.startLoading) store.startLoading(label);

  try {
    if (!isRead) {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

      const csrf = getCookie("xc_csrf");
      if (csrf && !headers.has("X-CSRF-Token")) headers.set("X-CSRF-Token", csrf);
    }

    const res = await fetch(normalizedUrl, {
      ...fetchInit,
      method,
      headers,
      credentials: "include",
    });

    const ct = res.headers.get("content-type") || "";
    const data: any = ct.includes("application/json") ? await res.json() : await res.text();

    if (!res.ok) {
      // ✅ no refresh → hard logout on 401/403 unless caller opts out
      if (!noAutoLogout && (res.status === 401 || res.status === 403)) {
        void hardLogoutIfBrowser();
      }

      const msg =
        data?.message ||
        data?.error ||
        (typeof data === "string" && data) ||
        `Request failed (${res.status})`;

      throw new ApiError(msg, {
        status: res.status,
        data,
        url: normalizedUrl,
        method,
      });
    }

    return data as T;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    const msg = e?.message ? String(e.message) : "Network error";
    throw new ApiError(msg, { status: 0, data: undefined, url: normalizedUrl, method });
  } finally {
    zcLoading.end(loadingId);
    if (showLoader && store?.stopLoading) store.stopLoading();
  }
}

/* ----------------------------- IAM helpers ----------------------------- */

export type Principal = {
  userId: string;
  email: string;
  name: string;
  branchId: string | null;
  roleCode: string | null;
  roleScope: "GLOBAL" | "BRANCH" | null;
  roleVersionId: string | null;
  permissions: string[];
};

export async function getMe(opts: { showLoader?: boolean } = {}): Promise<Principal> {
  const res = await apiFetch<{ principal: Principal }>("/api/iam/me", {
    showLoader: opts.showLoader ?? false,
  });
  return res.principal;
}

/**
 * Fetches /api/iam/me (if access_token exists) and syncs to Zustand auth store.
 * This is the single source of truth for frontend permission gating.
 */
export async function syncPrincipalToAuthStore(): Promise<Principal | null> {
  if (typeof window === "undefined") return null;

  const token = getAccessToken();
  if (!token) return null;

  try {
    const principal = await getMe({ showLoader: false });

    const mod = await import("@/lib/auth/store");
    const store = mod.useAuthStore;

    const st = store.getState();
    const currentUser = st.user;

    if (currentUser) {
      st.updateUser({
        id: principal.userId,
        email: principal.email,
        name: principal.name,
        roleCode: principal.roleCode,
        roleScope: principal.roleScope,
        permissions: principal.permissions, // ✅ add this
        branchId: principal.branchId,
        role: (principal.roleCode ?? currentUser.role) as any,
      });
    } else {
      st.login(
        {
          id: principal.userId,
          email: principal.email,
          name: principal.name,
          role: (principal.roleCode ?? "BRANCH_ADMIN") as any,
          roleCode: principal.roleCode,
          roleScope: principal.roleScope,
          permissions: principal.permissions, // ✅ add this
          branchId: principal.branchId,
        } as any,
        token
      );
    }

    return principal;
  } catch {
    // auto-logout is handled by apiFetch on 401/403
    return null;
  }
}

