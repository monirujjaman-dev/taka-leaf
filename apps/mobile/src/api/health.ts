import type { CheckResult } from "../db/store";

/** "takaleaf.example.com" or "http://192.168.0.5:5080" → a base URL without a trailing slash. */
export function normaliseServerUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/**
 * Calls GET /api/health on the user's server. Never throws: the result says what happened in
 * plain words, so it can be stored and shown as is.
 */
export async function checkHealth(serverUrl: string, timeoutMs = 10_000, fetchImpl: typeof fetch = fetch): Promise<CheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetchImpl(`${serverUrl}/api/health`, { signal: controller.signal, headers: { Accept: "application/json" } });
    const ms = Date.now() - started;
    if (!response.ok) return { ok: false, detail: `Server answered ${response.status}` };
    return { ok: true, detail: `Server answered in ${ms} ms` };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, detail: `No answer within ${Math.round(timeoutMs / 1000)} seconds` };
    return { ok: false, detail: error instanceof Error ? `Could not reach the server: ${error.message}` : "Could not reach the server" };
  } finally {
    clearTimeout(timer);
  }
}
