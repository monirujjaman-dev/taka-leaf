import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { people, transactions, wallets, type PersonRow, type TransactionRow, type WalletRow } from "../db/schema";
import type { AppDb } from "../db/types";
import { newId } from "./ids";
import { isPersonWallet, movements } from "./wallets";
import { cleanText, FieldError, find, MAX_AMOUNT, NAME_MAX, NOTE_MAX, put, remove } from "./write";

export type LoanKind = "Lend" | "GotBack" | "Borrow" | "PaidBack";

export const lentName = (person: string) => `Lent to ${person}`;
export const borrowedName = (person: string) => `Borrowed from ${person}`;

export interface PersonView extends PersonRow {
  /** What this person owes the user now. */
  owesMe: number;
  /** What the user owes this person now. */
  iOwe: number;
  net: number;
  lastLoanAt: string | null;
  lentWalletId: string;
  borrowedWalletId: string;
}

function loanWallets(db: AppDb, personId: string): { lent: WalletRow; borrowed: WalletRow } {
  const rows = db.select().from(wallets).where(and(isNull(wallets.deletedAt), eq(wallets.personId, personId))).all();
  const lent = rows.find((w) => w.type === "Lent");
  const borrowed = rows.find((w) => w.type === "Borrowed");
  if (!lent || !borrowed) throw new Error(`Person ${personId} has no loan wallets`);
  return { lent, borrowed };
}

export function listPeople(db: AppDb): PersonView[] {
  const moved = movements(db);
  const loanWalletsByPerson = new Map<string, WalletRow[]>();
  for (const w of db.select().from(wallets).where(isNull(wallets.deletedAt)).all()) {
    if (w.personId && isPersonWallet(w.type)) loanWalletsByPerson.set(w.personId, [...(loanWalletsByPerson.get(w.personId) ?? []), w]);
  }
  const lastLoans = new Map(
    db
      .select({ personId: transactions.personId, at: sql<string>`max(${transactions.occurredAt})` })
      .from(transactions)
      .where(isNull(transactions.deletedAt))
      .groupBy(transactions.personId)
      .all()
      .map((r) => [r.personId, r.at]),
  );
  return db
    .select()
    .from(people)
    .where(isNull(people.deletedAt))
    .orderBy(asc(people.name))
    .all()
    .flatMap((p) => {
      const own = loanWalletsByPerson.get(p.id) ?? [];
      const lent = own.find((w) => w.type === "Lent");
      const borrowed = own.find((w) => w.type === "Borrowed");
      if (!lent || !borrowed) return [];
      const owesMe = Math.max(0, lent.openingBalance + (moved.get(lent.id) ?? 0));
      const iOwe = Math.max(0, -(borrowed.openingBalance + (moved.get(borrowed.id) ?? 0)));
      return [{ ...p, owesMe, iOwe, net: owesMe - iOwe, lastLoanAt: lastLoans.get(p.id) ?? null, lentWalletId: lent.id, borrowedWalletId: borrowed.id }];
    });
}

export const personView = (db: AppDb, id: string) => listPeople(db).find((p) => p.id === id);

export interface PersonInput {
  id?: string;
  name: string;
  note: string | null;
}

/** A new person comes with their Lent and Borrowed wallets; renaming renames those too. */
export function savePerson(db: AppDb, input: PersonInput, now: Date = new Date()): string {
  const name = cleanText(input.name);
  const note = cleanText(input.note);
  if (!name) throw new FieldError("name", "Enter the person's name.");
  if (name.length > NAME_MAX) throw new FieldError("name", `Use at most ${NAME_MAX} characters.`);
  if (note && note.length > NOTE_MAX) throw new FieldError("note", `Keep the note to ${NOTE_MAX} characters.`);
  const id = input.id ?? newId(now);
  const taken = db.select({ id: people.id }).from(people).where(and(isNull(people.deletedAt), ne(people.id, id), sql`lower(${people.name}) = ${name.toLowerCase()}`)).get();
  if (taken) throw new FieldError("name", `${name} is already in your people.`);

  db.transaction((tx) => {
    const existing = find(tx, "people", input.id);
    put(tx, "people", { id, name, note, updatedAt: "", deletedAt: null }, now);
    const blank = { openingBalance: 0, creditLimit: null, personId: id, icon: null, color: null, archived: false, excludedFromTotal: false, sortOrder: 0, updatedAt: "", deletedAt: null };
    if (!existing) {
      put(tx, "wallets", { ...blank, id: newId(now), type: "Lent", name: lentName(name) }, now);
      put(tx, "wallets", { ...blank, id: newId(now), type: "Borrowed", name: borrowedName(name) }, now);
    } else if (existing.name !== name) {
      const { lent, borrowed } = loanWallets(tx, id);
      put(tx, "wallets", { ...lent, name: lentName(name) }, now);
      put(tx, "wallets", { ...borrowed, name: borrowedName(name) }, now);
    }
  });
  return id;
}

