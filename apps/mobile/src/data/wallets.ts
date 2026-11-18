import { and, asc, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { loans, recurringRules, transactions, wallets, type WalletRow, type WalletType } from "../db/schema";
import type { AppDb } from "../db/types";
import { newId } from "./ids";
import { cleanText, FieldError, find, MAX_AMOUNT, NAME_MAX, put, remove } from "./write";

export interface WalletWithBalance extends WalletRow {
  balance: number;
  /** Credit cards with a limit: how much can still be spent. */
  availableCredit: number | null;
}

export interface MoneySummary {
  assets: number;
  liabilities: number;
  net: number;
  owedToMe: number;
  iOwe: number;
}

export const isPersonWallet = (type: WalletType) => type === "Lent" || type === "Borrowed";

/** Money in minus money out per wallet; balances are never stored (core rule 2). */
export function movements(db: AppDb): Map<string, number> {
  const live = isNull(transactions.deletedAt);
  const incoming = db
    .select({ id: transactions.toWalletId, sum: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(and(live, isNotNull(transactions.toWalletId)))
    .groupBy(transactions.toWalletId)
    .all();
  const outgoing = db
    .select({ id: transactions.fromWalletId, sum: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(and(live, isNotNull(transactions.fromWalletId)))
    .groupBy(transactions.fromWalletId)
    .all();
  const result = new Map<string, number>();
  for (const row of incoming) result.set(row.id!, (result.get(row.id!) ?? 0) + Number(row.sum));
  for (const row of outgoing) result.set(row.id!, (result.get(row.id!) ?? 0) - Number(row.sum));
  return result;
}

/** For a credit card: what its card EMIs still have to bill, which the bank holds from the limit. */
export function withBalance(wallet: WalletRow, moved: Map<string, number>, held = 0): WalletWithBalance {
  const balance = wallet.openingBalance + (moved.get(wallet.id) ?? 0);
  return { ...wallet, balance, availableCredit: wallet.type === "CreditCard" && wallet.creditLimit != null ? wallet.creditLimit + balance - held : null };
}

/** Per credit card: what its open card EMIs still have to bill (the rest of each EMI's Loan wallet). */
export function heldByCard(db: AppDb, moved: Map<string, number> = movements(db)): Map<string, number> {
  const held = new Map<string, number>();
  const rows = db
    .select({ cardId: loans.payFromWalletId, opening: wallets.openingBalance, walletId: wallets.id })
    .from(loans)
    .innerJoin(wallets, eq(wallets.id, loans.walletId))
    .where(and(isNull(loans.deletedAt), eq(loans.type, "CardEmi"), isNull(loans.closedOn)))
    .all();
  for (const r of rows) held.set(r.cardId, (held.get(r.cardId) ?? 0) + Math.max(0, -(r.opening + (moved.get(r.walletId) ?? 0))));
  return held;
}

/** Every live wallet with its balance, own wallets first in their order. Person wallets included. */
export function listWallets(db: AppDb, { includeArchived = true } = {}): WalletWithBalance[] {
  const moved = movements(db);
  const held = heldByCard(db, moved);
  return db
    .select()
    .from(wallets)
    .where(and(isNull(wallets.deletedAt), includeArchived ? undefined : eq(wallets.archived, false)))
    .orderBy(asc(wallets.sortOrder), asc(wallets.name))
    .all()
    .map((w) => withBalance(w, moved, held.get(w.id) ?? 0));
}

/** The user's own wallets (not loans), for pickers. */
/** A wallet of the user's own: not a person's Lent or Borrowed wallet, not a loan's. */
export const isOwnWallet = (type: WalletType) => !isPersonWallet(type) && type !== "Loan" && type !== "Savings";

export const ownWallets = (db: AppDb, options?: { includeArchived?: boolean }) => listWallets(db, options).filter((w) => isOwnWallet(w.type));

/** As Balances.Summarize: archived wallets count, wallets left out of the total do not. */
export function summarize(list: WalletWithBalance[]): MoneySummary {
  let assets = 0, liabilities = 0, owedToMe = 0, iOwe = 0;
  for (const w of list) {
    if (w.type === "Lent" && w.balance > 0) owedToMe += w.balance;
    if (w.type === "Borrowed" && w.balance < 0) iOwe -= w.balance;
    if (w.excludedFromTotal) continue;
    if (w.balance > 0) assets += w.balance;
    else liabilities -= w.balance;
  }
  return { assets, liabilities, net: assets - liabilities, owedToMe, iOwe };
}

export interface WalletInput {
  id?: string;
  type: WalletType;
  name: string;
  openingBalance: number;
  creditLimit: number | null;
  excludedFromTotal: boolean;
  archived?: boolean;
}

export function saveWallet(db: AppDb, input: WalletInput, now: Date = new Date()): string {
  const name = cleanText(input.name);
  if (!name || name.length > NAME_MAX) throw new FieldError("name", `Give the wallet a name of up to ${NAME_MAX} characters.`);
  if (isPersonWallet(input.type)) throw new FieldError("type", "Lending and borrowing are recorded from People.");
  if (input.type === "Loan" || find(db, "wallets", input.id)?.type === "Loan") throw new FieldError("type", "This wallet belongs to a loan. Change it from Loans.");
  if (input.type === "Savings" || find(db, "wallets", input.id)?.type === "Savings") throw new FieldError("type", "This wallet belongs to a saving. Change it from Savings.");
  if (!Number.isSafeInteger(input.openingBalance) || Math.abs(input.openingBalance) > MAX_AMOUNT) throw new FieldError("openingBalance", "Enter the balance, like 1250 or 1250.50.");
  if (input.creditLimit != null) {
    if (input.type !== "CreditCard") throw new FieldError("creditLimit", "Only a credit card has a credit limit.");
    if (input.creditLimit <= 0) throw new FieldError("creditLimit", "The credit limit must be more than zero.");
  }
  const id = input.id ?? newId(now);
  const taken = db
    .select({ id: wallets.id })
    .from(wallets)
    .where(and(isNull(wallets.deletedAt), ne(wallets.id, id), sql`lower(${wallets.name}) = ${name.toLowerCase()}`))
    .get();
  if (taken) throw new FieldError("name", "You already have a wallet with this name.");

  db.transaction((tx) => {
    const existing = find(tx, "wallets", input.id);
    const sortOrder = existing?.sortOrder ?? (tx.select({ n: sql<number>`coalesce(max(${wallets.sortOrder}), -1) + 1` }).from(wallets).get()?.n ?? 0);
    put(tx, "wallets", {
      id,
      type: existing?.type ?? input.type,
      name,
      openingBalance: input.openingBalance,
      creditLimit: input.creditLimit,
      personId: null,
      icon: existing?.icon ?? null,
      color: existing?.color ?? null,
      archived: input.archived ?? existing?.archived ?? false,
      excludedFromTotal: input.excludedFromTotal,
      sortOrder: Number(sortOrder),
      updatedAt: "",
      deletedAt: null,
    }, now);
  });
  return id;
}

export function setWalletArchived(db: AppDb, id: string, archived: boolean, now: Date = new Date()): void {
  db.transaction((tx) => {
    const wallet = find(tx, "wallets", id);
    if (wallet?.type === "Loan") throw new FieldError("wallet", "This wallet belongs to a loan. Change it from Loans.");
    if (wallet?.type === "Savings") throw new FieldError("wallet", "This wallet belongs to a saving. Change it from Savings.");
    if (wallet) put(tx, "wallets", { ...wallet, archived }, now);
  });
}

/** A used wallet cannot be deleted: archive it instead (as on the server). */
export function walletInUse(db: AppDb, id: string): boolean {
  const used = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), or(eq(transactions.fromWalletId, id), eq(transactions.toWalletId, id))))
    .limit(1)
    .get();
  const rule = db
    .select({ id: recurringRules.id })
    .from(recurringRules)
    .where(and(isNull(recurringRules.deletedAt), or(eq(recurringRules.fromWalletId, id), eq(recurringRules.toWalletId, id))))
    .limit(1)
    .get();
  return Boolean(used || rule);
}

export function deleteWallet(db: AppDb, id: string, now: Date = new Date()): void {
  if (find(db, "wallets", id)?.type === "Loan") throw new FieldError("wallet", "This wallet belongs to a loan. Change it from Loans.");
  if (find(db, "wallets", id)?.type === "Savings") throw new FieldError("wallet", "This wallet belongs to a saving. Change it from Savings.");
  if (walletInUse(db, id)) throw new FieldError("wallet", "This wallet has transactions. Archive it instead.");
  db.transaction((tx) => {
    const wallet = find(tx, "wallets", id);
    if (wallet) remove(tx, "wallets", wallet, now);
  });
}
