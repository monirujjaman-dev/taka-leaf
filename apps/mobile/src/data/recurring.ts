import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { recurringRules, type Frequency, type RecurringRuleRow, type TransactionType } from "../db/schema";
import type { AppDb } from "../db/types";
import { addDays, addMonths, addYears, atLocal, today } from "./calendar";
import { newId } from "./ids";
import { checkTransaction } from "./transactions";
import { cleanText, FieldError, find, put, remove } from "./write";

export const MAX_INTERVAL = 366;

/** The n-th date (0 = the start), as RecurringRules.DateFor: monthly and yearly keep the start's day where the month has it. */
export function dateFor(frequency: Frequency, interval: number, start: string, n: number): string {
  switch (frequency) {
    case "Daily":
      return addDays(start, n * interval);
    case "Weekly":
      return addDays(start, n * interval * 7);
    case "Monthly":
      return addMonths(start, n * interval);
    default:
      return addYears(start, n * interval);
  }
}

export const ended = (rule: Pick<RecurringRuleRow, "endDate" | "nextDate">) => rule.endDate != null && rule.nextDate > rule.endDate;

/** How many dates are due up to today (0 when paused or ended), counting at most 99. */
export function dueCount(rule: RecurringRuleRow, day: string = today()): number {
  if (rule.paused) return 0;
  let count = 0;
  let n = rule.occurrences;
  let date = rule.nextDate;
  while (date <= day && (rule.endDate == null || date <= rule.endDate) && count < 99) {
    count++;
    n++;
    date = dateFor(rule.frequency, rule.interval, rule.startDate, n);
  }
  return count;
}

export function listRules(db: AppDb): RecurringRuleRow[] {
  return db.select().from(recurringRules).where(isNull(recurringRules.deletedAt)).orderBy(asc(recurringRules.nextDate)).all();
}

/** Rules waiting to be recorded or skipped today, oldest date first. */
export function dueRules(db: AppDb, day: string = today()): RecurringRuleRow[] {
  return db
    .select()
    .from(recurringRules)
    .where(and(isNull(recurringRules.deletedAt), eq(recurringRules.paused, false), lte(recurringRules.nextDate, day)))
    .orderBy(asc(recurringRules.nextDate))
    .all()
    .filter((r) => !ended(r));
}

export interface RecurringInput {
  id?: string;
  type: TransactionType;
  amount: number;
  fromWalletId: string | null;
  toWalletId: string | null;
  categoryId: string | null;
  note: string | null;
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  autoRecord: boolean;
}

/** As RecurringRules.Apply: changing the schedule carries on from where the old one had reached. */
export function saveRule(db: AppDb, input: RecurringInput, now: Date = new Date()): string {
  const existing = find(db, "recurringRules", input.id);
  checkTransaction(db, { ...input, occurredAt: now.toISOString() }, existing ? { ...existing, personId: null, feeOfId: null, recurringRuleId: null, recurringDate: null, occurredAt: "", loanId: null, loanEmi: null, loanPart: null, savingId: null, savingSeq: null, savingPart: null } : undefined);
  if (!Number.isInteger(input.interval) || input.interval < 1 || input.interval > MAX_INTERVAL) throw new FieldError("interval", `Repeat every 1 to ${MAX_INTERVAL}.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) throw new FieldError("startDate", "Choose the first date.");
  if (input.endDate && input.endDate < input.startDate) throw new FieldError("endDate", "The last date must be on or after the first.");

  let occurrences = 0;
  let nextDate = input.startDate;
  if (existing) {
    occurrences = existing.occurrences;
    nextDate = existing.nextDate;
    if (existing.frequency !== input.frequency || existing.interval !== input.interval || existing.startDate !== input.startDate) {
      let n = 0;
      while (dateFor(input.frequency, input.interval, input.startDate, n) < existing.nextDate && n < 100_000) n++;
      occurrences = n;
      nextDate = dateFor(input.frequency, input.interval, input.startDate, n);
    }
  }
  const id = input.id ?? newId(now);
  db.transaction((tx) => {
    put(tx, "recurringRules", {
      id,
      type: input.type,
      amount: input.amount,
      fromWalletId: input.type === "Income" ? null : input.fromWalletId,
      toWalletId: input.type === "Expense" ? null : input.toWalletId,
      categoryId: input.type === "Transfer" ? null : input.categoryId,
      note: cleanText(input.note),
      frequency: input.frequency,
      interval: input.interval,
      startDate: input.startDate,
      endDate: input.endDate,
      occurrences,
      nextDate,
      autoRecord: input.autoRecord,
      paused: existing?.paused ?? false,
      updatedAt: "",
      deletedAt: null,
    }, now);
  });
  return id;
}

const advanced = (rule: RecurringRuleRow): RecurringRuleRow => ({
  ...rule,
  occurrences: rule.occurrences + 1,
  nextDate: dateFor(rule.frequency, rule.interval, rule.startDate, rule.occurrences + 1),
});

/**
 * Records the rule's next date as a transaction (at 9 am local unless a time is given) and moves the
 * rule on. If the server recorded the same date meanwhile, sync keeps the server's and drops this one.
 */
export function recordNext(db: AppDb, ruleId: string, options: { amount?: number; occurredAt?: string } = {}, now: Date = new Date()): string {
  const rule = find(db, "recurringRules", ruleId);
  if (!rule) throw new FieldError("rule", "That recurring transaction does not exist.");
  if (ended(rule)) throw new FieldError("rule", "This recurring transaction has ended.");
  const amount = options.amount ?? rule.amount;
  const occurredAt = options.occurredAt ?? atLocal(rule.nextDate);
  checkTransaction(db, { ...rule, amount, occurredAt });
  const id = newId(now);
  db.transaction((tx) => {
    put(tx, "transactions", {
      id,
      type: rule.type,
      amount,
      fromWalletId: rule.fromWalletId,
      toWalletId: rule.toWalletId,
      categoryId: rule.categoryId,
      personId: null,
      feeOfId: null,
      recurringRuleId: rule.id,
      recurringDate: rule.nextDate,
      loanId: null,
      loanEmi: null,
      loanPart: null,
      savingId: null,
      savingSeq: null,
      savingPart: null,
      occurredAt: new Date(occurredAt).toISOString(),
      note: rule.note,
      updatedAt: "",
      deletedAt: null,
    }, now);
    put(tx, "recurringRules", advanced(rule), now);
  });
  return id;
}

export function skipNext(db: AppDb, ruleId: string, now: Date = new Date()): void {
  db.transaction((tx) => {
    const rule = find(tx, "recurringRules", ruleId);
    if (!rule) return;
    if (ended(rule)) throw new FieldError("rule", "This recurring transaction has ended.");
    put(tx, "recurringRules", advanced(rule), now);
  });
}

export function setRulePaused(db: AppDb, ruleId: string, paused: boolean, now: Date = new Date()): void {
  db.transaction((tx) => {
    const rule = find(tx, "recurringRules", ruleId);
    if (rule) put(tx, "recurringRules", { ...rule, paused }, now);
  });
}

export function deleteRule(db: AppDb, ruleId: string, now: Date = new Date()): void {
  db.transaction((tx) => {
    const rule = find(tx, "recurringRules", ruleId);
    if (rule) remove(tx, "recurringRules", rule, now);
  });
}

/** "Every month", "Every 2 weeks". */
export function scheduleLabel(rule: Pick<RecurringRuleRow, "frequency" | "interval">): string {
  const unit = { Daily: "day", Weekly: "week", Monthly: "month", Yearly: "year" }[rule.frequency];
  return rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`;
}
