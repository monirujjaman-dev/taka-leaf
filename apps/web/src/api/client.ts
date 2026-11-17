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
const BUSY_MESSAGE = "Too many requests from this network right now. Wait a minute, then try again.";
const SERVER_MESSAGE = "TakaLeaf could not check your session just now. Try again in a moment.";

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
  // The rate limiter answers with no body; say what it means rather than "Something went wrong (429)".
  if (response.status === 429 && !title) return new ApiError(429, BUSY_MESSAGE, {}, "rate-limited");
  return new ApiError(response.status, title ?? `Something went wrong (${response.status}). Try again.`, fieldErrors, body.code);
}

/** How long a call may hang on a poor mobile connection before the person is told. */
export const REQUEST_TIMEOUT_MS = 30_000;
const SLOW_READ_MESSAGE = "TakaLeaf took too long to answer. Check your connection and try again.";
// A save that timed out may still have reached the server, so trying again blindly could record it twice.
const SLOW_WRITE_MESSAGE = "TakaLeaf took too long to answer, so this may or may not have saved. Check before trying again.";

/** The caller's signal plus a timeout, where the browser supports combining them. */
function withTimeout(signal: AbortSignal | null | undefined): { signal?: AbortSignal; timeout?: AbortSignal } {
  if (typeof AbortSignal.timeout !== "function") return { signal: signal ?? undefined };
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  if (!signal) return { signal: timeout, timeout };
  if (typeof AbortSignal.any !== "function") return { signal };
  return { signal: AbortSignal.any([signal, timeout]), timeout };
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  const { signal, timeout } = withTimeout(init.signal);
  try {
    return await fetch(`/api${path}`, { credentials: "same-origin", ...init, signal });
  } catch (error) {
    if (timeout?.aborted) {
      const write = (init.method ?? "GET") !== "GET" && !path.startsWith("/auth/refresh");
      throw new ApiError(0, write ? SLOW_WRITE_MESSAGE : SLOW_READ_MESSAGE, {}, "timeout");
    }
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
    // "Could not check" is not "signed out": a busy or failing server, like a lost connection
    // (which rawFetch throws), leaves the session alone so the person can try again.
    if (response.status === 429) throw await toError(response);
    if (response.status >= 500) throw new ApiError(response.status, SERVER_MESSAGE);
    break;
  }
  setSession(null);
  return null;
}

/** True when the session could not be checked (busy, server or network trouble), as opposed to ended. */
export function isTransient(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500);
}

/**
 * Restores or renews the session from the refresh cookie. Concurrent callers share one request.
 * Resolves with null when the session has ended; rejects (see isTransient) when it could not be checked.
 */
export function refreshSession(): Promise<AuthUser | null> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

let primed: Promise<AuthUser | null> | null = null;

/**
 * Starts restoring the session as the script loads (main.tsx), before React has rendered, so the
 * refresh call overlaps start-up instead of waiting for it. AuthProvider takes this promise once.
 */
export function primeSession(): Promise<AuthUser | null> {
  primed ??= refreshSession();
  return primed;
}

/** The primed session, once: a second caller (or a test that never primed) refreshes as usual. */
export function takePrimedSession(): Promise<AuthUser | null> | null {
  const promise = primed;
  primed = null;
  return promise;
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
