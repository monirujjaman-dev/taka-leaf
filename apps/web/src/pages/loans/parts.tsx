import type { ReactNode } from "react";
import type { BankLoan } from "../../api/types";
import { localDate } from "../../ui/format";

/** Pills for state in words (never colour alone): due, paid, billed. */
export function Pill({ tone = "grey", children }: { tone?: "mint" | "amber" | "rust" | "grey"; children: ReactNode }) {
  const tones = {
    mint: "bg-[var(--tl-chip)] text-[var(--tl-primary)]",
    amber: "bg-[#FBF0D9] text-[#7A4F00] dark:bg-[#3A2E12] dark:text-[#F2C46D]",
    rust: "bg-[#F7E4DF] text-[#8E3522] dark:bg-[#3A1E17] dark:text-expense-dark",
    grey: "bg-[var(--tl-track)] text-[var(--tl-muted)]",
  };
  return <span className={`inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-caption font-bold ${tones[tone]}`}>{children}</span>;
}

/** "5 Dec" or "5 Dec 2027". */
export function dueLabel(day: string): string {
  const sameYear = day.slice(0, 4) === localDate().slice(0, 4);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** "Dec 2026". */
export function monthOfDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** Whole days from today to a local date (negative when past). */
export function daysUntil(day: string): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${localDate()}T00:00:00Z`)) / 86_400_000);
}

export function dueInWords(day: string): string {
  const days = daysUntil(day);
  if (days < 0) return `${-days} ${days === -1 ? "day" : "days"} late`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

/** How much of the principal is repaid, 0–100. */
export function repaidPercent(loan: Pick<BankLoan, "principal" | "outstanding">): number {
  return loan.principal > 0 ? Math.max(0, Math.min(100, Math.round(((loan.principal - loan.outstanding) * 100) / loan.principal))) : 0;
}

/** The loan's progress in words: "18 of 60 EMIs paid · 25% repaid" or "3 of 12 billed to the card". */
export function progressWords(loan: BankLoan): string {
  if (loan.closed) return loan.closedOn ? `Settled ${dueLabel(loan.closedOn)}` : "Paid off";
  const total = loan.paid + loan.left;
  return loan.type === "CardEmi" ? `${loan.paid} of ${total} billed to the card` : `${loan.paid} of ${total} EMIs paid · ${repaidPercent(loan)}% repaid`;
}

/** A white progress bar for the forest hero cards. */
export function HeroBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-[4px] bg-white/25" aria-hidden="true">
      <div className="h-full rounded-[4px] bg-white" style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
    </div>
  );
}

/** A small stat on a forest card: mint label above a white value. */
export function HeroStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-caption font-semibold text-mint">{label}</p>
      <p className="m-0 whitespace-nowrap text-body font-bold tabular-nums">{value}</p>
    </div>
  );
}

/** Principal (forest) and interest (amber) side by side; the legend says it in words. */
export function SplitBar({ principal, interest, height = 10 }: { principal: number; interest: number; height?: number }) {
  const share = principal + interest > 0 ? (principal * 100) / (principal + interest) : 100;
  return (
    <div className="flex overflow-hidden rounded-full" style={{ height }} aria-hidden="true">
      <div className="bg-forest dark:bg-sage" style={{ width: `${share}%` }} />
      <div className="flex-1 bg-[#D8A24A]" />
    </div>
  );
}

export function LegendDot({ amber = false }: { amber?: boolean }) {
  return <span aria-hidden="true" className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] ${amber ? "bg-[#D8A24A]" : "bg-forest dark:bg-sage"}`} />;
}

/** The design's toggle row: a real checkbox drawn as a switch, with its label and detail. */
export function SwitchRow({ label, detail, checked, onChange }: { label: string; detail?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-body font-bold">{label}</span>
        {detail ? <span className="block text-small text-[var(--tl-muted)]">{detail}</span> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative h-[26px] w-11 shrink-0 rounded-full bg-[var(--tl-track)] transition-colors peer-checked:bg-forest peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--tl-primary)] dark:peer-checked:bg-sage [&>span]:peer-checked:translate-x-[18px]"
      >
        <span className="absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow transition-transform" />
      </span>
    </label>
  );
}

/** Choose one of a few words: bank names, months. */
export function Chips({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option)}
            className={`h-10 cursor-pointer rounded-full border px-3.5 text-sm font-bold ${
              on ? "border-forest bg-forest text-white dark:border-sage dark:bg-sage dark:text-ink" : "border-[var(--tl-border)] bg-[var(--tl-surface)] text-[var(--tl-text)] hover:bg-[var(--tl-chip)]"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
