import { formatBdt } from "@takaleaf/shared";
import type { Transaction, WalletType } from "../api/types";

/** TakaLeaf counts days in Bangladesh time, the same as the backend (App:TimeZone). */
export const TIME_ZONE = "Asia/Dhaka";

const parts = (date: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

/** "2026-11-16" for a moment, in Bangladesh time. */
export function localDate(date: Date = new Date()): string {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** "2026-11" for a moment, in Bangladesh time. */
export function localMonth(date: Date = new Date()): string {
  return localDate(date).slice(0, 7);
}

/** Value for an <input type="datetime-local">, in Bangladesh time. */
export function toLocalInput(iso: string | Date): string {
  const p = parts(typeof iso === "string" ? new Date(iso) : iso);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Reads an <input type="datetime-local"> value as Bangladesh time (UTC+6, no daylight saving). */
export function fromLocalInput(value: string): string {
  return new Date(`${value}:00+06:00`).toISOString();
}

export function shiftMonth(month: string, by: number): string {
  const [year = 2026, number = 1] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}

export function lastDayOf(month: string): string {
  const [year = 2026, number = 1] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function dayLabel(day: string): string {
  const today = localDate();
  const yesterday = localDate(new Date(Date.now() - 86_400_000));
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  if (day === localDate(new Date(Date.now() + 86_400_000))) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

export function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TIME_ZONE }).format(new Date(iso));
}

/** Amount with a sign that says which way the money went: +৳500.00 in, −৳500.00 out. */
export function signedAmount(transaction: Pick<Transaction, "type" | "amount">): string {
  if (transaction.type === "Income") return `+${formatBdt(transaction.amount)}`;
  if (transaction.type === "Expense") return formatBdt(-transaction.amount);
  return formatBdt(transaction.amount);
}

/** Poisha as typed text for an amount field: 125050 -> "1250.50". */
export function toAmountText(poisha: number | null | undefined): string {
  if (poisha === null || poisha === undefined) return "";
  const taka = Math.floor(Math.abs(poisha) / 100);
  const rest = Math.abs(poisha) % 100;
  return rest === 0 ? String(taka) : `${taka}.${String(rest).padStart(2, "0")}`;
}

export const WALLET_TYPE_LABEL: Record<WalletType, string> = {
  Cash: "Cash",
  Bank: "Bank account",
  CreditCard: "Credit card",
  Mfs: "Mobile banking",
  Lent: "Lent",
  Borrowed: "Borrowed",
};

const UNIT = { Daily: "day", Weekly: "week", Monthly: "month", Yearly: "year" } as const;

/** "Every month", "Every 2 weeks". */
export function scheduleLabel(frequency: keyof typeof UNIT, interval: number): string {
  return interval === 1 ? `Every ${UNIT[frequency]}` : `Every ${interval} ${UNIT[frequency]}s`;
}

/** Short amount for chart labels: ৳950, 48k, 1.2L (lakh), 3.4Cr (crore). */
export function compactTaka(poisha: number): string {
  const taka = Math.round(Math.abs(poisha) / 100);
  const sign = poisha < 0 ? "−" : "";
  const short = (n: number) => (n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString());
  if (taka >= 1_00_00_000) return `${sign}${short(taka / 1_00_00_000)}Cr`;
  if (taka >= 1_00_000) return `${sign}${short(taka / 1_00_000)}L`;
  if (taka >= 1_000) return `${sign}${short(taka / 1_000)}k`;
  return `${sign}৳${taka}`;
}

export function shortMonth(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}
