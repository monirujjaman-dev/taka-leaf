import { balanceAfter, emiFor, interestOfFirst, MAX_LOAN_MONTHS, MAX_RATE_POINTS, monthlyInterest, schedule, type Instalment } from "@takaleaf/shared";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { categories, loans, transactions, wallets, type LoanPart, type LoanRow, type LoanType, type TransactionRow, type WalletRow } from "../db/schema";
export { heldByCard } from "./wallets";
import type { AppDb } from "../db/types";
import { addDays, addMonths, atLocal, localDate, today } from "./calendar";
import { feesCategoryId } from "./categories";
import { newId } from "./ids";
import { toViews, type TransactionView } from "./transactions";
import { heldByCard, movements } from "./wallets";
import { cleanText, FieldError, find, MAX_AMOUNT, NAME_MAX, put, remove } from "./write";

/**
 * Bank loans and credit card EMIs, the same rules as Features/Loans on the server. What is left is
 * the (negative) balance of the loan's own Loan wallet; the EMI arithmetic is @takaleaf/shared's.
 * Automatic EMIs (card EMIs, auto-debit loans) are recorded by the server; the phone records the
 * rest by hand.
 */

export const INTEREST_CATEGORY = "Loan interest";
export const SETTLEMENT_NOTE = "Early settlement charge";
export const PROCESSING_FEE_NOTE = "Processing fee";
export const LATE_FEE_NOTE = "Late fee";
export const DUE_SOON_DAYS = 7;

export interface NextEmi {
  number: number;
  dueDate: string;
  principal: number;
  interest: number;
  total: number;
  overdue: boolean;
}

export interface LoanView extends LoanRow {
  outstanding: number;
  paid: number;
  left: number;
  closed: boolean;
  next: NextEmi | null;
  endsOn: string | null;
  interestPaid: number;
  interestLeft: number;
  payFromWalletName: string | null;
  rest: Instalment[];
}

export const dueDateOf = (loan: Pick<LoanRow, "firstDueDate">, number: number) => addMonths(loan.firstDueDate, number - 1);

function views(db: AppDb, rows: LoanRow[], day: string): LoanView[] {
  if (rows.length === 0) return [];
  const moved = movements(db);
  const walletRows = new Map(db.select().from(wallets).all().map((w) => [w.id, w]));
  const recorded = new Map(
    db
      .select({
        loanId: transactions.loanId,
        lastEmi: sql<number | null>`max(case when ${transactions.loanPart} = 'Principal' then ${transactions.loanEmi} end)`,
        interest: sql<number>`coalesce(sum(case when ${transactions.loanPart} = 'Interest' then ${transactions.amount} end), 0)`,
      })
      .from(transactions)
      .where(and(isNull(transactions.deletedAt), sql`${transactions.loanId} is not null`))
      .groupBy(transactions.loanId)
      .all()
      .map((r) => [r.loanId!, r]),
  );
  return rows.map((loan) => {
    const wallet = walletRows.get(loan.walletId);
    const outstanding = Math.max(0, -((wallet?.openingBalance ?? 0) + (moved.get(loan.walletId) ?? 0)));
    const r = recorded.get(loan.id);
    const paid = Math.max(loan.paidBefore, Number(r?.lastEmi ?? 0));
    const closed = loan.closedOn !== null || outstanding <= 0;
    const rest = closed ? [] : schedule(outstanding, loan.ratePoints, loan.emi, paid + 1);
    const first = rest[0];
    const next = first ? { number: first.number, dueDate: dueDateOf(loan, first.number), principal: first.principal, interest: first.interest, total: first.total, overdue: dueDateOf(loan, first.number) < day } : null;
    return {
      ...loan,
      outstanding,
      paid,
      left: rest.length,
      closed,
      next,
      endsOn: rest.length ? dueDateOf(loan, rest[rest.length - 1]!.number) : null,
      interestPaid: interestOfFirst(loan.principal, loan.ratePoints, loan.emi, loan.paidBefore) + Number(r?.interest ?? 0),
      interestLeft: rest.reduce((s, i) => s + i.interest, 0),
      payFromWalletName: walletRows.get(loan.payFromWalletId)?.name ?? null,
      rest,
    };
  });
}

/** Open loans first, by next due date; closed ones last. */
export function listLoans(db: AppDb, day: string = today()): LoanView[] {
  return views(db, db.select().from(loans).where(isNull(loans.deletedAt)).all(), day).sort(
    (a, b) => Number(a.closed) - Number(b.closed) || (a.next?.dueDate ?? "9999").localeCompare(b.next?.dueDate ?? "9999") || a.name.localeCompare(b.name),
  );
}

