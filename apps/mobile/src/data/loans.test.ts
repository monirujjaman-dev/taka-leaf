import { outbox } from "../db/schema";
import type { AppDb } from "../db/types";
import { pullAll } from "../sync/engine";
import { openTestDb } from "../test/db";
import { saveCategory } from "./categories";
import { addLoan, deleteLoan, dueEmis, listLoans, loanDetail, payEmi, payExtra, settleLoan, settlementCharge, summarizeLoans, undoLastEmi, updateLoan, type AddLoanInput } from "./loans";
import { history, saveTransaction } from "./transactions";
import { listWallets, ownWallets, saveWallet, summarize } from "./wallets";

let db: AppDb;
let close: () => void;
const now = new Date("2026-11-17T06:00:00.000Z");
const today = "2026-11-17";

beforeEach(async () => {
  ({ db, close } = await openTestDb());
});
afterEach(() => close());

const bank = () => saveWallet(db, { type: "Bank", name: "City Bank account", openingBalance: 10_000_000, creditLimit: null, excludedFromTotal: false }, now);
const balanceOf = (id: string) => listWallets(db).find((w) => w.id === id)!.balance;
const home = (overrides: Partial<AddLoanInput> = {}): AddLoanInput => ({
  type: "Bank", name: "Home loan", lender: "City Bank", payFromWalletId: null, principal: 120_000_000, ratePoints: 950, months: 60, emi: null,
  firstDueDate: "2026-12-05", paidBefore: 0, autoRecord: false, receivedInWalletId: null, processingFee: 0, purchaseCategoryId: null, ...overrides,
});

describe("bank loans", () => {
  it("works out the EMI and adds the loan money to the wallet", () => {
    const wallet = bank();
    const id = addLoan(db, home({ payFromWalletId: wallet, receivedInWalletId: wallet, processingFee: 600_000 }), now);

    const [loan] = listLoans(db, today);
    expect(loan).toMatchObject({ id, emi: 2_520_223, outstanding: 120_000_000, left: 60, next: { number: 1, dueDate: "2026-12-05", principal: 1_570_223, interest: 950_000 } });
    expect(balanceOf(wallet)).toBe(10_000_000 + 120_000_000 - 600_000);
    expect(summarize(listWallets(db)).liabilities).toBe(120_000_000);
    expect(ownWallets(db).map((w) => w.name)).toEqual(["City Bank account"]);
  });

  it("starts a running loan from what is left today", () => {
    const wallet = bank();
    addLoan(db, home({ payFromWalletId: wallet, firstDueDate: "2025-06-05", paidBefore: 18 }), now);

    const [loan] = listLoans(db, today);
    expect(loan).toMatchObject({ outstanding: 89_751_312, paid: 18, left: 42, interestPaid: 15_115_326, next: { number: 19, dueDate: "2026-12-05", principal: 1_809_692, interest: 710_531 } });
  });

  it("pays an EMI as principal and interest, and can undo it", () => {
    const wallet = bank();
    const fees = saveCategory(db, { kind: "Expense", name: "Fees and charges", parentId: null }, now);
    const interest = saveCategory(db, { kind: "Expense", name: "Loan interest", parentId: fees }, now);
    const id = addLoan(db, home({ payFromWalletId: wallet }), now);

    payEmi(db, id, { walletId: wallet, amount: null, lateFee: 50_000, occurredAt: now.toISOString() }, now);

    const detail = loanDetail(db, id, today)!;
    expect(detail.loan).toMatchObject({ outstanding: 120_000_000 - 1_570_223, paid: 1, interestPaid: 950_000 });
    expect(detail.schedule.find((r) => r.number === 1)).toMatchObject({ status: "Paid", principal: 1_570_223, interest: 950_000, paidFrom: "City Bank account" });
    expect(detail.schedule.find((r) => r.number === 2)?.status).toBe("Due");
    expect(detail.activity.find((t) => t.loanPart === "Interest")?.categoryId).toBe(interest);
    expect(balanceOf(wallet)).toBe(10_000_000 - 2_520_223 - 50_000);
    expect(() => saveTransaction(db, { ...detail.activity[0]!, fee: 0 }, now)).toThrow("Change it from Loans");

    undoLastEmi(db, id, now);
    expect(listLoans(db, today)[0]!.paid).toBe(0);
    expect(balanceOf(wallet)).toBe(10_000_000);
  });

  it("keeps the interest fixed when a different amount is paid", () => {
    const wallet = bank();
    const id = addLoan(db, home({ payFromWalletId: wallet }), now);

    payEmi(db, id, { walletId: wallet, amount: 3_000_000, lateFee: 0, occurredAt: now.toISOString() }, now);

    expect(listLoans(db, today)[0]!.outstanding).toBe(120_000_000 - 2_050_000);
    expect(() => payEmi(db, id, { walletId: wallet, amount: 100, lateFee: 0, occurredAt: now.toISOString() }, now)).toThrow("more than this month's interest");
  });

  it("settles early with the bank's charge on what is left", () => {
    const wallet = bank();
    const id = addLoan(db, home({ payFromWalletId: wallet, receivedInWalletId: wallet }), now);
    payExtra(db, id, { walletId: wallet, amount: 20_000_000, occurredAt: now.toISOString() }, now);
    const charge = settlementCharge(100_000_000, 200);

    settleLoan(db, id, { walletId: wallet, charge, occurredAt: now.toISOString() }, now);

    expect(charge).toBe(2_000_000);
    const [loan] = listLoans(db, today);
    expect(loan).toMatchObject({ closed: true, closedOn: today, outstanding: 0, next: null });
    expect(balanceOf(wallet)).toBe(10_000_000 - 2_000_000);
    expect(history(db).items.find((t) => t.note === "Early settlement charge")?.amount).toBe(2_000_000);
    expect(summarizeLoans(listLoans(db, today)).outstanding).toBe(0);
  });

  it("lists bank EMIs due within a week for Home", () => {
    const wallet = bank();
    addLoan(db, home({ payFromWalletId: wallet, firstDueDate: "2026-11-20" }), now);
    addLoan(db, home({ name: "Car loan", payFromWalletId: wallet, firstDueDate: "2026-12-20" }), now);
    addLoan(db, home({ name: "Auto", payFromWalletId: wallet, firstDueDate: "2026-11-18", autoRecord: true }), now);

    expect(dueEmis(db, today).map((l) => l.name)).toEqual(["Home loan"]);
  });

  it("applies a new rate from the next EMI", () => {
    const wallet = bank();
    const id = addLoan(db, home({ payFromWalletId: wallet, firstDueDate: "2025-06-05", paidBefore: 18 }), now);

    updateLoan(db, id, { name: "Home loan", lender: "City Bank", payFromWalletId: wallet, ratePoints: 1050, emi: 2_600_000, autoRecord: false }, now);

    expect(listLoans(db, today)[0]!.next).toMatchObject({ interest: 785_324, total: 2_600_000 });
  });

  it("deletes the loan first, then its rows and wallet, so the server cascades", () => {
    const wallet = bank();
    const id = addLoan(db, home({ payFromWalletId: wallet, receivedInWalletId: wallet }), now);
    const before = db.select().from(outbox).all().length;

    deleteLoan(db, id, now);

    const sent = db.select().from(outbox).all().slice(before);
    expect(sent[0]!.tableName).toBe("loans");
    expect(sent.at(-1)!.tableName).toBe("wallets");
    expect(listLoans(db, today)).toEqual([]);
    expect(balanceOf(wallet)).toBe(10_000_000);
  });
});

