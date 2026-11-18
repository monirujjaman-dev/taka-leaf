import { BOND_VALUE, CERTIFICATE_LOW_TAX_LIMIT, dpsMaturity, drawCutoff, excise, GRACE_DAYS, nextDraw, profit, taxOf, taxYearStart } from "@takaleaf/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { categories, savings, transactions, wallets, type PolicyType, type SavingKind, type SavingPart, type SavingRow, type TransactionRow, type WalletRow } from "../db/schema";
import type { AppDb } from "../db/types";
import { addDays, addMonths, atLocal, localDate, startOf, today } from "./calendar";
import { feesCategoryId } from "./categories";
import { newId } from "./ids";
import { toViews, type TransactionView } from "./transactions";
import { movements } from "./wallets";
import { cleanText, FieldError, find, MAX_AMOUNT, NAME_MAX, put, remove } from "./write";

/**
 * FDR, DPS, savings certificates, prize bonds and policies, with the same rules as
 * Features/Savings on the server. Everything but a policy has its own Savings wallet whose balance
 * is the money in it; the arithmetic is @takaleaf/shared's. What banks do by themselves (automatic
 * DPS instalments, FDR profit and maturity, automatic certificate profit) is recorded by the
 * server; the phone records the rest by hand, offline.
 */

export const PROFIT_CATEGORY = "Profit on savings";
export const PRIZE_CATEGORY = "Prize bond prize";
export const PAYOUT_CATEGORY = "Insurance payouts";
export const TAX_CATEGORY = "Tax at source";
export const INSURANCE_CATEGORY = "Insurance";
export const DUE_SOON_DAYS = 7;
export const PRIZE_NAMES = ["1st", "2nd", "3rd", "4th", "5th"] as const;

/** Auto: recorded on the day. Record: by hand. Pay: a premium. Close: matured. Draw: a prize bond draw. */
export type SavingAction = "Auto" | "Record" | "Pay" | "Close" | "Draw";

export interface SavingNext {
  number: number | null;
  date: string;
  label: string;
  amount: number | null;
  action: SavingAction;
  overdue: boolean;
}

export interface SavingView extends SavingRow {
  balance: number;
  closed: boolean;
  maturesOn: string | null;
  done: number;
  total: number | null;
  next: SavingNext | null;
  profitReceived: number;
  taxTaken: number;
  paidSoFar: number;
  estimate: number | null;
  daysDone: number;
  daysTotal: number;
  bondCount: number;
  bondsInDraw: number;
  nextDraw: string | null;
  graceEnds: string | null;
  missedList: number[];
  bondList: string[];
  paidNumbers: Set<number>;
  profitDone: number;
  payFromWalletName: string | null;
}

interface Entry {
  part: SavingPart;
  seq: number | null;
  amount: number;
  day: string;
}

const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

export const missedOf = (s: Pick<SavingRow, "missed">) =>
  [...new Set((s.missed ?? "").split(",").map((n) => Number.parseInt(n, 10)).filter((n) => n > 0))].sort((a, b) => a - b);

export const bondsOf = (s: Pick<SavingRow, "bondNumbers">) => (s.bondNumbers ?? "").split("\n").map((n) => n.trim()).filter(Boolean);

export const periods = (s: Pick<SavingRow, "months" | "everyMonths">) => (s.everyMonths > 0 ? Math.floor(s.months / s.everyMonths) : 1);

/** Profit before tax of one payment: a period's, or the whole term's when paid at maturity. */
export const periodProfit = (s: Pick<SavingRow, "amount" | "ratePoints" | "everyMonths" | "months">) => profit(s.amount, s.ratePoints, s.everyMonths > 0 ? s.everyMonths : s.months);

export const profitDate = (s: Pick<SavingRow, "startDate" | "everyMonths">, k: number) => addMonths(s.startDate, k * s.everyMonths);

export const maturityOf = (s: Pick<SavingRow, "kind" | "startDate" | "months">) => (s.kind === "Dps" ? addMonths(s.startDate, Math.max(s.months - 1, 0)) : addMonths(s.startDate, s.months));

export const dueOf = (s: Pick<SavingRow, "kind" | "startDate" | "everyMonths">, n: number) => (s.kind === "Insurance" ? addMonths(s.startDate, (n - 1) * s.everyMonths) : addMonths(s.startDate, n - 1));

/** What an FDR or certificate pays at maturity, principal included, after tax and duty. */
export function maturityNet(s: SavingRow, balance: number): number {
  const gross = periodProfit(s);
  return balance + gross - taxOf(gross, s.taxPoints) - (s.kind === "Fdr" ? excise(s.chargesPerYear, s.months) : 0);
}

