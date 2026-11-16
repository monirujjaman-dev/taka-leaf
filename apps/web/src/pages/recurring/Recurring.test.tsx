import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../../api/client";
import { emptyDashboard, fakeApi, session, wallet } from "../../test/fakeApi";
import { renderApp } from "../../test/render";
import { localDate, localMonth } from "../../ui/format";

const wallets = { wallets: [wallet({ id: "w-bank", type: "Bank", name: "City Bank" })], totals: { assets: 0, liabilities: 0, net: 0 } };
const today = localDate();
const rent = {
  id: "r1", type: "Expense", amount: 1800000, fromWalletId: "w-bank", fromWalletName: "City Bank", toWalletId: null, toWalletName: null,
  categoryId: null, categoryName: "House rent", note: "Rent", frequency: "Monthly", interval: 1, startDate: today, endDate: null,
  nextDate: today, dueCount: 1, autoRecord: false, paused: false,
};

describe("recurring", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("saves a monthly rule that records itself", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /recurring": { body: [] },
      "GET /wallets": { body: wallets },
      "GET /categories": { body: [] },
      "POST /recurring": { status: 201, body: rent },
    });
    renderApp("/recurring");

    await userEvent.click((await screen.findAllByRole("button", { name: "Add recurring" }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Add recurring" });
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "18000");
    await userEvent.selectOptions(within(dialog).getByLabelText("Paid from"), "w-bank");
    await userEvent.type(within(dialog).getByLabelText("Note (optional)"), "Rent");
    await userEvent.click(within(dialog).getByLabelText(/Record it automatically/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await vi.waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/recurring")).toBe(true));
    expect(calls.find((c) => c.method === "POST" && c.path === "/recurring")?.body).toEqual({
      type: "Expense", amount: 1800000, fromWalletId: "w-bank", toWalletId: null, categoryId: null, note: "Rent",
      frequency: "Monthly", interval: 1, startDate: today, endDate: null, autoRecord: true,
    });
  });

  it("records a due date from the dashboard with a changed amount", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /dashboard": { body: emptyDashboard(localMonth()) },
      "GET /wallets": { body: wallets },
      "GET /recurring/due": { body: [rent] },
      "GET /budgets": { body: { month: localMonth(), budgets: [] } },
      "POST /recurring/r1/record": { status: 201, body: {} },
    });
    renderApp("/");

    const card = await screen.findByRole("region", { name: "Due to record" });
    await userEvent.click(within(card).getByRole("button", { name: "Record" }));
    const dialog = await screen.findByRole("dialog", { name: "Record Rent" });
    const amount = within(dialog).getByLabelText("Amount (৳)");
    await userEvent.clear(amount);
    await userEvent.type(amount, "18,500");
    await userEvent.click(within(dialog).getByRole("button", { name: "Record" }));

    await vi.waitFor(() => expect(calls.some((c) => c.path === "/recurring/r1/record")).toBe(true));
    expect(calls.find((c) => c.path === "/recurring/r1/record")?.body).toEqual({ amount: 1850000 });
  });

  it("shows a budget that is over its limit", async () => {
    fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /budgets": {
        body: { month: localMonth(), budgets: [{ id: "b1", categoryId: "c1", name: "Food and dining", amount: 500000, spent: 620000, remaining: -120000, percent: 124, status: "Over" }] },
      },
    });
    renderApp("/budgets");

    expect(await screen.findByText("Over by ৳1,200.00 · 124%")).toBeInTheDocument();
    const total = screen.getByRole("region", { name: "Monthly budget" });
    expect(total).toHaveTextContent("৳6,200.00 of ৳5,000.00");
    expect(total).toHaveTextContent("৳1,200.00 over");
  });
});
