import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../../api/client";
import { fakeApi, session, signedOut } from "../../test/fakeApi";
import { renderApp } from "../../test/render";

const now = new Date().toISOString();

describe("settings and account", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("lists devices and signs another one out", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /auth/sessions": {
        body: [
          { id: "s1", device: "Chrome on Windows", signedInAt: now, lastUsedAt: now, current: true },
          { id: "s2", device: "Chrome on Android", signedInAt: now, lastUsedAt: now, current: false },
        ],
      },
      "DELETE /auth/sessions/s2": { status: 204 },
    });
    renderApp("/settings");

    const devices = await screen.findByRole("region", { name: "Signed-in devices" });
    expect(await within(devices).findByText("This device")).toBeInTheDocument();
    const phone = within(devices).getByText("Chrome on Android").closest("li")!;
    await userEvent.click(within(phone).getByRole("button", { name: "Sign out" }));

    await vi.waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.path === "/auth/sessions/s2")).toBe(true));
  });

  it("explains when registration is closed", async () => {
    fakeApi({
      "POST /auth/refresh": signedOut,
      "POST /auth/register": { status: 403, body: { title: "New accounts are closed on this TakaLeaf.", code: "registration_closed" } },
    });
    renderApp("/register");

    await userEvent.type(await screen.findByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "green-leaf-2026");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("New accounts are closed on this TakaLeaf.");
  });

  it("exports the transactions matching the filters", async () => {
    const created = vi.fn(() => "blob:csv");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /transactions": { body: { items: [], totalCount: 0, page: 1, pageSize: 50, totals: { income: 0, expense: 0 } } },
      "GET /wallets": { body: { wallets: [], totals: { assets: 0, liabilities: 0, net: 0 } } },
      "GET /categories": { body: [] },
      "GET /transactions/export.csv": { body: "Date" },
    });
    renderApp("/transactions?from=2026-11-01&to=2026-11-30&type=Expense");

    await userEvent.click(await screen.findByRole("button", { name: "Export CSV" }));

    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    const exported = calls.find((c) => c.path.startsWith("/transactions/export.csv"))!;
    expect(exported.path).toBe("/transactions/export.csv?from=2026-11-01&to=2026-11-30&type=Expense");
    expect(exported.authorization).toBe("Bearer access-1");
    click.mockRestore();
  });
});
