import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../../api/client";
import type { BankLoan, BankLoanDetail, BankLoanList } from "../../api/types";
import { fakeApi, session, wallet } from "../../test/fakeApi";
import { renderApp } from "../../test/render";

const wallets = {
  wallets: [wallet({ id: "w-bank", type: "Bank", name: "City Bank account" }), wallet({ id: "w-card", type: "CreditCard", name: "BRAC Bank Visa" }), wallet({ id: "w-loan", type: "Loan", name: "Home loan" })],
  totals: { assets: 0, liabilities: 0, net: 0 },
};

const home: BankLoan = {
  id: "l1", type: "Bank", name: "Home loan", lender: "City Bank", walletId: "w-loan", payFromWalletId: "w-bank", payFromWalletName: "City Bank account",
  principal: 120_000_000, ratePoints: 950, months: 60, emi: 2_520_223, firstDueDate: "2025-06-05", paidBefore: 18, autoRecord: false, closedOn: null,
  outstanding: 89_751_312, paid: 18, left: 42, closed: false,
  next: { number: 19, dueDate: "2099-12-05", principal: 1_809_692, interest: 710_531, total: 2_520_223, overdue: false },
  endsOn: "2100-05-05", interestPaid: 15_115_326, interestLeft: 16_098_081,
};

const list: BankLoanList = {
  summary: { outstanding: 89_751_312, bank: 89_751_312, cardEmi: 0, upcoming: [{ loanId: "l1", name: "Home loan", type: "Bank", number: 19, dueDate: "2099-12-05", total: 2_520_223, payFromWalletName: "City Bank account", overdue: false }] },
  loans: [home],
};

const detail: BankLoanDetail = {
  loan: home,
  schedule: [
    { number: 20, dueDate: "2100-01-05", status: "Upcoming", principal: 1_823_018, interest: 697_205, total: 2_520_223, balanceAfter: 86_118_602, paidAt: null, paidFrom: null },
    { number: 19, dueDate: "2099-12-05", status: "Due", principal: 1_809_692, interest: 710_531, total: 2_520_223, balanceAfter: 87_941_620, paidAt: null, paidFrom: null },
  ],
  activity: [],
  card: null,
};

describe("loans", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("shows what is left on each loan and the next EMI", async () => {
    fakeApi({ "POST /auth/refresh": { body: session() }, "GET /loans": { body: list }, "GET /wallets": { body: wallets } });
    renderApp("/loans");

    const hero = await screen.findByRole("region", { name: "Left to pay on loans" });
    expect(hero).toHaveTextContent("৳8,97,513.12");
    expect(screen.getByRole("link", { name: /Home loan.*City Bank · 9.5% · EMI ৳25,202.23/ })).toHaveTextContent("18 of 60 EMIs paid · 25% repaid");
  });

  it("adds a bank loan already running, with the worked-out EMI", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /loans": { body: { summary: { outstanding: 0, bank: 0, cardEmi: 0, upcoming: [] }, loans: [] } },
      "GET /wallets": { body: wallets },
      "GET /categories": { body: [] },
      "POST /loans": { status: 201, body: home },
      "GET /loans/l1": { body: detail },
    });
    renderApp("/loans?add=1");

    const dialog = await screen.findByRole("dialog", { name: "Add a loan" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Home loan");
    await userEvent.type(within(dialog).getByLabelText("Loan amount (৳)"), "1200000");
    await userEvent.type(within(dialog).getByLabelText("Interest rate (% a year)"), "9.5");
    await userEvent.click(within(dialog).getByRole("radio", { name: "60" }));
    const first = within(dialog).getByLabelText("First EMI date");
    await userEvent.clear(first);
    await userEvent.type(first, "2025-06-05");
    expect(within(dialog).getByText("৳25,202.23")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("switch", { name: /I'm already paying this loan/ }));
    await userEvent.type(within(dialog).getByLabelText("EMIs already paid"), "18");
    expect(within(dialog).getByText(/Left to pay today: ৳8,97,513.12/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save loan" }));

    await vi.waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/loans")).toBe(true));
    expect(calls.find((c) => c.method === "POST" && c.path === "/loans")?.body).toEqual({
      type: "Bank", name: "Home loan", lender: "City Bank", payFromWalletId: "w-bank", principal: 120_000_000, ratePoints: 950, months: 60, emi: null,
      firstDueDate: "2025-06-05", paidBefore: 18, autoRecord: false, receivedInWalletId: null, processingFee: null, purchaseCategoryId: null,
    });
  });

  it("pays an EMI with a late fee", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /loans/l1": { body: detail },
      "GET /wallets": { body: wallets },
      "POST /loans/l1/pay": { body: home },
    });
    renderApp("/loans/l1");

    await userEvent.click(await screen.findByRole("button", { name: "Pay EMI" }));
    const dialog = await screen.findByRole("dialog", { name: "Pay EMI 19 · Dec 2099" });
    expect(within(dialog).getByText("৳18,096.92")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Late fee or charges (optional, ৳)"), "500");
    await userEvent.click(within(dialog).getByRole("button", { name: "Record payment" }));

    await vi.waitFor(() => expect(calls.some((c) => c.path === "/loans/l1/pay")).toBe(true));
    expect(calls.find((c) => c.path === "/loans/l1/pay")?.body).toMatchObject({ walletId: "w-bank", amount: null, lateFee: 50_000 });
  });

  it("settles a loan early with a charge on what is left", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /loans/l1": { body: detail },
      "GET /wallets": { body: wallets },
      "POST /loans/l1/settle": { body: { ...home, closed: true, outstanding: 0, next: null } },
    });
    renderApp("/loans/l1");

    await userEvent.click(await screen.findByRole("button", { name: "Close the loan early" }));
    const dialog = await screen.findByRole("dialog", { name: "Settle Home loan early" });
    await userEvent.type(within(dialog).getByLabelText("Settlement charge (%)"), "2");
    // 2 % of ৳8,97,513.12
    expect(within(dialog).getByText("৳17,950.26")).toBeInTheDocument();
    expect(within(dialog).getByText("৳9,15,463.38")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Settle the loan" }));

    await vi.waitFor(() => expect(calls.some((c) => c.path === "/loans/l1/settle")).toBe(true));
    expect(calls.find((c) => c.path === "/loans/l1/settle")?.body).toMatchObject({ walletId: "w-bank", chargePoints: 200, charge: null });
  });

  it("keeps loan wallets out of the wallet pickers", async () => {
    fakeApi({ "POST /auth/refresh": { body: session() }, "GET /loans/l1": { body: detail }, "GET /wallets": { body: wallets } });
    renderApp("/loans/l1");

    await userEvent.click(await screen.findByRole("button", { name: "Pay extra" }));
    const dialog = await screen.findByRole("dialog", { name: "Pay extra · Home loan" });
    const options = within(within(dialog).getByLabelText("Paid from")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["City Bank account", "BRAC Bank Visa"]);
  });
});
