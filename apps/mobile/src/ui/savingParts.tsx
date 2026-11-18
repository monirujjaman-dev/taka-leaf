import { formatBdt, percent } from "@takaleaf/shared";
import type { IconName } from "./kit";
import { dateLabel } from "../data/calendar";
import type { SavingView } from "../data/savings";
import type { PolicyType, SavingKind } from "../db/schema";

export const KIND_LABEL: Record<SavingKind, string> = { Fdr: "FDR", Dps: "DPS", Certificate: "Sanchayapatra", PrizeBond: "Prize bonds", Insurance: "Insurance" };

const POLICY_ICON: Record<PolicyType, IconName> = { Life: "shield-check-outline", Health: "heart-pulse", Car: "car-outline", Other: "shield-outline" };

export function kindIcon(kind: SavingKind, policy: PolicyType | null = null): IconName {
  switch (kind) {
    case "Fdr":
      return "safe";
    case "Dps":
      return "piggy-bank-outline";
    case "Certificate":
      return "certificate-outline";
    case "PrizeBond":
      return "ticket-outline";
    default:
      return POLICY_ICON[policy ?? "Other"];
  }
}

/** "৳5,000" without poisha when there are none. */
export const wholeBdt = (poisha: number) => formatBdt(poisha).replace(/\.00$/, "");

export const everyWords = (months: number) => (months === 0 ? "at maturity" : months === 1 ? "every month" : months === 12 ? "every year" : `every ${months} months`);
export const premiumWords = (months: number) => (months === 1 ? "a month" : months === 3 ? "a quarter" : months === 12 ? "a year" : `every ${months} months`);
export const termWords = (months: number) => (months % 12 === 0 && months >= 24 ? `${months / 12} years` : `${months} ${months === 1 ? "month" : "months"}`);

/** The detail line under a saving's name, as the design lists them. */
export function subtitle(s: SavingView): string {
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

/** Progress for the list: the bar's percent (null: no bar), the words under it, and the pill. */
export function progress(s: SavingView): { percent: number | null; words: string; pill: string | null } {
  if (s.closed) return { percent: null, words: s.closedOn ? `Closed ${dateLabel(s.closedOn)}` : "Closed", pill: "Closed" };
  const next = s.next ? `Next ${dateLabel(s.next.date)}` : null;
  const pct = (a: number, b: number | null) => (b ? Math.round((a * 100) / b) : 0);
  switch (s.kind) {
    case "Fdr":
      return { percent: pct(s.daysDone, s.daysTotal), words: `${s.daysDone} of ${s.daysTotal} days`, pill: s.maturesOn ? `Matures ${dateLabel(s.maturesOn)}` : null };
    case "Dps":
      return { percent: pct(s.done, s.total), words: `${s.done} of ${s.total} instalments`, pill: s.next?.action === "Close" ? "Matured" : next };
    case "Certificate":
      return { percent: pct(s.daysDone, s.daysTotal), words: `${s.done} of ${s.total} profit payments`, pill: next };
    case "PrizeBond":
      return { percent: null, words: s.nextDraw ? `In the ${dateLabel(s.nextDraw)} draw` : "", pill: `${s.bondCount} bonds` };
    default:
      return { percent: s.total ? pct(s.done, s.total) : null, words: s.total ? `${s.done} of ${s.total} premiums paid` : `${s.done} premiums paid`, pill: next };
  }
}

/** "Instalment 23 · automatic from City Bank account" and the like, for Coming up and Home. */
export function nextDetail(s: SavingView): string {
  const n = s.next!;
  switch (s.kind) {
    case "Dps":
      return n.action === "Close" ? "Matured · record what the bank paid" : `${n.label} · ${s.autoRecord ? "automatic from" : "from"} ${s.payFromWalletName ?? "your account"}`;
    case "Fdr":
      return n.label === "Renews" ? `Renews for ${termWords(s.months)}` : `${n.label} · after ${percent(s.taxPoints)} tax`;
    case "Certificate":
      return `${n.label} · after ${percent(s.taxPoints)} tax`;
    case "PrizeBond":
      return s.bondsInDraw === s.bondCount ? `${s.bondCount} bonds in the draw` : `${s.bondsInDraw} of ${s.bondCount} bonds in the draw`;
    default:
      return s.graceEnds ? `${n.label} · grace to ${dateLabel(s.graceEnds)}` : `${n.label} · renews the policy`;
  }
}
