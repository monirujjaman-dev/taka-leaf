import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../../api/client";
import { fakeApi, session, wallet } from "../../test/fakeApi";
import { renderApp } from "../../test/render";

const rafi = { id: "p1", name: "Rafi", note: null, owesMe: 300000, iOwe: 0, net: 300000, lastLoanAt: null };
const wallets = { wallets: [wallet({ id: "w-cash", name: "Cash" }), wallet({ id: "w-lent", name: "Lent to Rafi", type: "Lent", personId: "p1" })], totals: { assets: 0, liabilities: 0, net: 0 } };

describe("a person's page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("records a repayment and offers the whole amount owed", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /people/p1": { body: { person: rafi, loans: [] } },
      "GET /wallets": { body: wallets },
      "POST /people/p1/loans": { status: 201, body: {} },
    });
    renderApp("/people/p1");

    expect(await screen.findByText("Owes you")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay back" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Got paid back" }));
    const dialog = await screen.findByRole("dialog", { name: "Rafi paid back" });
    await userEvent.click(within(dialog).getByRole("button", { name: /All of it/ }));
    expect(within(within(dialog).getByLabelText("Received in")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose a wallet", "Cash"]);
    await userEvent.selectOptions(within(dialog).getByLabelText("Received in"), "w-cash");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await vi.waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/people/p1/loans")).toBe(true));
    expect(calls.find((c) => c.method === "POST" && c.path === "/people/p1/loans")?.body).toMatchObject({
      kind: "GotBack",
      amount: 300000,
      walletId: "w-cash",
    });
  });

  it("opens a loan from the history on its person's page", async () => {
    fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /transactions": {
        body: {
          items: [{ id: "t1", type: "Transfer", amount: 500000, fromWalletId: "w-cash", fromWalletName: "Cash", toWalletId: "w-lent", toWalletName: "Lent to Rafi", categoryId: null, categoryName: null, personId: "p1", feeOfId: null, fee: null, occurredAt: new Date().toISOString(), note: null }],
          totalCount: 1, page: 1, pageSize: 50, totals: { income: 0, expense: 0 },
        },
      },
      "GET /wallets": { body: wallets },
      "GET /categories": { body: [] },
      "GET /people/p1": { body: { person: rafi, loans: [] } },
    });
    renderApp("/transactions");

    await userEvent.click(await screen.findByRole("button", { name: /Lent to Rafi/ }));
    expect(await screen.findByRole("heading", { name: "Rafi" })).toBeInTheDocument();
  });
});
