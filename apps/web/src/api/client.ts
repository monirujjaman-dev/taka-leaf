import type { AuthResponse, AuthUser } from "./types";

/**
 * Talks to the TakaLeaf API. The access token lives only in memory; the refresh token is an
 * HttpOnly cookie the browser sends to /api/auth by itself. When a call comes back 401, the
 * session is refreshed once and the call is repeated, so a person never sees the 15-minute
 * token expiry.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: Record<string, string> = {},
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** The message for one form field, if the API named that field. */
  field(name: string): string | undefined {
    return this.fieldErrors[name];
  }
}

const NETWORK_MESSAGE = "Could not reach TakaLeaf. Check your internet connection and try again.";

let accessToken: string | null = null;
let refreshing: Promise<AuthUser | null> | null = null;
const signedOutListeners = new Set<() => void>();

export function setSession(response: AuthResponse | null) {
  accessToken = response?.accessToken ?? null;
}

/** Called when the session can no longer be refreshed, so the app can show the sign-in page. */
export function onSignedOut(listener: () => void): () => void {
  signedOutListeners.add(listener);
  return () => signedOutListeners.delete(listener);
}

async function toError(response: Response): Promise<ApiError> {
  let body: { title?: string; errors?: Record<string, string[]>; code?: string } = {};
  try {
    body = await response.json();
  } catch {
    // Not a problem response (for example a proxy error page).
  }

  const fieldErrors: Record<string, string> = {};
  for (const [key, messages] of Object.entries(body.errors ?? {})) {
    const name = key.charAt(0).toLowerCase() + key.slice(1);
    if (messages[0]) fieldErrors[name] = messages[0];
  }

  const firstField = Object.values(fieldErrors)[0];
  const title = body.errors && firstField ? firstField : body.title;
  return new ApiError(response.status, title ?? `Something went wrong (${response.status}). Try again.`, fieldErrors, body.code);
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`/api${path}`, { credentials: "same-origin", ...init });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, NETWORK_MESSAGE);
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function doRefresh(): Promise<AuthUser | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await rawFetch("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (response.ok) {
      const session = (await response.json()) as AuthResponse;
      setSession(session);
      return session.user;
    }
    // Another tab refreshed with the same cookie a moment ago; its new cookie is ours too.
    if (response.status === 409 && attempt === 0) {
      await wait(400);
      continue;
    }
    break;
  }
  setSession(null);
  return null;
}

/** Restores or renews the session from the refresh cookie. Concurrent callers share one request. */
export function refreshSession(): Promise<AuthUser | null> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

/** Sends a request with the access token, renewing the session once on 401. Throws ApiError on failure. */
async function authorised(path: string, options: RequestOptions): Promise<Response> {
  const send = () => {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return rawFetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  };

  let response = await send();
  if (response.status === 401 && !path.startsWith("/auth/login")) {
    const user = await refreshSession();
    if (!user) {
      signedOutListeners.forEach((listener) => listener());
      throw new ApiError(401, "Your session has ended. Sign in again.");
    }
    response = await send();
  }

  if (!response.ok) throw await toError(response);
  return response;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await authorised(path, options);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Downloads a file from the API (for example the CSV export) and hands it to the browser to save. */
export async function download(path: string, fallbackName: string): Promise<void> {
  const response = await authorised(path, {});
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const name = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] ?? /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = decodeURIComponent(name);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