export function stateOf(s: SavingRow, balance: number, entries: Entry[], day: string): Omit<SavingView, keyof SavingRow | "payFromWalletName"> {
  const profitReceived = entries.filter((e) => e.part === "Profit" || e.part === "Prize").reduce((t, e) => t + e.amount, 0);
  const taxTaken = entries.filter((e) => e.part === "Tax").reduce((t, e) => t + e.amount, 0);
  const closed = s.closedOn !== null;
  const missedList = missedOf(s);
  const paidNumbers = new Set<number>();
  const next = (number: number | null, date: string, label: string, amount: number | null, action: SavingAction): SavingNext => ({
    number, date, label, amount, action, overdue: date < day && (action === "Record" || action === "Pay" || action === "Close"),
  });
  const result = {
    balance, closed, maturesOn: null as string | null, done: 0, total: null as number | null, next: null as SavingNext | null, profitReceived, taxTaken,
    paidSoFar: 0, estimate: null as number | null, daysDone: 0, daysTotal: 0, bondCount: 0, bondsInDraw: 0, nextDraw: null as string | null,
    graceEnds: null as string | null, missedList, bondList: bondsOf(s), paidNumbers, profitDone: 0,
  };
  const maxSeq = (part: SavingPart) => entries.filter((e) => e.part === part && e.seq !== null).reduce((m, e) => Math.max(m, e.seq!), 0);

  switch (s.kind) {
    case "Dps": {
      for (let i = 1; i <= s.paidBefore; i++) paidNumbers.add(i);
      for (const e of entries) if (e.part === "Deposit" && e.seq !== null) paidNumbers.add(e.seq);
      result.done = paidNumbers.size;
      result.total = s.months;
      result.maturesOn = maturityOf(s);
      result.paidSoFar = balance;
      result.estimate = s.maturityAmount ?? dpsMaturity(s.amount, s.ratePoints, Math.max(s.months - missedList.length, 0));
      if (!closed) {
        let n = 0;
        for (let i = 1; i <= s.months; i++) if (!paidNumbers.has(i) && !missedList.includes(i)) { n = i; break; }
        result.next = n > 0 ? next(n, dueOf(s, n), `Instalment ${n}`, s.amount, s.autoRecord ? "Auto" : "Record") : next(null, result.maturesOn, "Matured", result.estimate, "Close");
      }
      break;
    }
    case "Fdr":
    case "Certificate": {
      const count = periods(s);
      result.profitDone = Math.max(s.paidBefore, maxSeq("Profit") - s.seqBase);
      result.done = result.profitDone;
      result.total = count;
      result.maturesOn = maturityOf(s);
      result.daysTotal = dayNumber(result.maturesOn) - dayNumber(s.startDate);
      result.daysDone = Math.min(Math.max(dayNumber(day) - dayNumber(s.startDate), 0), result.daysTotal);
      result.estimate = maturityNet(s, balance);
      if (!closed) {
        const auto = s.kind === "Fdr" || s.autoRecord;
        if (s.everyMonths > 0 && result.profitDone < count - 1) {
          const k = result.profitDone + 1;
          const gross = periodProfit(s);
          result.next = next(k, profitDate(s, k), `Profit ${k}`, gross - taxOf(gross, s.taxPoints), auto ? "Auto" : "Record");
        } else {
          result.next = next(count, result.maturesOn, s.kind === "Fdr" && s.renew ? "Renews" : "Matures", result.estimate, auto ? "Auto" : "Close");
        }
      }
      break;
    }
    case "PrizeBond": {
      result.bondCount = Math.floor(Math.max(balance, 0) / BOND_VALUE);
      result.nextDraw = nextDraw(day);
      const cutoff = drawCutoff(result.nextDraw);
      const late = Math.floor(entries.filter((e) => e.part === "Deposit" && e.day > cutoff).reduce((t, e) => t + e.amount, 0) / BOND_VALUE);
      result.bondsInDraw = Math.max(0, result.bondCount - late);
      result.paidSoFar = balance;
      if (!closed && result.bondCount > 0) result.next = next(null, result.nextDraw, "Prize bond draw", null, "Draw");
      break;
    }
    case "Insurance": {
      result.done = Math.max(s.paidBefore, maxSeq("Premium"));
      result.total = s.months > 0 ? Math.floor(s.months / s.everyMonths) : null;
      result.maturesOn = s.months > 0 ? addMonths(s.startDate, s.months) : null;
      result.paidSoFar = s.paidBefore * s.amount + entries.filter((e) => e.part === "Premium").reduce((t, e) => t + e.amount, 0);
      if (!closed && (result.total === null || result.done < result.total)) {
        const n = result.done + 1;
        const due = dueOf(s, n);
        result.next = next(n, due, `Premium ${n}`, s.amount, "Pay");
        result.graceEnds = s.policy === "Life" ? addDays(due, GRACE_DAYS) : null;
      }
      break;
    }
  }
  return result;
}

function views(db: AppDb, rows: SavingRow[], day: string): SavingView[] {
  if (rows.length === 0) return [];
  const moved = movements(db);
  const walletRows = new Map(db.select().from(wallets).all().map((w) => [w.id, w]));
  const byId = new Map<string, Entry[]>();
  for (const t of db
    .select({ savingId: transactions.savingId, part: transactions.savingPart, seq: transactions.savingSeq, amount: transactions.amount, at: transactions.occurredAt })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), sql`${transactions.savingId} is not null`))
    .all()) {
    if (!t.part) continue;
    byId.set(t.savingId!, [...(byId.get(t.savingId!) ?? []), { part: t.part, seq: t.seq, amount: t.amount, day: localDate(t.at) }]);
  }
  return rows.map((s) => {
    const wallet = s.walletId ? walletRows.get(s.walletId) : undefined;
    const balance = wallet ? wallet.openingBalance + (moved.get(wallet.id) ?? 0) : 0;
    return { ...s, ...stateOf(s, balance, byId.get(s.id) ?? [], day), payFromWalletName: walletRows.get(s.payFromWalletId)?.name ?? null };
  });
}