export function deletePerson(db: AppDb, id: string, now: Date = new Date()): void {
  const person = find(db, "people", id);
  if (!person) return;
  if (db.select({ id: transactions.id }).from(transactions).where(and(isNull(transactions.deletedAt), eq(transactions.personId, id))).get()) {
    throw new FieldError("person", `${person.name} has loans recorded. Delete those first.`);
  }
  db.transaction((tx) => {
    const { lent, borrowed } = loanWallets(tx, id);
    remove(tx, "people", person, now);
    remove(tx, "wallets", lent, now);
    remove(tx, "wallets", borrowed, now);
  });
}

export interface LoanView {
  id: string;
  kind: LoanKind;
  amount: number;
  walletId: string;
  walletName: string | null;
  occurredAt: string;
  note: string | null;
}

export function kindOf(t: Pick<TransactionRow, "fromWalletId" | "toWalletId">, lentId: string, borrowedId: string): LoanKind {
  if (t.toWalletId === lentId) return "Lend";
  if (t.fromWalletId === lentId) return "GotBack";
  if (t.fromWalletId === borrowedId) return "Borrow";
  return "PaidBack";
}

export function loans(db: AppDb, personId: string): LoanView[] {
  const { lent, borrowed } = loanWallets(db, personId);
  const names = new Map(db.select({ id: wallets.id, name: wallets.name }).from(wallets).all().map((w) => [w.id, w.name]));
  return db
    .select()
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), eq(transactions.personId, personId)))
    .orderBy(desc(transactions.occurredAt))
    .all()
    .map((t) => {
      const kind = kindOf(t, lent.id, borrowed.id);
      const walletId = (kind === "Lend" || kind === "PaidBack" ? t.fromWalletId : t.toWalletId)!;
      return { id: t.id, kind, amount: t.amount, walletId, walletName: names.get(walletId) ?? null, occurredAt: t.occurredAt, note: t.note };
    });
}

export interface LoanInput {
  id?: string;
  personId: string;
  kind: LoanKind;
  amount: number;
  walletId: string;
  occurredAt: string;
  note: string | null;
}

/** Lend: wallet → Lent. Got back: Lent → wallet. Borrow: Borrowed → wallet. Pay back: wallet → Borrowed. */
export function saveLoan(db: AppDb, input: LoanInput, now: Date = new Date()): string {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > MAX_AMOUNT) throw new FieldError("amount", "Enter an amount above zero.");
  const wallet = find(db, "wallets", input.walletId);
  if (!wallet) throw new FieldError("walletId", "That wallet does not exist.");
  if (isPersonWallet(wallet.type) || wallet.type === "Loan" || wallet.type === "Savings") throw new FieldError("walletId", "Choose one of your own wallets, like Cash or bKash.");
  const existing = find(db, "transactions", input.id);
  if (wallet.archived && existing?.fromWalletId !== wallet.id && existing?.toWalletId !== wallet.id) throw new FieldError("walletId", "That wallet is archived. Unarchive it to use it.");
  const note = cleanText(input.note);
  if (note && note.length > NOTE_MAX) throw new FieldError("note", `Keep the note to ${NOTE_MAX} characters.`);
  const { lent, borrowed } = loanWallets(db, input.personId);

  // Repayments cannot be more than what is owed now (leaving out this loan's own amount when editing).
  if (input.kind === "GotBack" || input.kind === "PaidBack") {
    const moved = movements(db);
    const own = input.kind === "GotBack" ? lent : borrowed;
    let outstanding = input.kind === "GotBack" ? own.openingBalance + (moved.get(own.id) ?? 0) : -(own.openingBalance + (moved.get(own.id) ?? 0));
    if (existing) {
      const kind = kindOf(existing, lent.id, borrowed.id);
      if (kind === input.kind) outstanding += existing.amount;
    }
    if (input.amount > outstanding) {
      throw new FieldError("amount", outstanding <= 0 ? "Nothing is owed now." : `That is more than is owed now.`);
    }
  }

  const id = input.id ?? newId(now);
  const [from, to] =
    input.kind === "Lend" ? [wallet.id, lent.id] : input.kind === "GotBack" ? [lent.id, wallet.id] : input.kind === "Borrow" ? [borrowed.id, wallet.id] : [wallet.id, borrowed.id];
  db.transaction((tx) => {
    put(tx, "transactions", {
      id,
      type: "Transfer",
      amount: input.amount,
      fromWalletId: from,
      toWalletId: to,
      categoryId: null,
      personId: input.personId,
      feeOfId: null,
      recurringRuleId: null,
      recurringDate: null,
      loanId: null,
      loanEmi: null,
      loanPart: null,
      savingId: null,
      savingSeq: null,
      savingPart: null,
      occurredAt: new Date(input.occurredAt).toISOString(),
      note,
      updatedAt: "",
      deletedAt: null,
    }, now);
  });
  return id;
}

export function deleteLoan(db: AppDb, id: string, now: Date = new Date()): void {
  db.transaction((tx) => {
    const row = find(tx, "transactions", id);
    if (row?.personId) remove(tx, "transactions", row, now);
  });
}
