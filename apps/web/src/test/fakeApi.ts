import { vi } from "vitest";

export interface Call {
  method: string;
  path: string;
  body: unknown;
  authorization: string | null;
}

type Reply = { status?: number; body?: unknown } | ((call: Call) => { status?: number; body?: unknown });

/**
 * A stand-in for the backend: "METHOD /path" -> reply. The path is matched without the query
 * string unless the key has one. Every call is recorded for assertions.
 */
export function fakeApi(routes: Record<string, Reply>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/api/, "");
    const headers = new Headers(init?.headers);
    const call: Call = {
      method,
      path: path + url.search,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      authorization: headers.get("Authorization"),
    };
    calls.push(call);
    const route = routes[`${method} ${path}${url.search}`] ?? routes[`${method} ${path}`];
    if (!route) return new Response(JSON.stringify({ title: `No fake for ${method} ${path}` }), { status: 404 });
    const reply = typeof route === "function" ? route(call) : route;
    const status = reply.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(reply.body ?? {}), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

export const session = (email = "monir@example.com", token = "access-1") => ({
  accessToken: token,
  accessTokenExpiresAt: "2026-11-16T08:00:00Z",
  refreshToken: null,
  user: { id: "u1", email },
});

export const signedOut = { status: 401, body: { title: "Your session has ended. Sign in again." } };

export const wallet = (overrides: Record<string, unknown> = {}) => ({
  id: "w-cash",
  type: "Cash",
  name: "Cash",
  openingBalance: 0,
  balance: 0,
  creditLimit: null,
  availableCredit: null,
  personId: null,
  icon: null,
  color: null,
  archived: false,
  excludedFromTotal: false,
  sortOrder: 0,
  ...overrides,
});

export const emptyDashboard = (month: string) => ({
  month,
  netBalance: 0,
  assets: 0,
  liabilities: 0,
  income: 0,
  expense: 0,
  owedToMe: 0,
  iOwe: 0,
  spendingByCategory: [],
  recent: [],
});