/** Open ones first: savings by what comes next, then policies; closed ones last. */
export function listSavings(db: AppDb, day: string = today()): SavingView[] {
  return views(db, db.select().from(savings).where(isNull(savings.deletedAt)).all(), day).sort(
    (a, b) =>
      Number(a.closed) - Number(b.closed) ||
      Number(a.kind === "Insurance") - Number(b.kind === "Insurance") ||
      (a.next?.date ?? "9999").localeCompare(b.next?.date ?? "9999") ||
      a.name.localeCompare(b.name),
  );
}

export const savingView = (db: AppDb, id: string, day: string = today()) => {
  const row = find(db, "savings", id);
  return row ? views(db, [row], day)[0] : undefined;
};

export interface SavingsSummary {
  saved: number;
  deposits: number;
  certificates: number;
  prizeBonds: number;
  cover: number;
}

export function summarizeSavings(list: SavingView[]): SavingsSummary {
  const open = list.filter((s) => !s.closed);
  const sum = (f: (s: SavingView) => boolean, v: (s: SavingView) => number = (s) => s.balance) => open.filter(f).reduce((t, s) => t + v(s), 0);
  return {
    saved: sum((s) => s.kind !== "Insurance"),
    deposits: sum((s) => s.kind === "Fdr" || s.kind === "Dps"),
    certificates: sum((s) => s.kind === "Certificate"),
    prizeBonds: sum((s) => s.kind === "PrizeBond"),
    cover: sum((s) => s.kind === "Insurance", (s) => s.cover ?? 0),
  };
}

/** The design's "Coming up": the next thing for each open saving or policy, soonest first. */
export function comingUp(list: SavingView[]): SavingView[] {
  return list.filter((s) => !s.closed && s.next).sort((a, b) => a.next!.date.localeCompare(b.next!.date));
}

/** What to record by hand within a week (or late), for Home. */
export function dueSavings(db: AppDb, day: string = today()): SavingView[] {
  const soon = addDays(day, DUE_SOON_DAYS);
  return comingUp(listSavings(db, day)).filter(
    (s) => s.next!.date <= soon && (s.next!.action === "Record" || s.next!.action === "Close" || (s.next!.action === "Pay" && s.remind)),
  );
}

/** This tax year (July to June): money put in, profit and prizes before tax, tax at source. */
export function taxYear(db: AppDb, day: string = today()) {
  const from = taxYearStart(day);
  const to = addDays(addMonths(from, 12), -1);
  const rows = db
    .select({ part: transactions.savingPart, amount: transactions.amount })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), sql`${transactions.savingId} is not null`, sql`${transactions.occurredAt} >= ${startOf(from)}`, sql`${transactions.occurredAt} < ${startOf(addDays(to, 1))}`))
    .all();
  const of = (...parts: SavingPart[]) => rows.filter((r) => r.part && parts.includes(r.part)).reduce((t, r) => t + r.amount, 0);
  return { from, to, invested: of("Deposit"), profit: of("Profit", "Prize"), tax: of("Tax") };
}

export type ScheduleStatus = "Paid" | "PaidBefore" | "Missed" | "Due" | "Upcoming";

export interface ScheduleRow {
  number: number;
  date: string;
  status: ScheduleStatus;
  amount: number;
  tax: number;
  paidAt: string | null;
  paidFrom: string | null;
}

export interface SavingDetail {
  saving: SavingView;
  schedule: ScheduleRow[];
  activity: TransactionView[];
}

export function savingDetail(db: AppDb, id: string, day: string = today()): SavingDetail | undefined {
  const s = savingView(db, id, day);
  if (!s) return undefined;
  const rows = db.select().from(transactions).where(and(isNull(transactions.deletedAt), eq(transactions.savingId, id))).orderBy(desc(transactions.occurredAt)).all();
  const names = new Map(db.select({ id: wallets.id, name: wallets.name }).from(wallets).all().map((w) => [w.id, w.name]));
  const from = (t: TransactionRow | undefined) => (t?.fromWalletId ? (names.get(t.fromWalletId) ?? null) : t?.toWalletId ? (names.get(t.toWalletId) ?? null) : null);
  const schedule: ScheduleRow[] = [];
  const nextNumber = s.next?.number ?? null;
  if (s.kind === "Dps") {
    for (let n = 1; n <= s.months; n++) {
      const row = rows.find((t) => t.savingPart === "Deposit" && t.savingSeq === n);
      const status: ScheduleStatus = row ? "Paid" : n <= s.paidBefore ? "PaidBefore" : s.missedList.includes(n) ? "Missed" : n === nextNumber ? "Due" : "Upcoming";
      schedule.push({ number: n, date: dueOf(s, n), status, amount: row?.amount ?? s.amount, tax: 0, paidAt: row?.occurredAt ?? null, paidFrom: from(row) });
    }
  } else if (s.kind === "Fdr" || s.kind === "Certificate") {
    const gross = periodProfit(s);
    for (let k = 1; k <= periods(s); k++) {
      const seq = s.seqBase + k;
      const row = rows.find((t) => t.savingPart === "Profit" && t.savingSeq === seq);
      const tax = rows.filter((t) => t.savingPart === "Tax" && t.savingSeq === seq).reduce((t, r) => t + r.amount, 0);
      const status: ScheduleStatus = row ? "Paid" : k <= s.paidBefore ? "PaidBefore" : s.closed ? "Missed" : k === s.profitDone + 1 ? "Due" : "Upcoming";
      schedule.push({ number: k, date: s.everyMonths > 0 ? profitDate(s, k) : maturityOf(s), status, amount: row?.amount ?? gross, tax: row ? tax : taxOf(gross, s.taxPoints), paidAt: row?.occurredAt ?? null, paidFrom: from(row) });
    }
  } else if (s.kind === "Insurance") {
    const last = s.total ?? s.done + 3;
    for (let n = 1; n <= last; n++) {
      const row = rows.find((t) => t.savingPart === "Premium" && t.savingSeq === n);
      const status: ScheduleStatus = row ? "Paid" : n <= s.paidBefore ? "PaidBefore" : n === nextNumber ? "Due" : "Upcoming";
      schedule.push({ number: n, date: dueOf(s, n), status, amount: row?.amount ?? s.amount, tax: 0, paidAt: row?.occurredAt ?? null, paidFrom: from(row) });
    }
  }
  return { saving: s, schedule, activity: toViews(db, rows) };
}

