import { and, desc, eq, gte, inArray, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";
import { categories, transactions, wallets, type TransactionRow, type TransactionType } from "../db/schema";
import type { AppDb } from "../db/types";
import { localDate } from "./calendar";
import { feesCategoryId } from "./categories";
import { newId } from "./ids";
import { isPersonWallet } from "./wallets";
import { cleanText, FieldError, find, MAX_AMOUNT, NOTE_MAX, put, remove } from "./write";

export const FEE_NOTE = "Transfer fee";

export interface TransactionInput {
  id?: string;
  type: TransactionType;
  amount: number;
  fromWalletId: string | null;
  toWalletId: string | null;
  categoryId: string | null;
  occurredAt: string;
  note: string | null;
  /** Transfers only, in poisha. */
  fee?: number;
  feeCategoryId?: string | null;
}

/** The live fee row of a transfer, if it has one. */
export function feeOf(db: AppDb, transferId: string): TransactionRow | undefined {
  return db.select().from(transactions).where(and(isNull(transactions.deletedAt), eq(transactions.feeOfId, transferId))).get();
}

/** The same checks as TransactionRules.CheckAsync, with the same messages. */
export function checkTransaction(db: AppDb, input: TransactionInput, existing?: TransactionRow): void {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > MAX_AMOUNT) throw new FieldError("amount", "Enter an amount above zero, like 1250 or 1250.50.");
  const { type, fromWalletId: from, toWalletId: to } = input;
  if (type === "Income" && !to) throw new FieldError("toWalletId", "Choose the wallet the money came into.");
  if (type === "Expense" && !from) throw new FieldError("fromWalletId", "Choose the wallet the money left.");
  if (type === "Transfer") {
    if (!from) throw new FieldError("fromWalletId", "Choose the wallet the money left.");
    if (!to) throw new FieldError("toWalletId", "Choose the wallet the money went to.");
    if (from === to) throw new FieldError("toWalletId", "Choose two different wallets.");
  }
  const checkWallet = (id: string | null, current: string | null | undefined, field: string) => {
    if (!id) return;
    const wallet = find(db, "wallets", id);
    if (!wallet) throw new FieldError(field, "That wallet does not exist.");
    if (isPersonWallet(wallet.type)) throw new FieldError(field, "Lending and borrowing are recorded from People.");
    if (wallet.type === "Loan") throw new FieldError(field, "Loan payments are recorded from Loans.");
    if (wallet.archived && id !== current) throw new FieldError(field, "That wallet is archived. Unarchive it to use it.");
  };
  if (type !== "Income") checkWallet(from, existing?.fromWalletId, "fromWalletId");
  if (type !== "Expense") checkWallet(to, existing?.toWalletId, "toWalletId");
  if (type === "Transfer") {
    if (input.categoryId) throw new FieldError("categoryId", "A transfer has no category.");
  } else if (input.categoryId) {
    const category = find(db, "categories", input.categoryId);
    if (!category) throw new FieldError("categoryId", "That category does not exist.");
    if (category.kind !== type) throw new FieldError("categoryId", type === "Income" ? "Choose an income category." : "Choose an expense category.");
    if (category.archived && category.id !== existing?.categoryId) throw new FieldError("categoryId", "That category is archived. Unarchive it to use it.");
  }
  const fee = input.fee ?? 0;
  if (!Number.isSafeInteger(fee) || fee < 0 || fee > MAX_AMOUNT) throw new FieldError("fee", "The fee must be zero or more.");
  if (fee > 0 && type !== "Transfer") throw new FieldError("fee", "Only a transfer has a fee.");
  const note = cleanText(input.note);
  if (note && note.length > NOTE_MAX) throw new FieldError("note", `Keep the note to ${NOTE_MAX} characters.`);
  if (Number.isNaN(Date.parse(input.occurredAt))) throw new FieldError("occurredAt", "Choose the date and time.");
}

