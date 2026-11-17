import { desc, isNull } from "drizzle-orm";
import { transactions, type RecurringRuleRow } from "../db/schema";
import type { AppDb } from "../db/types";
import { budgetsFor, type BudgetView } from "./budgets";
import { monthRange, today } from "./calendar";
import { dueCount, dueRules } from "./recurring";
import { byCategory, totals, type CategoryTotal } from "./reports";
import { toViews, type TransactionView } from "./transactions";
import { isOwnWallet, listWallets, summarize, type MoneySummary, type WalletWithBalance } from "./wallets";

export interface Dashboard {
  summary: MoneySummary;
  month: string;
  income: number;
  expense: number;
  wallets: WalletWithBalance[];
  recent: TransactionView[];
  due: (RecurringRuleRow & { dueCount: number })[];
  budgets: BudgetView[];
  spending: CategoryTotal[];
}

/** Everything the home screen shows, read from SQLite. */
export function dashboard(db: AppDb, month: string, now: Date = new Date()): Dashboard {
  const all = listWallets(db);
  const { from, to } = monthRange(month);
  const t = totals(db, from, to);
  const day = today(now);
  return {
    summary: summarize(all),
    month,
    income: t.income,
    expense: t.expense,
    wallets: all.filter((w) => !w.archived && isOwnWallet(w.type)),
    recent: toViews(db, db.select().from(transactions).where(isNull(transactions.deletedAt)).orderBy(desc(transactions.occurredAt)).limit(5).all()),
    due: dueRules(db, day).map((r) => ({ ...r, dueCount: dueCount(r, day) })),
    budgets: budgetsFor(db, month),
    spending: byCategory(db, "Expense", from, to),
  };
}
