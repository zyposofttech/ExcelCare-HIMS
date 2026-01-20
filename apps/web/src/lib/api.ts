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

// Optional: integrate with the new GlobalLoader store (won't break if missing)
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
};

export async function apiFetch<T>(url: string, init: ApiFetchOptions = {}): Promise<T> {
  const { showLoader = true, loaderMessage, ...fetchInit } = init;

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

  // Start loader(s)
  const loadingId = zcLoading.start({
    kind: "api",
    method,
    url,
    label,
  });

  const store = showLoader ? await getLoadingStore() : null;
  if (showLoader && store?.startLoading) store.startLoading(label);

  try {
    // Mutations: set JSON content-type only if not set already
    if (!isRead) {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

      // CSRF token (if you use it)
      const csrf = getCookie("xc_csrf");
      if (csrf && !headers.has("X-CSRF-Token")) headers.set("X-CSRF-Token", csrf);
    }

    const res = await fetch(url, {
      ...fetchInit,
      method,
      headers,
      credentials: "include",
    });

    const ct = res.headers.get("content-type") || "";
    const data: any = ct.includes("application/json") ? await res.json() : await res.text();

    if (!res.ok) {
      const msg =
        data?.message ||
        data?.error ||
        (typeof data === "string" && data) ||
        `Request failed (${res.status})`;

      throw new ApiError(msg, {
        status: res.status,
        data,
        url,
        method,
      });
    }

    return data as T;
  } catch (e: any) {
    // Normalize network/unexpected failures into ApiError
    if (e instanceof ApiError) throw e;
    const msg = e?.message ? String(e.message) : "Network error";
    throw new ApiError(msg, { status: 0, data: undefined, url, method });
  } finally {
    zcLoading.end(loadingId);
    if (showLoader && store?.stopLoading) store.stopLoading();
  }
}