/** Adds or changes a transaction; a transfer's fee is its own expense row, kept in step. Returns the id. */
export function saveTransaction(db: AppDb, input: TransactionInput, now: Date = new Date()): string {
  const existing = find(db, "transactions", input.id);
  if (existing && (existing.feeOfId || existing.personId || existing.loanId)) {
    throw new FieldError(
      "type",
      existing.feeOfId ? "This is a transfer fee. Change it on its transfer." : existing.loanId ? "This is part of a bank loan or card EMI. Change it from Loans." : "Loans and repayments are changed from People.",
    );
  }
  checkTransaction(db, input, existing);
  const id = input.id ?? newId(now);
  const occurredAt = new Date(input.occurredAt).toISOString();
  const note = cleanText(input.note);
  db.transaction((tx) => {
    put(tx, "transactions", {
      id,
      type: input.type,
      amount: input.amount,
      fromWalletId: input.type === "Income" ? null : input.fromWalletId,
      toWalletId: input.type === "Expense" ? null : input.toWalletId,
      categoryId: input.type === "Transfer" ? null : input.categoryId,
      personId: null,
      feeOfId: null,
      recurringRuleId: existing?.recurringRuleId ?? null,
      recurringDate: existing?.recurringDate ?? null,
      loanId: null,
      loanEmi: null,
      loanPart: null,
      occurredAt,
      note,
      updatedAt: "",
      deletedAt: null,
    }, now);
    const fee = input.type === "Transfer" ? (input.fee ?? 0) : 0;
    const current = feeOf(tx, id);
    if (fee > 0) {
      put(tx, "transactions", {
        id: current?.id ?? newId(now),
        type: "Expense",
        amount: fee,
        fromWalletId: input.fromWalletId,
        toWalletId: null,
        categoryId: input.feeCategoryId ?? current?.categoryId ?? feesCategoryId(tx),
        personId: null,
        feeOfId: id,
        recurringRuleId: null,
        recurringDate: null,
        loanId: null,
        loanEmi: null,
        loanPart: null,
        occurredAt,
        note: FEE_NOTE,
        updatedAt: "",
        deletedAt: null,
      }, now);
    } else if (current) {
      remove(tx, "transactions", current, now);
    }
  });
  return id;
}

/** Deletes a transaction and, for a transfer, its fee. */
export function deleteTransaction(db: AppDb, id: string, now: Date = new Date()): void {
  db.transaction((tx) => {
    const row = find(tx, "transactions", id);
    if (!row) return;
    if (row.loanId) throw new FieldError("type", "This is part of a bank loan or card EMI. Change it from Loans.");
    const fee = feeOf(tx, id);
    if (fee) remove(tx, "transactions", fee, now);
    remove(tx, "transactions", row, now);
  });
}

export interface TransactionView extends TransactionRow {
  fromWalletName: string | null;
  toWalletName: string | null;
  categoryName: string | null;
  /** For a transfer: its fee. */
  fee: number | null;
  /** Local date, for grouping by day. */
  day: string;
}

export interface HistoryFilter {
  from?: string;
  to?: string;
  type?: TransactionType;
  walletId?: string;
  categoryId?: string;
  search?: string;
  personId?: string;
  limit?: number;
  offset?: number;
}