/**
 * The category a saving's row goes under, if the account has it; otherwise null, and the server
 * files the row on sync (making the category if needed).
 */
export function categoryFor(db: AppDb, part: SavingPart, policy: PolicyType | null = null): string | null {
  const byName = (kind: "Income" | "Expense", name: string, parentId?: string | null) =>
    db
      .select({ id: categories.id, parentId: categories.parentId })
      .from(categories)
      .where(and(isNull(categories.deletedAt), eq(categories.kind, kind), eq(categories.name, name)))
      .orderBy(categories.archived)
      .all()
      .find((c) => parentId === undefined || c.parentId === parentId)?.id ?? null;
  switch (part) {
    case "Profit":
      return byName("Income", PROFIT_CATEGORY);
    case "Prize":
      return byName("Income", PRIZE_CATEGORY);
    case "Payout":
      return byName("Income", PAYOUT_CATEGORY);
    case "Tax":
      return byName("Expense", TAX_CATEGORY);
    case "Fee":
      return feesCategoryId(db);
    case "Premium": {
      const parent = byName("Expense", INSURANCE_CATEGORY, null);
      if (!parent || !policy || policy === "Other") return parent;
      return byName("Expense", policy, parent);
    }
    default:
      return null;
  }
}

function checkAccount(db: AppDb, id: string | null | undefined, field: string, current?: string): WalletRow {
  if (!id) throw new FieldError(field, "Choose the account the money goes from or to.");
  const wallet = find(db, "wallets", id);
  if (!wallet) throw new FieldError(field, "That wallet does not exist.");
  if (wallet.type === "Lent" || wallet.type === "Borrowed" || wallet.type === "Loan" || wallet.type === "Savings") throw new FieldError(field, "Choose one of your own wallets, like your bank account or bKash.");
  if (wallet.archived && id !== current) throw new FieldError(field, "That wallet is archived. Unarchive it to use it.");
  return wallet;
}

function entry(s: Pick<SavingRow, "id">, part: SavingPart, type: TransactionRow["type"], amount: number, from: string | null, to: string | null, categoryId: string | null, seq: number | null, at: string, note: string | null): TransactionRow {
  return {
    id: newId(), type, amount, fromWalletId: from, toWalletId: to, categoryId, personId: null, feeOfId: null, recurringRuleId: null, recurringDate: null,
    occurredAt: new Date(at).toISOString(), note, loanId: null, loanEmi: null, loanPart: null, savingId: s.id, savingSeq: seq, savingPart: part, updatedAt: "", deletedAt: null,
  };
}

/** The certificate tax that would apply with one more certificate of this amount: 5 % up to ৳5,00,000 in all, else 10 %. */
export function certificateTax(db: AppDb, amount: number): number {
  const held = listSavings(db).filter((s) => s.kind === "Certificate" && !s.closed).reduce((t, s) => t + s.balance, 0);
  return held + amount <= CERTIFICATE_LOW_TAX_LIMIT ? 500 : 1000;
}

export interface AddSavingInput {
  kind: SavingKind;
  name: string;
  provider: string | null;
  payFromWalletId: string | null;
  alreadyHeld: boolean;
  /** FDR, certificate: the sum. DPS: the instalment. Policy: the premium. Not used for bonds. */
  amount: number;
  bondCount: number;
  ratePoints: number;
  months: number;
  everyMonths: number;
  startDate: string;
  taxPoints: number | null;
  chargesPerYear: number;
  maturityAmount: number | null;
  cover: number | null;
  policy: PolicyType | null;
  policyNumber: string | null;
  insured: string | null;
  nominee: string | null;
  bondNumbers: string[];
  paidBefore: number;
  autoRecord: boolean;
  remind: boolean;
  renew: boolean;
}

const PROFIT_PERIODS = [0, 1, 3, 6, 12];
const PREMIUM_PERIODS = [1, 3, 6, 12];