export const loanView = (db: AppDb, id: string, day: string = today()) => {
  const row = find(db, "loans", id);
  return row ? views(db, [row], day)[0] : undefined;
};

export interface LoanSummary {
  outstanding: number;
  bank: number;
  cardEmi: number;
  interestPaid: number;
}

export function summarizeLoans(list: LoanView[]): LoanSummary {
  const open = list.filter((l) => !l.closed);
  return {
    outstanding: open.reduce((s, l) => s + l.outstanding, 0),
    bank: open.filter((l) => l.type === "Bank").reduce((s, l) => s + l.outstanding, 0),
    cardEmi: open.filter((l) => l.type === "CardEmi").reduce((s, l) => s + l.outstanding, 0),
    interestPaid: open.reduce((s, l) => s + l.interestPaid, 0),
  };
}

/** Bank EMIs paid by hand that fall due within a week (or are late), for Home. */
export function dueEmis(db: AppDb, day: string = today()): LoanView[] {
  const soon = addDays(day, DUE_SOON_DAYS);
  return listLoans(db, day).filter((l) => l.type === "Bank" && !l.closed && !l.autoRecord && l.next && l.next.dueDate <= soon);
}

export type ScheduleStatus = "Paid" | "PaidBefore" | "Due" | "Upcoming";

export interface ScheduleRow {
  number: number;
  dueDate: string;
  status: ScheduleStatus;
  principal: number;
  interest: number;
  total: number;
  balanceAfter: number | null;
  paidAt: string | null;
  paidFrom: string | null;
}

export interface CardLimit {
  cardName: string;
  limit: number | null;
  spent: number;
  held: number;
  available: number | null;
}

export interface LoanDetail {
  loan: LoanView;
  schedule: ScheduleRow[];
  activity: TransactionView[];
  card: CardLimit | null;
}

export function loanDetail(db: AppDb, id: string, day: string = today()): LoanDetail | undefined {
  const loan = loanView(db, id, day);
  if (!loan) return undefined;
  const rows = db.select().from(transactions).where(and(isNull(transactions.deletedAt), eq(transactions.loanId, id))).orderBy(desc(transactions.occurredAt)).all();
  const names = new Map(db.select({ id: wallets.id, name: wallets.name }).from(wallets).all().map((w) => [w.id, w.name]));
  const result: ScheduleRow[] = schedule(loan.principal, loan.ratePoints, loan.emi, 1, loan.paidBefore).map((r) => ({
    number: r.number, dueDate: dueDateOf(loan, r.number), status: "PaidBefore", principal: r.principal, interest: r.interest, total: r.total, balanceAfter: r.balanceAfter, paidAt: null, paidFrom: null,
  }));
  const byEmi = new Map<number, TransactionRow[]>();
  for (const t of rows) if (t.loanEmi != null) byEmi.set(t.loanEmi, [...(byEmi.get(t.loanEmi) ?? []), t]);
  for (const [number, parts] of [...byEmi.entries()].sort((a, b) => a[0] - b[0])) {
    const principal = parts.find((t) => t.loanPart === "Principal");
    const interest = parts.filter((t) => t.loanPart === "Interest").reduce((s, t) => s + t.amount, 0);
    result.push({
      number, dueDate: dueDateOf(loan, number), status: "Paid", principal: principal?.amount ?? 0, interest, total: (principal?.amount ?? 0) + interest, balanceAfter: null,
      paidAt: principal?.occurredAt ?? null, paidFrom: principal?.fromWalletId ? (names.get(principal.fromWalletId) ?? null) : null,
    });
  }
  loan.rest.forEach((r, i) =>
    result.push({ number: r.number, dueDate: dueDateOf(loan, r.number), status: i === 0 ? "Due" : "Upcoming", principal: r.principal, interest: r.interest, total: r.total, balanceAfter: r.balanceAfter, paidAt: null, paidFrom: null }),
  );

  let card: CardLimit | null = null;
  if (loan.type === "CardEmi") {
    const cardRow = db.select().from(wallets).where(eq(wallets.id, loan.payFromWalletId)).get();
    if (cardRow) {
      const moved = movements(db);
      const spent = Math.max(0, -(cardRow.openingBalance + (moved.get(cardRow.id) ?? 0)));
      const held = heldByCard(db, moved).get(cardRow.id) ?? 0;
      card = { cardName: cardRow.name, limit: cardRow.creditLimit, spent, held, available: cardRow.creditLimit != null ? cardRow.creditLimit - spent - held : null };
    }
  }
  return { loan, schedule: result.sort((a, b) => b.number - a.number), activity: toViews(db, rows), card };
}