describe("card EMIs", () => {
  it("records the purchase and holds what is left from the card's limit", () => {
    const card = saveWallet(db, { type: "CreditCard", name: "BRAC Bank Visa", openingBalance: -1_850_000, creditLimit: 20_000_000, excludedFromTotal: false }, now);
    const id = addLoan(db, { ...home(), type: "CardEmi", name: "Laptop EMI", lender: null, payFromWalletId: card, principal: 11_940_000, ratePoints: 0, months: 12 }, now);

    const detail = loanDetail(db, id, today)!;
    expect(detail.loan).toMatchObject({ emi: 995_000, autoRecord: true, outstanding: 11_940_000 });
    expect(detail.card).toMatchObject({ spent: 1_850_000, held: 11_940_000, available: 20_000_000 - 1_850_000 - 11_940_000 });
    expect(listWallets(db).find((w) => w.id === card)!.availableCredit).toBe(20_000_000 - 1_850_000 - 11_940_000);
    expect(history(db).items.find((t) => t.loanPart === "Purchase")?.amount).toBe(11_940_000);
  });

  it("needs a credit card", () => {
    const wallet = bank();
    expect(() => addLoan(db, { ...home(), type: "CardEmi", payFromWalletId: wallet, ratePoints: 0 }, now)).toThrow("Choose a credit card.");
  });
});

describe("sync", () => {
  it("stores a loan pulled from the server", async () => {
    const wallet = { id: "w-loan", type: "Loan", name: "Car loan", openingBalance: -50_000_000, creditLimit: null, personId: null, icon: null, color: null, archived: false, excludedFromTotal: false, sortOrder: 0, updatedAt: "2026-11-17T05:00:00+00:00", deletedAt: null };
    const loan = { id: "l-1", type: "Bank", name: "Car loan", lender: "EBL", walletId: "w-loan", payFromWalletId: "w-loan", principal: 50_000_000, ratePoints: 1000, months: 36, emi: 1_613_359, firstDueDate: "2026-12-10", paidBefore: 0, autoRecord: true, closedOn: null, updatedAt: "2026-11-17T05:00:00+00:00", deletedAt: null };
    await pullAll(db, { pull: async () => ({ cursor: 2, hasMore: false, wallets: [wallet], loans: [loan] }), push: async () => [] });

    expect(listLoans(db, today)[0]).toMatchObject({ id: "l-1", autoRecord: true, outstanding: 50_000_000, next: { number: 1, dueDate: "2026-12-10" } });
  });
});
