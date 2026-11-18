import { monthlyInterest } from "./loan";

/**
 * The arithmetic of savings, twin of Features/Savings/SavingMath.cs (same results to the poisha).
 * Amounts in poisha, rates and tax in hundredths of a percent; every division rounds half up.
 */

export const BOND_VALUE = 10_000;
export const DRAW_HOLD_DAYS = 60;
export const GRACE_DAYS = 30;
/** The prizes of each ৳100 prize bond draw, per series, 1st to 5th. */
export const PRIZES = [60_000_000, 32_500_000, 10_000_000, 5_000_000, 1_000_000] as const;
/** Certificates: 5 % tax while all of them come to ৳5,00,000 or less, else 10 %. */
export const CERTIFICATE_LOW_TAX_LIMIT = 50_000_000;

const halfUp = (num: bigint, den: bigint) => Number((num * 2n + den) / (den * 2n));

/** Simple profit on a sum for some months: principal × rate × months / 12, rounded half up. */
export function profit(principal: number, ratePoints: number, months: number): number {
  if (principal <= 0 || ratePoints <= 0 || months <= 0) return 0;
  return halfUp(BigInt(principal) * BigInt(ratePoints) * BigInt(months), 120_000n);
}

/** Tax at source on an amount: amount × points / 10,000, rounded half up (1000 = 10 %). */
export function taxOf(amount: number, taxPoints: number): number {
  if (amount <= 0 || taxPoints <= 0) return 0;
  return halfUp(BigInt(amount) * BigInt(taxPoints), 10_000n);
}

/** A DPS at maturity: each month the instalment goes in, then a month's interest on the whole is added. */
export function dpsMaturity(instalment: number, ratePoints: number, months: number): number {
  let balance = 0;
  for (let i = 0; i < months; i++) {
    balance += instalment;
    balance += monthlyInterest(balance, ratePoints);
  }
  return balance;
}

/** The bank's excise duty over a term: the yearly duty for each year or part year. */
export const excise = (perYear: number, months: number) => (perYear <= 0 ? 0 : perYear * Math.max(1, Math.floor((months + 11) / 12)));

/** The next ৳100 prize bond draw on or after a day (yyyy-mm-dd): 31 Jan, 30 Apr, 31 Jul, 31 Oct. */
export function nextDraw(from: string): string {
  const year = Number(from.slice(0, 4));
  for (const y of [year, year + 1]) {
    for (const d of [`${y}-01-31`, `${y}-04-30`, `${y}-07-31`, `${y}-10-31`]) if (d >= from) return d;
  }
  return `${year + 1}-01-31`;
}

/** Bonds bought after this day wait for the draw after. */
export function drawCutoff(draw: string): string {
  const d = new Date(`${draw}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - DRAW_HOLD_DAYS);
  return d.toISOString().slice(0, 10);
}

/** The tax year (1 July to 30 June) a day falls in, by its first day. */
export function taxYearStart(day: string): string {
  const y = Number(day.slice(0, 4));
  return Number(day.slice(5, 7)) >= 7 ? `${y}-07-01` : `${y - 1}-07-01`;
}

/** Points as a short percent: 975 → "9.75%", 500 → "5%". */
export const percent = (points: number) => `${Number((points / 100).toFixed(2))}%`;
