/**
 * Local days and months, Asia/Dhaka (UTC+6, no daylight saving), as LocalCalendar on the server.
 * Times are stored in UTC; "2026-11-30T19:00:00Z" is 1 December in Dhaka.
 */
const OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => n.toString().padStart(2, "0");

/** The local date of a moment, "yyyy-MM-dd". */
export function localDate(moment: string | Date): string {
  const local = new Date(new Date(moment).getTime() + OFFSET_MS);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

export const today = (now: Date = new Date()) => localDate(now);

/** "yyyy-MM" of a moment or a date. */
export const monthOf = (moment: string | Date) => (typeof moment === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(moment) ? moment.slice(0, 7) : localDate(moment).slice(0, 7));

/** The UTC moment a local date begins, as an ISO string. */
export function startOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - OFFSET_MS).toISOString();
}

/** A local date and time ("09:00") as a UTC ISO string. */
export function atLocal(date: string, time = "09:00"): string {
  const [h, min] = time.split(":").map(Number) as [number, number];
  return new Date(new Date(startOf(date)).getTime() + (h * 60 + min) * 60_000).toISOString();
}

export function addDays(date: string, days: number): string {
  return localDate(new Date(new Date(startOf(date)).getTime() + days * DAY_MS));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Adds months the .NET way: the day is kept, or becomes the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${pad(month)}-${pad(Math.min(d, daysInMonth(year, month)))}`;
}

export const addYears = (date: string, years: number) => addMonths(date, years * 12);

export function shiftMonth(month: string, by: number): string {
  return addMonths(`${month}-01`, by).slice(0, 7);
}

/** [from, to) in UTC ISO strings for a local month "yyyy-MM". */
export function monthRange(month: string): { from: string; to: string } {
  return { from: startOf(`${month}-01`), to: startOf(`${shiftMonth(month, 1)}-01`) };
}

export function yearRange(year: number): { from: string; to: string } {
  return { from: startOf(`${year}-01-01`), to: startOf(`${year + 1}-01-01`) };
}

/** "November 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Nov 2026" */
export const shortMonthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]!.slice(0, 3)} ${y}`;
};

/** "15 Nov 2026", or "15 Nov" in the current year. */
export function dateLabel(date: string, now: Date = new Date()): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const short = `${d} ${MONTHS[m - 1]!.slice(0, 3)}`;
  return String(y) === today(now).slice(0, 4) ? short : `${short} ${y}`;
}

/** "Today · 15 Nov", "Yesterday · 14 Nov", "Mon · 10 Nov". */
export function dayLabel(date: string, now: Date = new Date()): string {
  const current = today(now);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${date}T00:00:00Z`).getUTCDay()];
  const prefix = date === current ? "Today" : date === addDays(current, -1) ? "Yesterday" : weekday;
  return `${prefix} · ${dateLabel(date, now)}`;
}

/** "9:10 am" in local time. */
export function timeLabel(moment: string): string {
  const local = new Date(new Date(moment).getTime() + OFFSET_MS);
  const h = local.getUTCHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(local.getUTCMinutes())} ${h < 12 ? "am" : "pm"}`;
}

/** "09:10" in local time, for time fields. */
export function localTime(moment: string): string {
  const local = new Date(new Date(moment).getTime() + OFFSET_MS);
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}
