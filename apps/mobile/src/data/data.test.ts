import { outbox } from "../db/schema";
import type { AppDb } from "../db/types";
import { openTestDb } from "../test/db";
import { budgetsFor, saveBudget } from "./budgets";
import { addMonths, atLocal, dayLabel, localDate, monthRange, timeLabel } from "./calendar";
import { categoryTree, deleteCategory, mergeCategory, saveCategory } from "./categories";
import { dashboard } from "./dashboard";
import { newId } from "./ids";
import { deletePerson, listPeople, loans, saveLoan, savePerson } from "./people";
import { dateFor, dueCount, dueRules, recordNext, saveRule, skipNext } from "./recurring";
import { report } from "./reports";
import { deleteTransaction, feeOf, groupByDay, history, saveTransaction } from "./transactions";
import { deleteWallet, listWallets, saveWallet, summarize } from "./wallets";
import { FieldError } from "./write";

let db: AppDb;
let close: () => void;
const now = new Date("2026-11-17T06:00:00.000Z");

beforeEach(async () => {
  ({ db, close } = await openTestDb());
});
afterEach(() => close());

const cash = () => saveWallet(db, { type: "Cash", name: "Cash", openingBalance: 100000, creditLimit: null, excludedFromTotal: false }, now);
const expenseCategory = (name = "Food") => saveCategory(db, { kind: "Expense", name, parentId: null }, now);
const balanceOf = (id: string) => listWallets(db).find((w) => w.id === id)!.balance;
const outboxCount = () => db.select().from(outbox).all().length;

describe("calendar (Asia/Dhaka)", () => {
  it("puts late evening UTC on the next local day", () => {
    expect(localDate("2026-11-30T19:00:00Z")).toBe("2026-12-01");
    expect(monthRange("2026-11")).toEqual({ from: "2026-10-31T18:00:00.000Z", to: "2026-11-30T18:00:00.000Z" });
    expect(atLocal("2026-11-05")).toBe("2026-11-05T03:00:00.000Z");
    expect(timeLabel("2026-11-17T03:10:00Z")).toBe("9:10 am");
    expect(dayLabel("2026-11-17", now)).toBe("Today · 17 Nov");
    expect(dayLabel("2026-11-16", now)).toBe("Yesterday · 16 Nov");
  });

  it("adds months the .NET way", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 2)).toBe("2027-02-15");
  });
});