/** As POST /api/savings: the saving, its Savings wallet, and the money's first move. Returns the id. */
export function addSaving(db: AppDb, input: AddSavingInput, now: Date = new Date()): string {
  const k = input.kind;
  const name = cleanText(input.name);
  if (!name || name.length > NAME_MAX) throw new FieldError("name", k === "Insurance" ? "Name the policy, like Life policy." : "Give it a name, like City Bank FDR.");
  for (const [field, value] of [["provider", input.provider], ["policyNumber", input.policyNumber], ["insured", input.insured], ["nominee", input.nominee]] as const) {
    if ((cleanText(value)?.length ?? 0) > NAME_MAX) throw new FieldError(field, `Use at most ${NAME_MAX} characters.`);
  }
  const account = checkAccount(db, input.payFromWalletId, "payFromWalletId");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new FieldError("startDate", k === "Dps" ? "Choose the date of the first instalment." : k === "Insurance" ? "Choose the date of the first premium." : "Choose the day it was opened.");
  let amount = input.amount;
  if (k === "PrizeBond") {
    if (!Number.isInteger(input.bondCount) || input.bondCount < 1 || input.bondCount > 100_000) throw new FieldError("bondCount", "Enter how many ৳100 bonds, 1 or more.");
    amount = input.bondCount * BOND_VALUE;
  } else if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    throw new FieldError("amount", k === "Dps" ? "Enter the monthly instalment, more than zero." : k === "Insurance" ? "Enter the premium, more than zero." : "Enter the amount, more than zero.");
  }
  if (!Number.isInteger(input.ratePoints) || input.ratePoints < 0 || input.ratePoints > 10_000) throw new FieldError("ratePoints", "Enter the profit rate, from 0 to 100 % a year.");
  let months = input.months;
  let every = input.everyMonths;
  let paidBefore = input.paidBefore;
  if (k === "Fdr" || k === "Certificate") {
    if (months < 1 || months > 600) throw new FieldError("months", "Choose the term, from 1 month.");
    if (!PROFIT_PERIODS.includes(every) || (every > 0 && months % every !== 0)) throw new FieldError("everyMonths", "Choose how often profit is paid; the term must be a whole number of those.");
    const payments = every > 0 ? months / every : 1;
    if (paidBefore < 0 || paidBefore >= payments) throw new FieldError("paidBefore", `Enter the profit payments already received, from 0 to ${payments - 1}.`);
    if (k === "Fdr") paidBefore = 0;
  } else if (k === "Dps") {
    if (months < 1 || months > 600) throw new FieldError("months", "Choose the term, from 1 month.");
    every = 1;
    if (paidBefore < 0 || paidBefore >= months) throw new FieldError("paidBefore", `Enter the instalments already paid, from 0 to ${months - 1}.`);
  } else if (k === "Insurance") {
    if (!PREMIUM_PERIODS.includes(every)) throw new FieldError("everyMonths", "Choose how often the premium is paid.");
    if (months < 0 || months > 600 || (months > 0 && months % every !== 0)) throw new FieldError("months", "Choose the term, or none for a policy that renews.");
    if (paidBefore < 0 || (months > 0 && paidBefore > months / every)) throw new FieldError("paidBefore", "Enter the premiums already paid.");
    if (!input.policy) throw new FieldError("policy", "Choose life, health, car or other.");
  } else {
    months = 0;
    every = 0;
    paidBefore = 0;
  }
  const tax = input.taxPoints ?? (k === "Fdr" || k === "Dps" ? 1000 : k === "PrizeBond" ? 2000 : k === "Certificate" ? certificateTax(db, amount) : 0);
  if (tax < 0 || tax > 10_000) throw new FieldError("taxPoints", "Enter the tax at source, from 0 to 100 %.");

  const id = newId(now);
  const walletId = k === "Insurance" ? null : newId(now);
  const held = input.alreadyHeld;
  const opening = k === "Dps" ? paidBefore * amount : k !== "Insurance" && held ? amount : 0;
  const bonds = [...new Set(input.bondNumbers.map((n) => n.trim()).filter(Boolean))].join("\n") || null;
  db.transaction((tx) => {
    if (walletId) {
      put(tx, "wallets", { id: walletId, type: "Savings", name, openingBalance: opening, creditLimit: null, personId: null, icon: null, color: null, archived: false, excludedFromTotal: false, sortOrder: 0, updatedAt: "", deletedAt: null }, now);
    }
    put(tx, "savings", {
      id, kind: k, name, provider: cleanText(input.provider), walletId, payFromWalletId: account.id, amount,
      ratePoints: k === "PrizeBond" || k === "Insurance" ? 0 : input.ratePoints, months, everyMonths: every, startDate: input.startDate,
      taxPoints: k === "Insurance" ? 0 : tax, chargesPerYear: k === "Fdr" ? input.chargesPerYear : 0, maturityAmount: k === "Dps" ? input.maturityAmount : null,
      cover: k === "Insurance" ? input.cover : null, policy: k === "Insurance" ? input.policy : null,
      policyNumber: k === "Insurance" ? cleanText(input.policyNumber) : null, insured: k === "Insurance" ? cleanText(input.insured) : null,
      nominee: k === "Insurance" ? cleanText(input.nominee) : null, bondNumbers: k === "PrizeBond" ? bonds : null, paidBefore,
      autoRecord: k === "Fdr" || ((k === "Dps" || k === "Certificate") && input.autoRecord), remind: k === "Insurance" && input.remind,
      renew: k === "Fdr" && input.renew, missed: null, seqBase: 0, closedOn: null, updatedAt: "", deletedAt: null,
    }, now);
    if (walletId && k !== "Dps" && !held) {
      // On the start date at 9 am, but never in the future.
      let at = atLocal(input.startDate);
      if (at > now.toISOString()) at = now.toISOString();
      put(tx, "transactions", entry({ id }, "Deposit", "Transfer", amount, account.id, walletId, null, null, at, k === "PrizeBond" ? `${amount / BOND_VALUE} prize bonds` : `${name} opened`), now);
    }
  });
  return id;
}