function whereOf(db: AppDb, filter: HistoryFilter): SQL | undefined {
  const parts: (SQL | undefined)[] = [isNull(transactions.deletedAt)];
  if (filter.from) parts.push(gte(transactions.occurredAt, filter.from));
  if (filter.to) parts.push(lt(transactions.occurredAt, filter.to));
  if (filter.type) parts.push(eq(transactions.type, filter.type));
  if (filter.walletId) parts.push(or(eq(transactions.fromWalletId, filter.walletId), eq(transactions.toWalletId, filter.walletId)));
  if (filter.personId) parts.push(eq(transactions.personId, filter.personId));
  if (filter.categoryId) {
    // A main category includes its sub-categories, as on the web.
    const ids = [filter.categoryId, ...db.select({ id: categories.id }).from(categories).where(eq(categories.parentId, filter.categoryId)).all().map((c) => c.id)];
    parts.push(inArray(transactions.categoryId, ids));
  }
  const search = filter.search?.trim();
  if (search) {
    const pattern = `%${search.replace(/[%_]/g, "")}%`;
    const matchingWallets = db.select({ id: wallets.id }).from(wallets).where(like(wallets.name, pattern)).all().map((w) => w.id);
    const matchingCategories = db.select({ id: categories.id }).from(categories).where(like(categories.name, pattern)).all().map((c) => c.id);
    parts.push(
      or(
        like(transactions.note, pattern),
        matchingCategories.length ? inArray(transactions.categoryId, matchingCategories) : undefined,
        matchingWallets.length ? inArray(transactions.fromWalletId, matchingWallets) : undefined,
        matchingWallets.length ? inArray(transactions.toWalletId, matchingWallets) : undefined,
      ),
    );
  }
  return and(...parts);
}

/** Adds names and fees for display. */
export function toViews(db: AppDb, rows: TransactionRow[]): TransactionView[] {
  const walletNames = new Map(db.select({ id: wallets.id, name: wallets.name }).from(wallets).all().map((w) => [w.id, w.name]));
  const categoryNames = new Map(db.select({ id: categories.id, name: categories.name }).from(categories).all().map((c) => [c.id, c.name]));
  const transferIds = rows.filter((r) => r.type === "Transfer").map((r) => r.id);
  const fees = new Map(
    transferIds.length
      ? db
          .select({ of: transactions.feeOfId, amount: transactions.amount })
          .from(transactions)
          .where(and(isNull(transactions.deletedAt), inArray(transactions.feeOfId, transferIds)))
          .all()
          .map((f) => [f.of!, f.amount])
      : [],
  );
  return rows.map((r) => ({
    ...r,
    fromWalletName: r.fromWalletId ? (walletNames.get(r.fromWalletId) ?? null) : null,
    toWalletName: r.toWalletId ? (walletNames.get(r.toWalletId) ?? null) : null,
    categoryName: r.categoryId ? (categoryNames.get(r.categoryId) ?? null) : null,
    fee: fees.get(r.id) ?? null,
    day: localDate(r.occurredAt),
  }));
}

export interface HistoryPage {
  items: TransactionView[];
  total: number;
  income: number;
  expense: number;
}

/** Newest first, with totals over every match (income and expense only, as on the server). */
export function history(db: AppDb, filter: HistoryFilter = {}): HistoryPage {
  const where = whereOf(db, filter);
  const rows = db
    .select()
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.occurredAt), desc(transactions.id))
    .limit(filter.limit ?? 50)
    .offset(filter.offset ?? 0)
    .all();
  const totals = db
    .select({
      total: sql<number>`count(*)`,
      income: sql<number>`coalesce(sum(case when ${transactions.type} = 'Income' then ${transactions.amount} end), 0)`,
      expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'Expense' then ${transactions.amount} end), 0)`,
    })
    .from(transactions)
    .where(where)
    .get();
  return { items: toViews(db, rows), total: Number(totals?.total ?? 0), income: Number(totals?.income ?? 0), expense: Number(totals?.expense ?? 0) };
}

export function transactionView(db: AppDb, id: string): TransactionView | undefined {
  const row = find(db, "transactions", id);
  return row ? toViews(db, [row])[0] : undefined;
}

/** Days with their rows, in order, for history lists. */
export function groupByDay(items: TransactionView[]): { day: string; items: TransactionView[]; net: number }[] {
  const groups: { day: string; items: TransactionView[]; net: number }[] = [];
  for (const item of items) {
    let group = groups[groups.length - 1];
    if (!group || group.day !== item.day) {
      group = { day: item.day, items: [], net: 0 };
      groups.push(group);
    }
    group.items.push(item);
    group.net += item.type === "Income" ? item.amount : item.type === "Expense" ? -item.amount : 0;
  }
  return groups;
}