describe("ids", () => {
  it("are Guid v7 and sort by time", () => {
    const a = newId(new Date(1000));
    const b = newId(new Date(2000));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});

describe("wallets and transactions", () => {
  it("calculates balances and writes every change to the outbox", () => {
    const wallet = cash();
    const food = expenseCategory();
    saveTransaction(db, { type: "Expense", amount: 12550, fromWalletId: wallet, toWalletId: null, categoryId: food, occurredAt: now.toISOString(), note: " Bazaar " }, now);
    saveTransaction(db, { type: "Income", amount: 50000, fromWalletId: null, toWalletId: wallet, categoryId: null, occurredAt: "2026-11-17T07:00:00Z", note: null }, now);

    expect(balanceOf(wallet)).toBe(100000 - 12550 + 50000);
    expect(outboxCount()).toBe(4);
    const page = history(db);
    expect(page.items[0]!.note).toBeNull();
    expect(page.items[1]!.note).toBe("Bazaar");
    expect(page.items[1]!.categoryName).toBe("Food");
    expect([page.income, page.expense, page.total]).toEqual([50000, 12550, 2]);
  });

  it("keeps a transfer's fee as its own expense, and deletes them together", () => {
    const from = cash();
    const to = saveWallet(db, { type: "Mfs", name: "bKash", openingBalance: 0, creditLimit: null, excludedFromTotal: false }, now);
    const id = saveTransaction(db, { type: "Transfer", amount: 30000, fromWalletId: from, toWalletId: to, categoryId: null, occurredAt: now.toISOString(), note: null, fee: 1850 }, now);

    expect(balanceOf(from)).toBe(100000 - 30000 - 1850);
    expect(balanceOf(to)).toBe(30000);
    expect(feeOf(db, id)!.note).toBe("Transfer fee");
    expect(history(db).items.find((t) => t.id === id)!.fee).toBe(1850);

    saveTransaction(db, { id, type: "Transfer", amount: 30000, fromWalletId: from, toWalletId: to, categoryId: null, occurredAt: now.toISOString(), note: null, fee: 0 }, now);
    expect(feeOf(db, id)).toBeUndefined();
    expect(balanceOf(from)).toBe(70000);

    deleteTransaction(db, id, now);
    expect(balanceOf(from)).toBe(100000);
  });

  it("checks transactions with the server's messages", () => {
    const wallet = cash();
    const bad = (input: Partial<Parameters<typeof saveTransaction>[1]>) => () =>
      saveTransaction(db, { type: "Expense", amount: 100, fromWalletId: wallet, toWalletId: null, categoryId: null, occurredAt: now.toISOString(), note: null, ...input }, now);
    expect(bad({ amount: 0 })).toThrow("Enter an amount above zero");
    expect(bad({ fromWalletId: null })).toThrow("Choose the wallet the money left.");
    expect(bad({ type: "Transfer", toWalletId: wallet })).toThrow("Choose two different wallets.");
    expect(bad({ categoryId: saveCategory(db, { kind: "Income", name: "Salary", parentId: null }, now) })).toThrow("Choose an expense category.");
    expect(outboxCount()).toBe(2);
  });

  it("sums assets and liabilities, leaving out excluded wallets", () => {
    cash();
    saveWallet(db, { type: "CreditCard", name: "Card", openingBalance: -40000, creditLimit: 500000, excludedFromTotal: false }, now);
    saveWallet(db, { type: "Bank", name: "Savings", openingBalance: 900000, creditLimit: null, excludedFromTotal: true }, now);
    const all = listWallets(db);
    expect(summarize(all)).toEqual({ assets: 100000, liabilities: 40000, net: 60000, owedToMe: 0, iOwe: 0 });
    expect(all.find((w) => w.name === "Card")!.availableCredit).toBe(460000);
  });

  it("refuses to delete a used wallet and a duplicate name", () => {
    const wallet = cash();
    saveTransaction(db, { type: "Expense", amount: 100, fromWalletId: wallet, toWalletId: null, categoryId: null, occurredAt: now.toISOString(), note: null }, now);
    expect(() => deleteWallet(db, wallet, now)).toThrow("Archive it instead");
    expect(() => saveWallet(db, { type: "Bank", name: "cash", openingBalance: 0, creditLimit: null, excludedFromTotal: false }, now)).toThrow(FieldError);
  });

  it("groups history by local day", () => {
    const wallet = cash();
    saveTransaction(db, { type: "Expense", amount: 100, fromWalletId: wallet, toWalletId: null, categoryId: null, occurredAt: "2026-11-16T19:00:00Z", note: null }, now);
    saveTransaction(db, { type: "Expense", amount: 200, fromWalletId: wallet, toWalletId: null, categoryId: null, occurredAt: "2026-11-16T17:00:00Z", note: null }, now);
    expect(groupByDay(history(db).items).map((g) => [g.day, g.net])).toEqual([["2026-11-17", -100], ["2026-11-16", -200]]);
  });
});

describe("people and loans", () => {
  it("records lending and repayment through the person's wallets", () => {
    const wallet = cash();
    const rahim = savePerson(db, { name: "Rahim", note: null }, now);
    saveLoan(db, { personId: rahim, kind: "Lend", amount: 20000, walletId: wallet, occurredAt: now.toISOString(), note: null }, now);
    saveLoan(db, { personId: rahim, kind: "GotBack", amount: 5000, walletId: wallet, occurredAt: now.toISOString(), note: null }, now);

    const [person] = listPeople(db);
    expect(person).toMatchObject({ name: "Rahim", owesMe: 15000, iOwe: 0 });
    expect(balanceOf(wallet)).toBe(100000 - 15000);
    expect(loans(db, rahim).map((l) => l.kind).sort()).toEqual(["GotBack", "Lend"]);
    expect(() => saveLoan(db, { personId: rahim, kind: "GotBack", amount: 20000, walletId: wallet, occurredAt: now.toISOString(), note: null }, now)).toThrow("more than is owed");
    expect(() => deletePerson(db, rahim, now)).toThrow("has loans recorded");
    expect(summarize(listWallets(db)).owedToMe).toBe(15000);
  });

  it("renames the loan wallets with the person", () => {
    const id = savePerson(db, { name: "Karim", note: null }, now);
    savePerson(db, { id, name: "Karim Bhai", note: "Office" }, now);
    expect(listWallets(db).map((w) => w.name).sort()).toEqual(["Borrowed from Karim Bhai", "Lent to Karim Bhai"]);
  });
});

describe("recurring", () => {
  it("keeps the start day each month, as the server", () => {
    expect([0, 1, 2].map((n) => dateFor("Monthly", 1, "2026-01-31", n))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(dateFor("Weekly", 2, "2026-11-01", 1)).toBe("2026-11-15");
  });

  it("records and skips due dates", () => {
    const wallet = cash();
    const id = saveRule(db, { type: "Expense", amount: 1800000, fromWalletId: wallet, toWalletId: null, categoryId: null, note: "Rent", frequency: "Monthly", interval: 1, startDate: "2026-09-05", endDate: null, autoRecord: false }, now);

    expect(dueCount(dueRules(db, "2026-11-17")[0]!, "2026-11-17")).toBe(3);
    const recorded = recordNext(db, id, {}, now);
    skipNext(db, id, now);

    const page = history(db);
    expect(page.items.find((t) => t.id === recorded)).toMatchObject({ recurringRuleId: id, recurringDate: "2026-09-05", occurredAt: "2026-09-05T03:00:00.000Z" });
    expect(dueRules(db, "2026-11-17")[0]!.nextDate).toBe("2026-11-05");
  });
});

describe("categories, budgets and reports", () => {
  it("merges a category into another, moving transactions and its budget", () => {
    const wallet = cash();
    const food = expenseCategory("Food");
    const meals = expenseCategory("Meals");
    saveTransaction(db, { type: "Expense", amount: 500, fromWalletId: wallet, toWalletId: null, categoryId: meals, occurredAt: now.toISOString(), note: null }, now);
    saveBudget(db, { categoryId: meals, amount: 100000 }, now);

    expect(mergeCategory(db, meals, food, now)).toBe(1);
    expect(categoryTree(db, "Expense").map((c) => c.name)).toEqual(["Food"]);
    expect(budgetsFor(db, "2026-11")).toMatchObject([{ categoryId: food, spent: 500 }]);
    expect(() => deleteCategory(db, food, now)).toThrow("Transactions use this category");
  });

  it("measures a main category's budget with its sub-categories and warns near the limit", () => {
    const wallet = cash();
    const food = expenseCategory("Food");
    const snacks = saveCategory(db, { kind: "Expense", name: "Snacks", parentId: food }, now);
    saveBudget(db, { categoryId: food, amount: 10000 }, now);
    saveBudget(db, { categoryId: null, amount: 9000 }, now);
    saveTransaction(db, { type: "Expense", amount: 8500, fromWalletId: wallet, toWalletId: null, categoryId: snacks, occurredAt: now.toISOString(), note: null }, now);
    saveTransaction(db, { type: "Expense", amount: 1000, fromWalletId: wallet, toWalletId: null, categoryId: null, occurredAt: now.toISOString(), note: null }, now);

    expect(budgetsFor(db, "2026-11").map((b) => [b.name, b.spent, b.status])).toEqual([["All spending", 9500, "Over"], ["Food", 8500, "Near"]]);
    expect(() => saveBudget(db, { categoryId: food, amount: 1 }, now)).toThrow("already has a budget");

    const month = report(db, { month: "2026-11" });
    expect(month).toMatchObject({ income: 0, expense: 9500, saved: -9500 });
    expect(month.spending[0]).toMatchObject({ name: "Food", amount: 8500, children: [{ name: "Snacks", amount: 8500 }] });
    expect(month.trend).toHaveLength(6);
    expect(dashboard(db, "2026-11", now)).toMatchObject({ expense: 9500, summary: { net: 100000 - 9500 } });
  });
});
