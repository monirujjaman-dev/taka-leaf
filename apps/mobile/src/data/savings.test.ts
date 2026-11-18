import { outbox } from "../db/schema";
import type { AppDb } from "../db/types";
import { pullAll } from "../sync/engine";
import { openTestDb } from "../test/db";
import { saveCategory } from "./categories";
import {
  addBonds, addSaving, closeSaving, deleteSaving, dueSavings, listSavings, payInstalment, payPremium, recordPayout, recordPrize, recordProfit, savingDetail,
  sellBonds, skipInstalment, summarizeSavings, taxYear, undoLast, updateSaving, type AddSavingInput,
} from "./savings";
import { history, saveTransaction } from "./transactions";
import { listWallets, ownWallets, saveWallet } from "./wallets";

let db: AppDb;
let close: () => void;
const now = new Date("2026-11-17T06:00:00.000Z");
const today = "2026-11-17";

beforeEach(async () => {
  ({ db, close } = await openTestDb());
});
afterEach(() => close());

const bank = () => saveWallet(db, { type: "Bank", name: "City Bank account", openingBalance: 100_000_000, creditLimit: null, excludedFromTotal: false }, now);
const balanceOf = (id: string) => listWallets(db).find((w) => w.id === id)!.balance;
const input = (overrides: Partial<AddSavingInput>): AddSavingInput => ({
  kind: "Fdr", name: "City Bank FDR", provider: "City Bank", payFromWalletId: null, alreadyHeld: false, amount: 50_000_000, bondCount: 0, ratePoints: 975,
  months: 12, everyMonths: 0, startDate: "2026-03-12", taxPoints: null, chargesPerYear: 300_000, maturityAmount: null, cover: null, policy: null,
  policyNumber: null, insured: null, nominee: null, bondNumbers: [], paidBefore: 0, autoRecord: false, remind: true, renew: true, ...overrides,
});

describe("FDR", () => {
  it("moves the money in and shows what it pays at maturity", () => {
    const account = bank();
    const id = addSaving(db, input({ payFromWalletId: account }), now);

    const [fdr] = listSavings(db, today);
    expect(fdr).toMatchObject({ id, balance: 50_000_000, estimate: 54_087_500, maturesOn: "2027-03-12", daysDone: 250, daysTotal: 365, taxPoints: 1000, next: { label: "Renews", action: "Auto" } });
    expect(balanceOf(account)).toBe(50_000_000);
    expect(ownWallets(db).map((w) => w.name)).toEqual(["City Bank account"]);
    expect(summarizeSavings(listSavings(db, today))).toMatchObject({ saved: 50_000_000, deposits: 50_000_000 });
    const opened = history(db).items[0]!;
    expect(() => saveTransaction(db, { ...opened, fee: 0 }, now)).toThrow("Change it from Savings");
  });

  it("encashes early with a charge for what is short", () => {
    const account = bank();
    const id = addSaving(db, input({ payFromWalletId: account }), now);

    closeSaving(db, id, { received: 49_500_000, tax: null, occurredAt: now.toISOString() }, now);

    expect(listSavings(db, today)[0]).toMatchObject({ closed: true, balance: 0 });
    expect(balanceOf(account)).toBe(100_000_000 - 500_000);
    expect(history(db).items.find((t) => t.note === "Early encashment charge")?.amount).toBe(500_000);
  });
});

describe("DPS", () => {
  it("takes instalments, marks missed ones and undoes the last", () => {
    const account = bank();
    const id = addSaving(db, input({ kind: "Dps", name: "BRAC Bank DPS", payFromWalletId: account, amount: 500_000, ratePoints: 900, months: 60, startDate: today }), now);
    expect(listSavings(db, today)[0]).toMatchObject({ estimate: 37_994_908, taxPoints: 1000, next: { number: 1, action: "Record" } });

    payInstalment(db, id, { occurredAt: now.toISOString() }, now);
    skipInstalment(db, id, now);

    const detail = savingDetail(db, id, today)!;
    expect(detail.saving).toMatchObject({ balance: 500_000, done: 1, missedList: [2], next: { number: 3 }, estimate: 37_212_067 });
    expect(detail.schedule.slice(0, 4).map((r) => r.status)).toEqual(["Paid", "Missed", "Due", "Upcoming"]);
    expect(dueSavings(db, today).map((s) => s.name)).toEqual([]);

    undoLast(db, id, now);
    expect(listSavings(db, today)[0]!.balance).toBe(0);
    expect(balanceOf(account)).toBe(100_000_000);
  });

  it("starts a running DPS from what was paid in", () => {
    const account = bank();
    addSaving(db, input({ kind: "Dps", name: "DPS", payFromWalletId: account, amount: 500_000, ratePoints: 900, months: 60, startDate: "2025-02-10", alreadyHeld: true, paidBefore: 21 }), now);

    expect(listSavings(db, today)[0]).toMatchObject({ balance: 10_500_000, done: 21, next: { number: 22, date: "2026-11-10", overdue: true } });
    expect(dueSavings(db, today).map((s) => s.name)).toEqual(["DPS"]);
  });
});

