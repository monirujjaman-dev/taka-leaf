import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../../api/client";
import type { Saving, SavingDetail, SavingList } from "../../api/types";
import { fakeApi, session, wallet } from "../../test/fakeApi";
import { renderApp } from "../../test/render";

const wallets = {
  wallets: [wallet({ id: "w-bank", type: "Bank", name: "City Bank account" }), wallet({ id: "w-fdr", type: "Savings", name: "City Bank FDR" })],
  totals: { assets: 0, liabilities: 0, net: 0 },
};

const base: Saving = {
  id: "s1", kind: "Fdr", name: "City Bank FDR", provider: "City Bank", walletId: "w-fdr", payFromWalletId: "w-bank", payFromWalletName: "City Bank account",
  amount: 50_000_000, ratePoints: 975, months: 12, everyMonths: 0, startDate: "2099-03-12", taxPoints: 1000, chargesPerYear: 300_000, maturityAmount: null,
  cover: null, policy: null, policyNumber: null, insured: null, nominee: null, bondNumbers: [], paidBefore: 0, autoRecord: true, remind: false, renew: true,
  missed: [], closedOn: null, balance: 50_000_000, closed: false, maturesOn: "2100-03-12", done: 0, total: 1,
  next: { number: 1, date: "2100-03-12", label: "Renews", amount: 54_087_500, action: "Auto", overdue: false },
  profitReceived: 0, taxTaken: 0, paidSoFar: 0, estimate: 54_087_500, daysDone: 251, daysTotal: 365, bondCount: 0, bondsInDraw: 0, nextDraw: null, graceEnds: null,
};

const dps: Saving = {
  ...base, id: "d1", kind: "Dps", name: "BRAC Bank DPS", provider: "BRAC Bank", walletId: "w-dps", amount: 500_000, ratePoints: 900, months: 60, everyMonths: 1,
  startDate: "2098-02-10", chargesPerYear: 0, autoRecord: false, renew: false, balance: 11_000_000, maturesOn: "2103-01-10", done: 22, total: 60, estimate: 37_994_908,
  next: { number: 23, date: "2099-12-10", label: "Instalment 23", amount: 500_000, action: "Record", overdue: false }, daysDone: 0, daysTotal: 0,
};

const bonds: Saving = {
  ...base, id: "b1", kind: "PrizeBond", name: "Prize bonds", provider: null, walletId: "w-bonds", amount: 300_000, ratePoints: 0, months: 0, taxPoints: 2000, chargesPerYear: 0,
  renew: false, balance: 300_000, maturesOn: null, total: null, estimate: null, bondNumbers: ["কখ 0412301", "কখ 0412302"], bondCount: 30, bondsInDraw: 30,
  nextDraw: "2100-01-31", next: { number: null, date: "2100-01-31", label: "Prize bond draw", amount: null, action: "Draw", overdue: false }, daysDone: 0, daysTotal: 0,
};

const life: Saving = {
  ...base, id: "p1", kind: "Insurance", name: "Life policy", provider: "Guardian Life", walletId: null, amount: 4_850_000, ratePoints: 0, months: 180, everyMonths: 12,
  startDate: "2093-01-05", taxPoints: 0, chargesPerYear: 0, cover: 100_000_000, policy: "Life", policyNumber: "GL-2021-458 310", nominee: "Ayesha Rahim", paidBefore: 6,
  remind: true, renew: false, balance: 0, maturesOn: "2108-01-05", done: 6, total: 15, paidSoFar: 29_100_000, estimate: null, graceEnds: "2099-02-04",
  next: { number: 7, date: "2099-01-05", label: "Premium 7", amount: 4_850_000, action: "Pay", overdue: false }, daysDone: 0, daysTotal: 0,
};

const list: SavingList = {
  summary: { saved: 61_300_000, deposits: 61_000_000, certificates: 0, prizeBonds: 300_000, cover: 100_000_000, policies: 1, taxYear: { from: "2099-07-01", to: "2100-06-30", invested: 2_500_000, profit: 3_760_000, tax: 338_000 }, nextToMature: "City Bank FDR", nextToMatureOn: "2100-03-12" },
  comingUp: [{ savingId: "d1", kind: "Dps", policy: null, name: "BRAC Bank DPS", date: "2099-12-10", label: "Instalment 23", detail: "From City Bank account", amount: 500_000, action: "Record", overdue: false }],
  savings: [dps, base, bonds, life],
};

const detail = (saving: Saving, schedule: SavingDetail["schedule"] = []): SavingDetail => ({ saving, schedule, activity: [] });