/** The "Loan interest" expense category, if the account has one; otherwise the server files the interest there on sync. */
export function interestCategoryId(db: AppDb): string | null {
  return (
    db
      .select({ id: categories.id })
      .from(categories)
      .where(and(isNull(categories.deletedAt), eq(categories.kind, "Expense"), eq(categories.name, INTEREST_CATEGORY)))
      .orderBy(asc(categories.archived))
      .get()?.id ?? null
  );
}

function checkPayWallet(db: AppDb, id: string | null | undefined, field: string, creditCard: boolean, current?: string): WalletRow {
  if (!id) throw new FieldError(field, creditCard ? "Choose the credit card." : "Choose the wallet the EMIs are paid from.");
  const wallet = find(db, "wallets", id);
  if (!wallet) throw new FieldError(field, "That wallet does not exist.");
  if (wallet.type === "Lent" || wallet.type === "Borrowed" || wallet.type === "Loan") throw new FieldError(field, "Choose one of your own wallets, like your bank account or bKash.");
  if (creditCard && wallet.type !== "CreditCard") throw new FieldError(field, "Choose a credit card.");
  if (wallet.archived && id !== current) throw new FieldError(field, "That wallet is archived. Unarchive it to use it.");
  return wallet;
}

function checkEmi(emi: number, balance: number, ratePoints: number): void {
  if (!Number.isSafeInteger(emi) || emi <= 0 || emi > MAX_AMOUNT) throw new FieldError("emi", "Enter the EMI, more than zero.");
  if (emi <= monthlyInterest(balance, ratePoints)) throw new FieldError("emi", "The EMI must be more than a month's interest, or the loan never ends.");
}

function row(loan: Pick<LoanRow, "id">, part: LoanPart, type: TransactionRow["type"], amount: number, from: string | null, to: string | null, categoryId: string | null, emi: number | null, at: string, note: string | null): TransactionRow {
  return {
    id: newId(), type, amount, fromWalletId: from, toWalletId: to, categoryId, personId: null, feeOfId: null, recurringRuleId: null, recurringDate: null,
    occurredAt: new Date(at).toISOString(), note, loanId: loan.id, loanEmi: emi, loanPart: part, updatedAt: "", deletedAt: null,
  };
}

export interface AddLoanInput {
  type: LoanType;
  name: string;
  lender: string | null;
  payFromWalletId: string | null;
  principal: number;
  ratePoints: number;
  months: number;
  /** The bank's EMI; worked out when null. */
  emi: number | null;
  firstDueDate: string;
  paidBefore: number;
  autoRecord: boolean;
  receivedInWalletId: string | null;
  processingFee: number;
  purchaseCategoryId: string | null;
}