export interface UpdateSavingInput {
  name: string;
  provider: string | null;
  payFromWalletId: string;
  amount: number | null;
  ratePoints: number | null;
  taxPoints: number | null;
  chargesPerYear: number | null;
  maturityAmount: number | null;
  cover: number | null;
  policy: PolicyType | null;
  policyNumber: string | null;
  insured: string | null;
  nominee: string | null;
  bondNumbers: string[] | null;
  autoRecord: boolean | null;
  remind: boolean | null;
  renew: boolean | null;
}

/** As PUT /api/savings/{id}: a new rate or tax applies from the next payment. */
export function updateSaving(db: AppDb, id: string, input: UpdateSavingInput, now: Date = new Date()): void {
  const s = find(db, "savings", id);
  if (!s) throw new FieldError("saving", "That saving does not exist.");
  const name = cleanText(input.name);
  if (!name || name.length > NAME_MAX) throw new FieldError("name", "Give it a name.");
  checkAccount(db, input.payFromWalletId, "payFromWalletId", s.payFromWalletId);
  if (input.ratePoints !== null && (input.ratePoints < 0 || input.ratePoints > 10_000)) throw new FieldError("ratePoints", "Enter the profit rate, from 0 to 100 % a year.");
  if (input.taxPoints !== null && (input.taxPoints < 0 || input.taxPoints > 10_000)) throw new FieldError("taxPoints", "Enter the tax at source, from 0 to 100 %.");
  if (input.amount !== null && (input.amount <= 0 || input.amount > MAX_AMOUNT)) throw new FieldError("amount", "Enter an amount more than zero.");
  const k = s.kind;
  const next: SavingRow = {
    ...s,
    name,
    provider: cleanText(input.provider),
    payFromWalletId: input.payFromWalletId,
    ratePoints: k === "Fdr" || k === "Dps" || k === "Certificate" ? (input.ratePoints ?? s.ratePoints) : s.ratePoints,
    taxPoints: k !== "Insurance" ? (input.taxPoints ?? s.taxPoints) : s.taxPoints,
    amount: (k === "Dps" || k === "Insurance") && input.amount !== null ? input.amount : s.amount,
    chargesPerYear: k === "Fdr" ? (input.chargesPerYear ?? s.chargesPerYear) : s.chargesPerYear,
    renew: k === "Fdr" ? (input.renew ?? s.renew) : s.renew,
    maturityAmount: k === "Dps" ? input.maturityAmount : s.maturityAmount,
    autoRecord: k === "Dps" || k === "Certificate" ? (input.autoRecord ?? s.autoRecord) : s.autoRecord,
    bondNumbers: k === "PrizeBond" && input.bondNumbers ? [...new Set(input.bondNumbers.map((n) => n.trim()).filter(Boolean))].join("\n") || null : s.bondNumbers,
    cover: k === "Insurance" ? input.cover : s.cover,
    policy: k === "Insurance" ? (input.policy ?? s.policy) : s.policy,
    policyNumber: k === "Insurance" ? cleanText(input.policyNumber) : s.policyNumber,
    insured: k === "Insurance" ? cleanText(input.insured) : s.insured,
    nominee: k === "Insurance" ? cleanText(input.nominee) : s.nominee,
    remind: k === "Insurance" ? (input.remind ?? s.remind) : s.remind,
  };
  db.transaction((tx) => {
    put(tx, "savings", next, now);
    const wallet = s.walletId ? find(tx, "wallets", s.walletId) : undefined;
    if (wallet && wallet.name !== name) put(tx, "wallets", { ...wallet, name }, now);
  });
}

/** The saving first, then its rows and its wallet (the server does the same when the delete arrives). */
export function deleteSaving(db: AppDb, id: string, now: Date = new Date()): void {
  db.transaction((tx) => {
    const s = find(tx, "savings", id);
    if (!s) return;
    remove(tx, "savings", s, now);
    for (const t of tx.select().from(transactions).where(and(isNull(transactions.deletedAt), eq(transactions.savingId, id))).all()) remove(tx, "transactions", t, now);
    const wallet = s.walletId ? find(tx, "wallets", s.walletId) : undefined;
    if (wallet) remove(tx, "wallets", wallet, now);
  });
}

function open(db: AppDb, id: string, kinds: SavingKind[], walletId: string | null | undefined): { s: SavingView; account: WalletRow } {
  const s = savingView(db, id);
  if (!s) throw new FieldError("saving", "That saving does not exist.");
  if (!kinds.includes(s.kind)) throw new FieldError("saving", "That does not apply to this kind of saving.");
  if (s.closed) throw new FieldError("saving", "This is already closed.");
  return { s, account: checkAccount(db, walletId ?? s.payFromWalletId, "walletId", s.payFromWalletId) };
}

/** The next DPS instalment. */
export function payInstalment(db: AppDb, id: string, input: { walletId?: string | null; occurredAt: string }, now: Date = new Date()): void {
  const { s, account } = open(db, id, ["Dps"], input.walletId);
  const n = s.next?.number;
  if (!n || s.next?.action === "Close") throw new FieldError("saving", "Every instalment is recorded. Close the DPS to record what the bank paid.");
  db.transaction((tx) => put(tx, "transactions", entry(s, "Deposit", "Transfer", s.amount, account.id, s.walletId, null, n, input.occurredAt, `${s.name} instalment ${n}`), now));
}