describe("Sanchayapatra", () => {
  it("pays profit after 5 % tax, with the categories it has", () => {
    const account = bank();
    const other = saveCategory(db, { kind: "Income", name: "Other income", parentId: null }, now);
    const profitCategory = saveCategory(db, { kind: "Income", name: "Profit on savings", parentId: other }, now);
    const id = addSaving(db, input({ kind: "Certificate", name: "3-month profit Sanchayapatra", payFromWalletId: account, alreadyHeld: true, ratePoints: 1104, months: 36, everyMonths: 3, startDate: "2026-05-17", paidBefore: 1 }), now);
    expect(listSavings(db, today)[0]).toMatchObject({ taxPoints: 500, next: { number: 2, label: "Profit 2", amount: 1_311_000, action: "Record" } });

    recordProfit(db, id, { profit: null, tax: null, occurredAt: now.toISOString() }, now);

    expect(balanceOf(account)).toBe(100_000_000 + 1_311_000);
    expect(history(db).items.find((t) => t.savingPart === "Profit")?.categoryId).toBe(profitCategory);
    expect(history(db).items.find((t) => t.savingPart === "Tax")?.categoryId).toBeNull();
    expect(taxYear(db, today)).toMatchObject({ from: "2026-07-01", profit: 1_380_000, tax: 69_000 });
  });
});

describe("prize bonds", () => {
  it("wins with tax, adds and sells back", () => {
    const account = bank();
    const id = addSaving(db, input({ kind: "PrizeBond", name: "Prize bonds", payFromWalletId: account, bondCount: 30, startDate: "2026-09-01", bondNumbers: ["কখ 0412301"] }), now);
    expect(listSavings(db, today)[0]).toMatchObject({ bondCount: 30, bondsInDraw: 30, nextDraw: "2027-01-31", taxPoints: 2000 });

    recordPrize(db, id, { prize: 1_000_000, taxPoints: null, bond: "কখ 0412301", occurredAt: now.toISOString() }, now);
    addBonds(db, id, { bondCount: 5, bondNumbers: ["খগ 0736110"], occurredAt: "2026-12-10T04:00:00.000Z" }, now);

    expect(listSavings(db, "2026-12-10")[0]).toMatchObject({ bondCount: 35, bondsInDraw: 30, profitReceived: 1_000_000, taxTaken: 200_000, bondList: ["কখ 0412301", "খগ 0736110"] });
    sellBonds(db, id, { bondCount: 35, occurredAt: now.toISOString() }, now);
    expect(listSavings(db, today)[0]!.closed).toBe(true);
    expect(balanceOf(account)).toBe(100_000_000 + 800_000);
  });
});

describe("insurance", () => {
  it("pays premiums and records payouts", () => {
    const account = bank();
    const id = addSaving(db, input({ kind: "Insurance", name: "Life policy", payFromWalletId: account, amount: 4_850_000, months: 180, everyMonths: 12, startDate: "2020-11-20", paidBefore: 6, policy: "Life", cover: 100_000_000 }), now);
    expect(listSavings(db, today)[0]).toMatchObject({ walletId: null, total: 15, next: { number: 7, date: "2026-11-20", action: "Pay" }, graceEnds: "2026-12-20" });
    expect(dueSavings(db, today).map((s) => s.name)).toEqual(["Life policy"]);

    payPremium(db, id, { occurredAt: now.toISOString() }, now);
    updateSaving(db, id, { name: "Life policy", provider: "Guardian Life", payFromWalletId: account, amount: null, ratePoints: null, taxPoints: null, chargesPerYear: null, maturityAmount: null, cover: 100_000_000, policy: "Life", policyNumber: "GL-1", insured: null, nominee: "Ayesha", bondNumbers: null, autoRecord: null, remind: false, renew: null }, now);
    recordPayout(db, id, { amount: 150_000_000, kind: "Maturity", occurredAt: now.toISOString() }, now);

    expect(listSavings(db, today)[0]).toMatchObject({ closed: true, done: 7, paidSoFar: 7 * 4_850_000, provider: "Guardian Life", remind: false });
    expect(balanceOf(account)).toBe(100_000_000 - 4_850_000 + 150_000_000);
  });

  it("needs a kind of policy", () => {
    const account = bank();
    expect(() => addSaving(db, input({ kind: "Insurance", payFromWalletId: account, amount: 100, everyMonths: 12, months: 0 }), now)).toThrow("Choose life, health, car or other.");
  });
});

describe("deleting and sync", () => {
  it("deletes the saving first, then its rows and wallet", () => {
    const account = bank();
    const id = addSaving(db, input({ payFromWalletId: account }), now);
    const before = db.select().from(outbox).all().length;

    deleteSaving(db, id, now);

    const sent = db.select().from(outbox).all().slice(before);
    expect(sent[0]!.tableName).toBe("savings");
    expect(sent.at(-1)!.tableName).toBe("wallets");
    expect(balanceOf(account)).toBe(100_000_000);
  });

  it("stores a saving pulled from the server", async () => {
    const wallet = { id: "w-s", type: "Savings", name: "EBL DPS", openingBalance: 1_000_000, creditLimit: null, personId: null, icon: null, color: null, archived: false, excludedFromTotal: false, sortOrder: 0, updatedAt: "2026-11-17T05:00:00+00:00", deletedAt: null };
    const saving = {
      id: "s-1", kind: "Dps", name: "EBL DPS", provider: "EBL", walletId: "w-s", payFromWalletId: "w-s", amount: 500_000, ratePoints: 900, months: 36, everyMonths: 1,
      startDate: "2026-10-10", taxPoints: 1000, chargesPerYear: 0, maturityAmount: null, cover: null, policy: null, policyNumber: null, insured: null, nominee: null,
      bondNumbers: null, paidBefore: 2, autoRecord: true, remind: false, renew: false, missed: null, seqBase: 0, closedOn: null, updatedAt: "2026-11-17T05:00:00+00:00", deletedAt: null,
    };
    await pullAll(db, { pull: async () => ({ cursor: 2, hasMore: false, wallets: [wallet], savings: [saving] }), push: async () => [] });

    expect(listSavings(db, today)[0]).toMatchObject({ id: "s-1", autoRecord: true, balance: 1_000_000, next: { number: 3, action: "Auto" } });
  });
});