/** As POST /api/loans: the loan, its own Loan wallet, and the money's first rows. Returns the id. */
export function addLoan(db: AppDb, input: AddLoanInput, now: Date = new Date()): string {
  const card = input.type === "CardEmi";
  const name = cleanText(input.name);
  if (!name || name.length > NAME_MAX) throw new FieldError("name", card ? "Name it, like Laptop EMI." : "Name it, like Home loan.");
  if (!Number.isSafeInteger(input.principal) || input.principal <= 0 || input.principal > MAX_AMOUNT) throw new FieldError("principal", card ? "Enter the price, more than zero." : "Enter the loan amount, more than zero.");
  if (!Number.isInteger(input.ratePoints) || input.ratePoints < 0 || input.ratePoints > MAX_RATE_POINTS) throw new FieldError("ratePoints", "Enter the interest rate, from 0 to 100 % a year.");
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > MAX_LOAN_MONTHS) throw new FieldError("months", `Enter the months, from 1 to ${MAX_LOAN_MONTHS}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.firstDueDate)) throw new FieldError("firstDueDate", card ? "Choose the first statement date." : "Choose the date of the first EMI.");
  if (!Number.isInteger(input.paidBefore) || input.paidBefore < 0 || input.paidBefore >= input.months) throw new FieldError("paidBefore", `Enter how many are already paid, from 0 to ${input.months - 1}.`);
  const emi = input.emi ?? emiFor(input.principal, input.ratePoints, input.months);
  checkEmi(emi, input.principal, input.ratePoints);
  const payFrom = checkPayWallet(db, input.payFromWalletId, "payFromWalletId", card);
  if (!Number.isSafeInteger(input.processingFee) || input.processingFee < 0) throw new FieldError("processingFee", "The processing fee must be zero or more.");
  const receivedIn = !card && input.paidBefore === 0 && input.receivedInWalletId ? checkPayWallet(db, input.receivedInWalletId, "receivedInWalletId", false).id : null;

  const id = newId(now);
  const walletId = newId(now);
  // The day the loan began: a month before the first EMI, but never in the future.
  let start = atLocal(addMonths(input.firstDueDate, -1));
  if (start > now.toISOString()) start = now.toISOString();
  let opening = 0;
  const rows: TransactionRow[] = [];
  const loan = { id };
  if (input.paidBefore > 0) opening = -balanceAfter(input.principal, input.ratePoints, emi, input.paidBefore);
  else if (card) rows.push(row(loan, "Purchase", "Expense", input.principal, walletId, null, input.purchaseCategoryId, null, start, name));
  else if (receivedIn) rows.push(row(loan, "Disbursement", "Transfer", input.principal, walletId, receivedIn, null, null, start, `${name} received`));
  else opening = -input.principal;
  if (input.processingFee > 0 && input.paidBefore === 0) {
    rows.push(row(loan, "Fee", "Expense", input.processingFee, receivedIn ?? payFrom.id, null, feesCategoryId(db), null, start, PROCESSING_FEE_NOTE));
  }

  db.transaction((tx) => {
    put(tx, "wallets", {
      id: walletId, type: "Loan", name, openingBalance: opening, creditLimit: null, personId: null, icon: null, color: null, archived: false,
      excludedFromTotal: false, sortOrder: 0, updatedAt: "", deletedAt: null,
    }, now);
    put(tx, "loans", {
      id, type: input.type, name, lender: card ? null : cleanText(input.lender), walletId, payFromWalletId: payFrom.id, principal: input.principal,
      ratePoints: input.ratePoints, months: input.months, emi, firstDueDate: input.firstDueDate, paidBefore: input.paidBefore,
      autoRecord: card || input.autoRecord, closedOn: null, updatedAt: "", deletedAt: null,
    }, now);
    for (const r of rows) put(tx, "transactions", r, now);
  });
  return id;
}

export interface UpdateLoanInput {
  name: string;
  lender: string | null;
  payFromWalletId: string;
  ratePoints: number;
  emi: number;
  autoRecord: boolean;
}

/** A new rate or EMI applies from the next EMI. */
export function updateLoan(db: AppDb, id: string, input: UpdateLoanInput, now: Date = new Date()): void {
  const loan = loanView(db, id);
  if (!loan) throw new FieldError("loan", "That loan does not exist.");
  const card = loan.type === "CardEmi";
  const name = cleanText(input.name);
  if (!name || name.length > NAME_MAX) throw new FieldError("name", "Give the loan a name.");
  checkPayWallet(db, input.payFromWalletId, "payFromWalletId", card, loan.payFromWalletId);
  if (!Number.isInteger(input.ratePoints) || input.ratePoints < 0 || input.ratePoints > MAX_RATE_POINTS) throw new FieldError("ratePoints", "Enter the interest rate, from 0 to 100 % a year.");
  if (!loan.closed) checkEmi(input.emi, loan.outstanding, input.ratePoints);
  db.transaction((tx) => {
    const row = find(tx, "loans", id)!;
    put(tx, "loans", { ...row, name, lender: card ? null : cleanText(input.lender), payFromWalletId: input.payFromWalletId, ratePoints: input.ratePoints, emi: input.emi, autoRecord: card || input.autoRecord }, now);
    const wallet = find(tx, "wallets", row.walletId);
    if (wallet && wallet.name !== name) put(tx, "wallets", { ...wallet, name }, now);
  });
}

/** Removes the loan, then its rows and its wallet (the server does the same when the loan's delete arrives). */
export function deleteLoan(db: AppDb, id: string, now: Date = new Date()): void {
  db.transaction((tx) => {
    const loan = find(tx, "loans", id);
    if (!loan) return;
    remove(tx, "loans", loan, now);
    for (const t of tx.select().from(transactions).where(and(isNull(transactions.deletedAt), eq(transactions.loanId, id))).all()) remove(tx, "transactions", t, now);
    const wallet = find(tx, "wallets", loan.walletId);
    if (wallet) remove(tx, "wallets", wallet, now);
  });
}

export interface PayEmiInput {
  walletId: string;
  /** The whole payment; null pays the EMI as scheduled. */
  amount: number | null;
  lateFee: number;
  occurredAt: string;
}

/** The next EMI: principal into the loan's wallet, interest as an expense, and an optional late fee. */
export function payEmi(db: AppDb, id: string, input: PayEmiInput, now: Date = new Date()): void {
  const loan = loanView(db, id);
  if (!loan) throw new FieldError("loan", "That loan does not exist.");
  const next = loan.next;
  if (!next) throw new FieldError("amount", "This loan is paid off.");
  checkPayWallet(db, input.walletId, "walletId", false, loan.payFromWalletId);
  let principal = next.principal;
  if (input.amount !== null) {
    principal = input.amount - next.interest;
    if (principal <= 0) throw new FieldError("amount", "Pay more than this month's interest.");
    if (principal > loan.outstanding) throw new FieldError("amount", "That is more than is left. To pay it all, settle the loan instead.");
  }
  if (!Number.isSafeInteger(input.lateFee) || input.lateFee < 0) throw new FieldError("lateFee", "The late fee must be zero or more.");
  db.transaction((tx) => {
    put(tx, "transactions", row(loan, "Principal", "Transfer", principal, input.walletId, loan.walletId, null, next.number, input.occurredAt, `${loan.name} EMI ${next.number}`), now);
    if (next.interest > 0) put(tx, "transactions", row(loan, "Interest", "Expense", next.interest, input.walletId, null, interestCategoryId(tx), next.number, input.occurredAt, `${loan.name} interest`), now);
    if (input.lateFee > 0) put(tx, "transactions", row(loan, "Fee", "Expense", input.lateFee, input.walletId, null, feesCategoryId(tx), next.number, input.occurredAt, LATE_FEE_NOTE), now);
  });
}

/** A part payment: all principal. */
export function payExtra(db: AppDb, id: string, input: { walletId: string; amount: number; occurredAt: string }, now: Date = new Date()): void {
  const loan = loanView(db, id);
  if (!loan || loan.closed) throw new FieldError("amount", "This loan is paid off.");
  checkPayWallet(db, input.walletId, "walletId", false, loan.payFromWalletId);
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new FieldError("amount", "Enter the amount paid, more than zero.");
  if (input.amount >= loan.outstanding) throw new FieldError("amount", "That is all of what is left. To pay it all, settle the loan.");
  db.transaction((tx) => {
    put(tx, "transactions", row(loan, "Principal", "Transfer", input.amount, input.walletId, loan.walletId, null, null, input.occurredAt, `${loan.name} extra payment`), now);
  });
}

/** What is left × charge points / 10,000, rounded half up (200 points = 2 %), as the server. */
export function settlementCharge(outstanding: number, chargePoints: number): number {
  return outstanding <= 0 || chargePoints <= 0 ? 0 : Math.round((outstanding * chargePoints) / 10_000);
}

/** Pays everything left plus the bank's early settlement charge and closes the loan. */
export function settleLoan(db: AppDb, id: string, input: { walletId: string; charge: number; occurredAt: string }, now: Date = new Date()): void {
  const loan = loanView(db, id);
  if (!loan || loan.closed) throw new FieldError("charge", "This loan is already paid off.");
  checkPayWallet(db, input.walletId, "walletId", false, loan.payFromWalletId);
  if (!Number.isSafeInteger(input.charge) || input.charge < 0) throw new FieldError("charge", "The charge must be zero or more.");
  db.transaction((tx) => {
    put(tx, "transactions", row(loan, "Principal", "Transfer", loan.outstanding, input.walletId, loan.walletId, null, null, input.occurredAt, `${loan.name} settled`), now);
    if (input.charge > 0) put(tx, "transactions", row(loan, "Fee", "Expense", input.charge, input.walletId, null, feesCategoryId(tx), null, input.occurredAt, SETTLEMENT_NOTE), now);
    put(tx, "loans", { ...find(tx, "loans", id)!, closedOn: localDate(input.occurredAt) }, now);
  });
}

/** Removes the latest EMI recorded (all its rows). */
export function undoLastEmi(db: AppDb, id: string, now: Date = new Date()): void {
  const last = db
    .select({ n: sql<number | null>`max(${transactions.loanEmi})` })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), eq(transactions.loanId, id)))
    .get()?.n;
  if (last == null) throw new FieldError("loan", "No EMI is recorded for this loan yet.");
  db.transaction((tx) => {
    for (const t of tx.select().from(transactions).where(and(isNull(transactions.deletedAt), eq(transactions.loanId, id), eq(transactions.loanEmi, Number(last)))).all()) remove(tx, "transactions", t, now);
  });
}
