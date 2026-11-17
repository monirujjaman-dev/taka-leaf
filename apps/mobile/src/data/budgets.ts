import { and, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { budgets, categories, transactions } from "../db/schema";
import type { AppDb } from "../db/types";
import { monthRange } from "./calendar";
import { newId } from "./ids";
import { FieldError, find, MAX_AMOUNT, put, remove } from "./write";

export const OVERALL_NAME = "All spending";
export const NEAR_PERCENT = 80;

export type BudgetStatus = "OnTrack" | "Near" | "Over";

export interface BudgetView {
  id: string;
  categoryId: string | null;
  name: string;
  amount: number;
  spent: number;
  remaining: number;
  percent: number;
  status: BudgetStatus;
}

/** Spending in a local month against each budget. A main category's budget covers its sub-categories. */
export function budgetsFor(db: AppDb, month: string): BudgetView[] {
  const { from, to } = monthRange(month);
  const spentRows = db
    .select({ categoryId: transactions.categoryId, amount: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), eq(transactions.type, "Expense"), gte(transactions.occurredAt, from), lt(transactions.occurredAt, to)))
    .groupBy(transactions.categoryId)
    .all();
  const all = db.select().from(categories).all();
  const parentOf = new Map(all.map((c) => [c.id, c.parentId]));
  const total = spentRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const spentOn = (categoryId: string) =>
    spentRows.filter((r) => r.categoryId && (r.categoryId === categoryId || parentOf.get(r.categoryId) === categoryId)).reduce((sum, r) => sum + Number(r.amount), 0);
  const names = new Map(all.map((c) => [c.id, c.name]));

  return db
    .select()
    .from(budgets)
    .where(isNull(budgets.deletedAt))
    .all()
    .map((b) => {
      const spent = b.categoryId ? spentOn(b.categoryId) : total;
      const percent = Math.min(Math.floor((spent * 100) / b.amount), 999);
      const status: BudgetStatus = spent > b.amount ? "Over" : percent >= NEAR_PERCENT ? "Near" : "OnTrack";
      return { id: b.id, categoryId: b.categoryId, name: b.categoryId ? (names.get(b.categoryId) ?? "Category") : OVERALL_NAME, amount: b.amount, spent, remaining: b.amount - spent, percent, status };
    })
    .sort((a, b) => (a.categoryId === null ? -1 : b.categoryId === null ? 1 : a.name.localeCompare(b.name)));
}

export function saveBudget(db: AppDb, input: { id?: string; categoryId: string | null; amount: number }, now: Date = new Date()): string {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > MAX_AMOUNT) throw new FieldError("amount", "Enter a monthly amount above zero.");
  let name = OVERALL_NAME;
  if (input.categoryId) {
    const category = find(db, "categories", input.categoryId);
    if (!category || category.kind !== "Expense") throw new FieldError("categoryId", "Choose one of your expense categories.");
    name = category.name;
  }
  const id = input.id ?? newId(now);
  const taken = db
    .select({ id: budgets.id })
    .from(budgets)
    .where(and(isNull(budgets.deletedAt), ne(budgets.id, id), input.categoryId ? eq(budgets.categoryId, input.categoryId) : isNull(budgets.categoryId)))
    .get();
  if (taken) throw new FieldError("categoryId", `${name} already has a budget. Change that one instead.`);
  db.transaction((tx) => {
    put(tx, "budgets", { id, categoryId: input.categoryId, amount: input.amount, updatedAt: "", deletedAt: null }, now);
  });
  return id;
}

export function deleteBudget(db: AppDb, id: string, now: Date = new Date()): void {
  db.transaction((tx) => {
    const budget = find(tx, "budgets", id);
    if (budget) remove(tx, "budgets", budget, now);
  });
}
