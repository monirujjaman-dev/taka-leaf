import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, session, signedOut } from "../test/fakeApi";
import { api, ApiError, onSignedOut, setSession } from "./client";

describe("api client", () => {
  beforeEach(() => setSession(session("a@example.com", "old-token")));
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("sends the access token", async () => {
    const { calls } = fakeApi({ "GET /wallets": { body: { wallets: [] } } });
    await api("/wallets");
    expect(calls[0]?.authorization).toBe("Bearer old-token");
  });

  it("refreshes once on 401 and repeats the call with the new token", async () => {
    let first = true;
    const { calls } = fakeApi({
      "GET /wallets": () => (first ? ((first = false), signedOut) : { body: { ok: true } }),
      "POST /auth/refresh": { body: session("a@example.com", "new-token") },
    });

    await expect(api("/wallets")).resolves.toEqual({ ok: true });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /wallets", "POST /auth/refresh", "GET /wallets"]);
    expect(calls[2]?.authorization).toBe("Bearer new-token");
  });

  it("shares one refresh between calls that fail together", async () => {
    const seen = new Set<string>();
    const { calls } = fakeApi({
      "GET /a": (c) => (c.authorization === "Bearer new-token" ? { body: {} } : (seen.add("a"), signedOut)),
      "GET /b": (c) => (c.authorization === "Bearer new-token" ? { body: {} } : (seen.add("b"), signedOut)),
      "POST /auth/refresh": { body: session("a@example.com", "new-token") },
    });

    await Promise.all([api("/a"), api("/b")]);
    expect(calls.filter((c) => c.path === "/auth/refresh")).toHaveLength(1);
  });

  it("tells the app when the session cannot be renewed", async () => {
    fakeApi({ "GET /wallets": signedOut, "POST /auth/refresh": signedOut });
    const listener = vi.fn();
    const stop = onSignedOut(listener);

    await expect(api("/wallets")).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledOnce();
    stop();
  });

  it("turns a validation problem into field messages", async () => {
    fakeApi({
      "POST /transactions": {
        status: 400,
        body: { title: "One or more validation errors occurred.", errors: { amount: ["Enter an amount above zero."] } },
      },
    });

    const error = (await api("/transactions", { method: "POST", body: {} }).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.field("amount")).toBe("Enter an amount above zero.");
    expect(error.message).toBe("Enter an amount above zero.");
  });

  it("explains a network failure in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(api("/wallets")).rejects.toThrow(/internet connection/);
  });
});

describe("api client timeouts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** Makes the timeout fire at once and the network call fail the way fetch does when aborted. */
  function timeOut() {
    const controller = new AbortController();
    controller.abort();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    vi.stubGlobal("fetch", () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError")));
  }

  it("says a slow read should be tried again", async () => {
    timeOut();
    const error = await api("/wallets").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("timeout");
    expect((error as ApiError).message).toBe("TakaLeaf took too long to answer. Check your connection and try again.");
  });

  it("warns that a slow save may already have saved", async () => {
    timeOut();
    const error = await api("/transactions", { method: "POST", body: {} }).catch((e: unknown) => e);
    expect((error as ApiError).message).toMatch(/may or may not have saved\. Check before trying again\./);
  });
});

describe("api client when the session cannot be checked", () => {
  beforeEach(() => setSession(session("a@example.com", "old-token")));
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("keeps the person signed in when the refresh is rate limited", async () => {
    fakeApi({ "GET /wallets": signedOut, "POST /auth/refresh": { status: 429 } });
    const listener = vi.fn();
    const stop = onSignedOut(listener);
    const error = await api("/wallets").catch((e: unknown) => e);
    stop();
    expect((error as ApiError).message).toBe("Too many requests from this network right now. Wait a minute, then try again.");
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps the person signed in when the server fails", async () => {
    fakeApi({ "GET /wallets": signedOut, "POST /auth/refresh": { status: 503 } });
    const listener = vi.fn();
    const stop = onSignedOut(listener);
    const error = await api("/wallets").catch((e: unknown) => e);
    stop();
    expect((error as ApiError).message).toBe("TakaLeaf could not check your session just now. Try again in a moment.");
    expect(listener).not.toHaveBeenCalled();
  });
});