describe("savings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("shows what is saved, what comes next and each saving's progress", async () => {
    fakeApi({ "POST /auth/refresh": { body: session() }, "GET /savings": { body: list }, "GET /wallets": { body: wallets } });
    renderApp("/savings");

    const hero = await screen.findByRole("region", { name: "Saved and invested" });
    expect(hero).toHaveTextContent("৳6,13,000.00");
    expect(hero).toHaveTextContent("Prize bonds৳3,000");
    expect(screen.getAllByRole("link", { name: /BRAC Bank DPS.*৳5,000 a month · 9% · 5 years/ })[0]).toHaveTextContent("22 of 60 instalments");
    expect(screen.getAllByRole("link", { name: /City Bank FDR/ })[0]).toHaveTextContent("251 of 365 days");
    expect(screen.getAllByRole("link", { name: /Life policy/ })[0]).toBeInTheDocument();
  });

  it("adds an FDR with what it pays at maturity worked out", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /savings": { body: { ...list, savings: [] } },
      "GET /wallets": { body: wallets },
      "POST /savings": { status: 201, body: base },
      "GET /savings/s1": { body: detail(base) },
    });
    renderApp("/savings?add=1");

    const dialog = await screen.findByRole("dialog", { name: "Add savings" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "City Bank FDR");
    await userEvent.type(within(dialog).getByLabelText("Bank"), "City Bank");
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "500000");
    await userEvent.type(within(dialog).getByLabelText("Profit rate (% a year)"), "9.75");
    await userEvent.type(within(dialog).getByLabelText("Excise duty a year (optional, ৳)"), "3000");
    const opened = within(dialog).getByLabelText("Opened on");
    await userEvent.clear(opened);
    await userEvent.type(opened, "2026-03-12");
    expect(within(dialog).getByText("৳5,40,875.00")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save FDR" }));

    await vi.waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/savings")).toBe(true));
    expect(calls.find((c) => c.method === "POST" && c.path === "/savings")?.body).toMatchObject({
      kind: "Fdr", name: "City Bank FDR", provider: "City Bank", payFromWalletId: "w-bank", fromWalletId: "w-bank", alreadyHeld: false, amount: 50_000_000,
      ratePoints: 975, months: 12, everyMonths: 0, startDate: "2026-03-12", taxPoints: 1000, chargesPerYear: 300_000, renew: true,
    });
  });

  it("records a DPS instalment or marks it missed", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /savings/d1": { body: detail(dps, [{ number: 22, date: "2099-11-10", status: "Paid", amount: 500_000, tax: 0, paidAt: null, paidFrom: null }, { number: 23, date: "2099-12-10", status: "Due", amount: 500_000, tax: 0, paidAt: null, paidFrom: null }]) },
      "GET /wallets": { body: wallets },
      "POST /savings/d1/deposit": { body: dps },
      "POST /savings/d1/skip": { body: dps },
    });
    renderApp("/savings/d1");

    expect(await screen.findByRole("img", { name: "1 of 2 instalments paid; instalment 23 is next" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Record now" }));
    await userEvent.click(screen.getByRole("button", { name: "Missed it" }));

    await vi.waitFor(() => expect(calls.some((c) => c.path === "/savings/d1/skip")).toBe(true));
    expect(calls.some((c) => c.path === "/savings/d1/deposit")).toBe(true);
  });

  it("records a prize bond win with the tax taken", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /savings/b1": { body: detail(bonds) },
      "GET /wallets": { body: wallets },
      "POST /savings/b1/prize": { body: bonds },
    });
    renderApp("/savings/b1");

    await userEvent.click(await screen.findByRole("button", { name: "I won a prize" }));
    const dialog = await screen.findByRole("dialog", { name: "I won a prize" });
    await userEvent.click(within(dialog).getByRole("radio", { name: "5th" }));
    await userEvent.selectOptions(within(dialog).getByLabelText("Winning bond"), "কখ 0412302");
    expect(within(dialog).getByText("৳8,000.00")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Record prize" }));

    await vi.waitFor(() => expect(calls.some((c) => c.path === "/savings/b1/prize")).toBe(true));
    expect(calls.find((c) => c.path === "/savings/b1/prize")?.body).toMatchObject({ prize: 1_000_000, taxPoints: 2000, bond: "কখ 0412302", walletId: "w-bank" });
  });

  it("pays a premium and keeps saving wallets out of the pickers", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /savings/p1": { body: detail(life) },
      "GET /wallets": { body: wallets },
      "POST /savings/p1/premium": { body: life },
    });
    renderApp("/savings/p1");

    expect(await screen.findByText(/grace period to 4 Feb 2099/)).toBeInTheDocument();
    await screen.findByRole("option", { name: "City Bank account" });
    const options = within(screen.getByLabelText("Pay from")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["City Bank account"]);
    await userEvent.click(screen.getByRole("button", { name: "Pay premium" }));

    await vi.waitFor(() => expect(calls.some((c) => c.path === "/savings/p1/premium")).toBe(true));
    expect(calls.find((c) => c.path === "/savings/p1/premium")?.body).toEqual({ walletId: "w-bank" });
  });
});
