/**
 * Loan arithmetic, the same on the server (LoanMath.cs), the web and the phone. Amounts are integer
 * poisha. Rates are "rate points": hundredths of a percent a year, so 950 is 9.50 %. Interest is on
 * the reducing balance, as Bangladeshi banks charge it: each month's interest is the balance times
 * the yearly rate / 12, rounded half up to the poisha, and the rest of the EMI repays principal.
 * When less than ৳1 would be left after an EMI, that EMI takes it, so the loan ends on time.
 */

export const MAX_RATE_POINTS = 10_000;
export const MAX_LOAN_MONTHS = 600;

/** Less than this (৳1) left after an EMI is rounding, paid with that EMI. */
export const ROUNDING_SLACK = 100;

/** One month's interest on a balance. */
export function monthlyInterest(balance: number, ratePoints: number): number {
  if (balance <= 0 || ratePoints <= 0) return 0;
  // BigInt keeps very large balances exact: balance × points can pass 2^53.
  return Number((BigInt(balance) * BigInt(ratePoints) * BigInt(2) + BigInt(120_000)) / BigInt(240_000));
}

/** The equal monthly instalment that repays the principal in the given months. 0 % divides evenly. */
export function emiFor(principal: number, ratePoints: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (ratePoints <= 0) return Math.round(principal / months);
  const r = ratePoints / 120_000;
  const growth = (1 + r) ** months;
  return Math.round((principal * r * growth) / (growth - 1));
}

export interface Instalment {
  /** 1 for the first EMI of the loan. */
  number: number;
  principal: number;
  interest: number;
  total: number;
  balanceAfter: number;
}

/**
 * The instalments that repay a balance at this EMI, starting with EMI `firstNumber`. The last one
 * pays off what is left. Stops early (after `max`) if the EMI never covers the interest.
 */
export function schedule(balance: number, ratePoints: number, emi: number, firstNumber = 1, max = MAX_LOAN_MONTHS): Instalment[] {
  const rows: Instalment[] = [];
  let left = balance;
  while (left > 0 && rows.length < max) {
    const interest = monthlyInterest(left, ratePoints);
    let principal = Math.min(emi - interest, left);
    if (principal <= 0) break;
    // Rounding to the poisha leaves a few poisha after the last EMI: the last one takes them.
    if (left - principal < ROUNDING_SLACK) principal = left;
    left -= principal;
    rows.push({ number: firstNumber + rows.length, principal, interest, total: principal + interest, balanceAfter: left });
  }
  return rows;
}

/** What is still owed after `paid` EMIs on the original schedule (for loans already running). */
export function balanceAfter(principal: number, ratePoints: number, emi: number, paid: number): number {
  if (paid <= 0) return principal;
  const rows = schedule(principal, ratePoints, emi, 1, paid);
  return rows.length < paid ? 0 : rows[rows.length - 1]!.balanceAfter;
}

/** Interest on the original schedule's first `paid` EMIs. */
export function interestOfFirst(principal: number, ratePoints: number, emi: number, paid: number): number {
  return schedule(principal, ratePoints, emi, 1, paid).reduce((sum, row) => sum + row.interest, 0);
}

/** "9.5" or "9.50 %" → 950; null when it is not a rate from 0 to 100. */
export function parseRate(text: string): number | null {
  const cleaned = text.replace(/[%\s,]/g, "");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null;
  const points = Math.round(Number(cleaned) * 100);
  return points <= MAX_RATE_POINTS ? points : null;
}

/** 950 → "9.5%", 1025 → "10.25%", 0 → "0%". */
export function formatRate(points: number): string {
  return `${(points / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}
