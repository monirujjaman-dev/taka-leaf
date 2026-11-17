import { and, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { categories, transactions, type CategoryKind } from "../db/schema";
import type { AppDb } from "../db/types";
import { monthRange, shiftMonth, yearRange } from "./calendar";

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  amount: number;
  children: { categoryId: string; name: string; amount: number }[];
}

export interface Totals {
  income: number;
  expense: number;
  /** Income minus expense. */
  saved: number;
}

/** Income and expense between two moments. Transfers move money and do not count. */
export function totals(db: AppDb, from: string, to: string): Totals {
  const row = db
    .select({
      income: sql<number>`coalesce(sum(case when ${transactions.type} = 'Income' then ${transactions.amount} end), 0)`,
      expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'Expense' then ${transactions.amount} end), 0)`,
    })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), gte(transactions.occurredAt, from), lt(transactions.occurredAt, to)))
    .get();
  const income = Number(row?.income ?? 0);
  const expense = Number(row?.expense ?? 0);
  return { income, expense, saved: income - expense };
}

/** Spending (or income) by main category, each with its sub-categories, largest first. */
export function byCategory(db: AppDb, kind: CategoryKind, from: string, to: string): CategoryTotal[] {
  const rows = db
    .select({ categoryId: transactions.categoryId, amount: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), inArray(transactions.type, [kind]), gte(transactions.occurredAt, from), lt(transactions.occurredAt, to)))
    .groupBy(transactions.categoryId)
    .all();
  const all = new Map(db.select().from(categories).all().map((c) => [c.id, c]));
  const groups = new Map<string, CategoryTotal>();
  for (const row of rows) {
    const amount = Number(row.amount);
    const category = row.categoryId ? all.get(row.categoryId) : undefined;
    const parent = category?.parentId ? all.get(category.parentId) : category;
    const key = parent?.id ?? "none";
    const group = groups.get(key) ?? { categoryId: parent?.id ?? null, name: parent?.name ?? "No category", amount: 0, children: [] };
    group.amount += amount;
    if (category && category.parentId) group.children.push({ categoryId: category.id, name: category.name, amount });
    groups.set(key, group);
  }
  return [...groups.values()].map((g) => ({ ...g, children: g.children.sort((a, b) => b.amount - a.amount) })).sort((a, b) => b.amount - a.amount);
}

export interface TrendPoint {
  month: string;
  income: number;
  expense: number;
}

/** Month by month, ending with the given month. */
export function trend(db: AppDb, lastMonth: string, months: number): TrendPoint[] {
  return Array.from({ length: months }, (_, i) => {
    const month = shiftMonth(lastMonth, i - months + 1);
    const { from, to } = monthRange(month);
    const t = totals(db, from, to);
    return { month, income: t.income, expense: t.expense };
  });
}

export interface Report extends Totals {
  savedPercent: number | null;
  spending: CategoryTotal[];
  earning: CategoryTotal[];
  trend: TrendPoint[];
}

export function report(db: AppDb, period: { month: string } | { year: number }): Report {
  const range = "month" in period ? monthRange(period.month) : yearRange(period.year);
  const t = totals(db, range.from, range.to);
  return {
    ...t,
    savedPercent: t.income > 0 ? Math.round((t.saved * 100) / t.income) : null,
    spending: byCategory(db, "Expense", range.from, range.to),
    earning: byCategory(db, "Income", range.from, range.to),
    trend: "month" in period ? trend(db, period.month, 6) : trend(db, `${period.year}-12`, 12),
  };
}
