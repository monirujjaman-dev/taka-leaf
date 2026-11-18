import { formatBdt, percent } from "@takaleaf/shared";
import type { ComingUp, PolicyType, Saving, SavingKind } from "../../api/types";
import type { IconName } from "../../ui/Icon";
import { IconTile } from "../../ui/Parts";
import { dueLabel } from "../loans/parts";

export { dueLabel, dueInWords, HeroBar, HeroStat, Pill, SwitchRow, Chips } from "../loans/parts";

type Tone = "primary" | "gold" | "blue";

export const KIND_LABEL: Record<SavingKind, string> = { Fdr: "FDR", Dps: "DPS", Certificate: "Sanchayapatra", PrizeBond: "Prize bonds", Insurance: "Insurance" };

const POLICY_ICON: Record<PolicyType, IconName> = { Life: "shield", Health: "heart", Car: "car", Other: "shield" };

/** The design's icon and colour for a kind: green deposits, gold certificates and bonds, blue policies. */
export function kindLook(kind: SavingKind, policy: PolicyType | null = null): { icon: IconName; tone: Tone } {
  switch (kind) {
    case "Fdr":
      return { icon: "safe", tone: "primary" };
    case "Dps":
      return { icon: "coins", tone: "primary" };
    case "Certificate":
      return { icon: "certificate", tone: "gold" };
    case "PrizeBond":
      return { icon: "ticket", tone: "gold" };
    default:
      return { icon: POLICY_ICON[policy ?? "Other"], tone: "blue" };
  }
}

export function KindIcon({ item, size = 40 }: { item: Pick<Saving | ComingUp, "kind" | "policy">; size?: 36 | 40 }) {
  const look = kindLook(item.kind, item.policy);
  return <IconTile icon={look.icon} tone={look.tone} size={size} />;
}

/** "at maturity", "every 3 months", "every year". */
export function everyWords(months: number): string {
  if (months === 0) return "at maturity";
  if (months === 1) return "every month";
  if (months === 12) return "every year";
  return `every ${months} months`;
}

/** Premiums: "a month", "a quarter", "every 6 months", "a year". */
export function premiumWords(months: number): string {
  return months === 1 ? "a month" : months === 3 ? "a quarter" : months === 12 ? "a year" : `every ${months} months`;
}

/** "12 months", "5 years". */
export function termWords(months: number): string {
  return months % 12 === 0 && months >= 24 ? `${months / 12} years` : `${months} ${months === 1 ? "month" : "months"}`;
}

/** The detail line under a saving's name, as the design lists them. */
export function subtitle(s: Saving): string {
  switch (s.kind) {
    case "Fdr":
      return `${percent(s.ratePoints)} · ${termWords(s.months)} · profit ${everyWords(s.everyMonths)}`;
    case "Dps":
      return `${wholeBdt(s.amount)} a month · ${percent(s.ratePoints)} · ${termWords(s.months)}`;
    case "Certificate":
      return `${percent(s.ratePoints)} · profit ${everyWords(s.everyMonths)}`;
    case "PrizeBond":
      return `${s.bondCount} bonds of ৳100${s.profitReceived > 0 ? " · has won" : ""}`;
    default:
      return `${s.provider ?? s.policy ?? "Policy"} · ${wholeBdt(s.amount)} ${premiumWords(s.everyMonths)}`;
  }
}

/** Progress for the list: the bar's share (null: no bar), the words under it, and the pill. */
export function progress(s: Saving): { share: number | null; words: string; pill: string | null } {
  if (s.closed) return { share: null, words: s.closedOn ? `Closed ${dueLabel(s.closedOn)}` : "Closed", pill: "Closed" };
  const next = s.next ? `Next ${dueLabel(s.next.date)}` : null;
  switch (s.kind) {
    case "Fdr":
      return { share: s.daysTotal ? s.daysDone / s.daysTotal : 0, words: `${s.daysDone} of ${s.daysTotal} days`, pill: s.maturesOn ? `Matures ${dueLabel(s.maturesOn)}` : null };
    case "Dps":
      return { share: s.total ? s.done / s.total : 0, words: `${s.done} of ${s.total} instalments`, pill: s.next?.action === "Close" ? "Matured" : next };
    case "Certificate":
      return { share: s.daysTotal ? s.daysDone / s.daysTotal : 0, words: `${s.done} of ${s.total} profit payments`, pill: next };
    case "PrizeBond":
      return { share: null, words: s.nextDraw ? `In the ${dueLabel(s.nextDraw)} draw` : "", pill: `${s.bondCount} bonds` };
    default:
      return { share: s.total ? s.done / s.total : null, words: s.total ? `${s.done} of ${s.total} premiums paid` : `${s.done} premiums paid`, pill: next };
  }
}

/** A day as the design's date badge: the number over the month. */
export function DateBadge({ date }: { date: string }) {
  return (
    <span className="w-11 shrink-0 text-center" aria-hidden="true">
      <span className="block text-lg font-extrabold leading-tight">{Number(date.slice(8))}</span>
      <span className="block text-caption font-bold uppercase text-[var(--tl-muted)]">{dueLabel(date).split(" ")[1]}</span>
    </span>
  );
}

/** One line of a breakdown: label left, amount right, rust when it is taken away. */
export function Line({ label, value, tone, strong = false }: { label: string; value: string; tone?: "income" | "expense"; strong?: boolean }) {
  const color = tone === "income" ? "text-[var(--tl-primary)]" : tone === "expense" ? "text-expense dark:text-expense-dark" : "";
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-[var(--tl-border)] last:border-b-0">
      <dt className="text-body text-[var(--tl-muted)]">{label}</dt>
      <dd className={`m-0 text-right tabular-nums ${strong ? "text-base font-extrabold" : "text-body font-bold"} ${color}`}>{value}</dd>
    </div>
  );
}

/** "৳5,000" when there are no poisha, else "৳13,110.50". */
export const wholeBdt = (poisha: number) => formatBdt(poisha).replace(/\.00$/, "");

/** "−৳4,875.00" for a deduction. */
export const minus = (poisha: number) => `−${formatBdt(poisha)}`;

/** Today's date in yyyy-mm-dd for date fields. */
export { localDate as today } from "../../ui/format";