/** Marks the next DPS instalment missed. */
export function skipInstalment(db: AppDb, id: string, now: Date = new Date()): void {
  const { s } = open(db, id, ["Dps"], null);
  const n = s.next?.number;
  if (!n) throw new FieldError("saving", "There is no instalment left to mark.");
  db.transaction((tx) => put(tx, "savings", { ...find(tx, "savings", id)!, missed: [...s.missedList, n].sort((a, b) => a - b).join(",") }, now));
}

/** A profit payment before maturity (FDR or certificate), with its tax at source. */
export function recordProfit(db: AppDb, id: string, input: { walletId?: string | null; profit: number | null; tax: number | null; occurredAt: string }, now: Date = new Date()): void {
  const { s, account } = open(db, id, ["Fdr", "Certificate"], input.walletId);
  if (s.everyMonths === 0 || s.profitDone >= periods(s) - 1) throw new FieldError("saving", "The next profit comes at maturity. Close it then to record what was paid.");
  const gross = input.profit ?? periodProfit(s);
  const tax = input.tax ?? taxOf(gross, s.taxPoints);
  if (!Number.isSafeInteger(gross) || gross <= 0 || gross > MAX_AMOUNT) throw new FieldError("profit", "Enter the profit before tax, more than zero.");
  if (!Number.isSafeInteger(tax) || tax < 0 || tax >= gross) throw new FieldError("tax", "The tax must be zero or more, and less than the profit.");
  const seq = s.seqBase + s.profitDone + 1;
  db.transaction((tx) => {
    put(tx, "transactions", entry(s, "Profit", "Income", gross, null, account.id, categoryFor(tx, "Profit"), seq, input.occurredAt, `${s.name} profit`), now);
    if (tax > 0) put(tx, "transactions", entry(s, "Tax", "Expense", tax, account.id, null, categoryFor(tx, "Tax"), seq, input.occurredAt, `${s.name} tax at source`), now);
  });
}

/** What a saving is expected to pay at maturity: the amount reaching the account, the tax and the charges. */
export function expected(s: SavingView): { received: number; tax: number; charges: number } {
  if (s.kind === "Dps") {
    const maturity = s.estimate ?? s.balance;
    const gain = Math.max(maturity - s.balance, 0);
    const tax = taxOf(gain, s.taxPoints);
    return { received: s.balance + gain - tax, tax, charges: 0 };
  }
  const gross = periodProfit(s);
  const tax = taxOf(gross, s.taxPoints);
  const charges = s.kind === "Fdr" ? excise(s.chargesPerYear, s.months) : 0;
  return { received: s.balance + gross - tax - charges, tax, charges };
}

/**
 * Closing at maturity or early: the money in it back to the account, the profit (what came back
 * beyond it, before tax), the tax and charges; anything short of the money in it is a charge.
 */
export function closeSaving(db: AppDb, id: string, input: { walletId?: string | null; received: number | null; tax: number | null; charges?: number | null; occurredAt: string }, now: Date = new Date()): void {
  const { s, account } = open(db, id, ["Fdr", "Dps", "Certificate"], input.walletId);
  const day = localDate(input.occurredAt);
  const matured = s.maturesOn !== null && day >= s.maturesOn;
  let received: number;
  let tax: number;
  let charges: number;
  if (input.received !== null) {
    if (!Number.isSafeInteger(input.received) || input.received < 0 || input.received > MAX_AMOUNT) throw new FieldError("received", "Enter what reached your account, zero or more.");
    received = input.received;
    tax = input.tax ?? 0;
    charges = input.charges ?? 0;
  } else if (matured) {
    ({ received, tax, charges } = expected(s));
  } else {
    throw new FieldError("received", "Enter what the bank paid you.");
  }
  if (tax < 0 || charges < 0) throw new FieldError(tax < 0 ? "tax" : "charges", "Enter zero or more.");
  const seq = matured && s.kind !== "Dps" ? s.seqBase + periods(s) : null;
  let gross = received + tax + charges - s.balance;
  let shortfall = 0;
  if (gross < 0) {
    shortfall = -gross;
    gross = 0;
    tax = 0;
  }
  db.transaction((tx) => {
    if (s.balance > 0 && s.walletId) put(tx, "transactions", entry(s, "Withdrawal", "Transfer", s.balance, s.walletId, account.id, null, null, input.occurredAt, `${s.name} paid out`), now);
    if (gross > 0) put(tx, "transactions", entry(s, "Profit", "Income", gross, null, account.id, categoryFor(tx, "Profit"), seq, input.occurredAt, `${s.name} profit`), now);
    if (tax > 0) put(tx, "transactions", entry(s, "Tax", "Expense", tax, account.id, null, categoryFor(tx, "Tax"), seq, input.occurredAt, `${s.name} tax at source`), now);
    if (charges + shortfall > 0)
      put(tx, "transactions", entry(s, "Fee", "Expense", charges + shortfall, account.id, null, categoryFor(tx, "Fee"), seq, input.occurredAt, shortfall > 0 ? "Early encashment charge" : "Excise duty"), now);
    put(tx, "savings", { ...find(tx, "savings", id)!, closedOn: day }, now);
  });
}

/** A prize bond prize: income before tax, and the tax taken at source. */
export function recordPrize(db: AppDb, id: string, input: { walletId?: string | null; prize: number; taxPoints: number | null; bond: string | null; occurredAt: string }, now: Date = new Date()): void {
  const { s, account } = open(db, id, ["PrizeBond"], input.walletId);
  if (!Number.isSafeInteger(input.prize) || input.prize <= 0 || input.prize > MAX_AMOUNT) throw new FieldError("prize", "Enter the prize, more than zero.");
  const points = input.taxPoints ?? s.taxPoints;
  if (points < 0 || points > 10_000) throw new FieldError("taxPoints", "Enter the tax, from 0 to 100 %.");
  const bond = cleanText(input.bond);
  const tax = taxOf(input.prize, points);
  db.transaction((tx) => {
    put(tx, "transactions", entry(s, "Prize", "Income", input.prize, null, account.id, categoryFor(tx, "Prize"), null, input.occurredAt, bond ? `Prize bond ${bond}` : "Prize bond prize"), now);
    if (tax > 0) put(tx, "transactions", entry(s, "Tax", "Expense", tax, account.id, null, categoryFor(tx, "Tax"), null, input.occurredAt, "Prize bond tax at source"), now);
  });
}

/** More bonds bought, with their numbers. */
export function addBonds(db: AppDb, id: string, input: { walletId?: string | null; bondCount: number; bondNumbers: string[]; occurredAt: string }, now: Date = new Date()): void {
  const { s, account } = open(db, id, ["PrizeBond"], input.walletId);
  if (!Number.isInteger(input.bondCount) || input.bondCount < 1 || input.bondCount > 100_000) throw new FieldError("bondCount", "Enter how many ৳100 bonds, 1 or more.");
  const numbers = [...new Set([...s.bondList, ...input.bondNumbers.map((n) => n.trim()).filter(Boolean)])].join("\n") || null;
  db.transaction((tx) => {
    put(tx, "savings", { ...find(tx, "savings", id)!, bondNumbers: numbers }, now);
    put(tx, "transactions", entry(s, "Deposit", "Transfer", input.bondCount * BOND_VALUE, account.id, s.walletId, null, null, input.occurredAt, `${input.bondCount} prize bonds`), now);
  });
}

/** Bonds sold back at ৳100 each; all of them closes it. */
export function sellBonds(db: AppDb, id: string, input: { walletId?: string | null; bondCount: number; occurredAt: string }, now: Date = new Date()): void {
  const { s, account } = open(db, id, ["PrizeBond"], input.walletId);
  if (!Number.isInteger(input.bondCount) || input.bondCount < 1 || input.bondCount > s.bondCount) throw new FieldError("bondCount", `Enter how many to sell back, from 1 to ${s.bondCount}.`);
  db.transaction((tx) => {
    put(tx, "transactions", entry(s, "Withdrawal", "Transfer", input.bondCount * BOND_VALUE, s.walletId, account.id, null, null, input.occurredAt, `${input.bondCount} prize bonds sold back`), now);
    if (input.bondCount === s.bondCount) put(tx, "savings", { ...find(tx, "savings", id)!, closedOn: localDate(input.occurredAt) }, now);
  });
}

/** The next premium of a policy, an expense under Insurance. */
export function payPremium(db: AppDb, id: string, input: { walletId?: string | null; amount?: number | null; occurredAt: string }, now: Date = new Date()): void {
  const { s, account } = open(db, id, ["Insurance"], input.walletId);
  const n = s.next?.number;
  if (!n) throw new FieldError("saving", "Every premium of this policy is paid.");
  const amount = input.amount ?? s.amount;
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) throw new FieldError("amount", "Enter the premium, more than zero.");
  db.transaction((tx) => put(tx, "transactions", entry(s, "Premium", "Expense", amount, account.id, null, categoryFor(tx, "Premium", s.policy), n, input.occurredAt, `${s.name} premium ${n}`), now));
}

/** A claim or the policy's maturity amount, as income; maturity closes it. */
export function recordPayout(db: AppDb, id: string, input: { walletId?: string | null; amount: number; kind: "Claim" | "Maturity"; occurredAt: string }, now: Date = new Date()): void {
  const { s, account } = open(db, id, ["Insurance"], input.walletId);
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > MAX_AMOUNT) throw new FieldError("amount", "Enter the amount paid to you, more than zero.");
  db.transaction((tx) => {
    put(tx, "transactions", entry(s, "Payout", "Income", input.amount, null, account.id, categoryFor(tx, "Payout"), null, input.occurredAt, input.kind === "Maturity" ? `${s.name} matured` : `${s.name} claim`), now);
    if (input.kind === "Maturity") put(tx, "savings", { ...find(tx, "savings", id)!, closedOn: localDate(input.occurredAt) }, now);
  });
}

/** Removes the latest numbered entry: a DPS instalment, a profit payment or a premium. */
export function undoLast(db: AppDb, id: string, now: Date = new Date()): void {
  const s = find(db, "savings", id);
  if (!s) throw new FieldError("saving", "That saving does not exist.");
  if (s.closedOn) throw new FieldError("saving", "This is closed. Delete it to start again.");
  const last = db
    .select({ n: sql<number | null>`max(${transactions.savingSeq})` })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), eq(transactions.savingId, id), sql`${transactions.savingSeq} > ${s.seqBase}`))
    .get()?.n;
  if (last == null) throw new FieldError("saving", "Nothing is recorded to undo yet.");
  db.transaction((tx) => {
    for (const t of tx.select().from(transactions).where(and(isNull(transactions.deletedAt), eq(transactions.savingId, id), eq(transactions.savingSeq, Number(last)))).all()) remove(tx, "transactions", t, now);
  });
}
