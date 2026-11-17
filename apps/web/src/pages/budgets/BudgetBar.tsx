import { formatBdt } from "@takaleaf/shared";
import type { Budget } from "../../api/types";

/* Its own file, so the dashboard and reports can show a budget without loading the Budgets page. */

const BAR = { OnTrack: "bg-leaf", Near: "bg-budget-near", Over: "bg-expense dark:bg-expense-dark" } as const;

/** "৳2,160 left · 82%", "Fully used · 100%" or "Over by ৳200 · 104%". */
function budgetLine(budget: Budget): string {
  if (budget.remaining < 0) return `Over by ${formatBdt(-budget.remaining)} · ${budget.percent}%`;
  if (budget.remaining === 0) return `Fully used · ${budget.percent}%`;
  return `${formatBdt(budget.remaining)} left · ${budget.percent}%${budget.status === "Near" ? " · close to the limit" : ""}`;
}

export function BudgetBar({ budget }: { budget: Budget }) {
  return (
    <span className="mt-1.5 flex flex-col gap-1.5">
      <span className="block h-2 overflow-hidden rounded-[4px] bg-[var(--tl-track)]" aria-hidden="true">
        <span className={`block h-full rounded-[4px] ${BAR[budget.status]}`} style={{ width: `${Math.min(Math.max(budget.percent, 2), 100)}%` }} />
      </span>
      <span
        className={`block text-[12px] ${budget.status === "Over" ? "font-bold text-expense dark:text-expense-dark" : "font-medium text-[var(--tl-muted)]"}`}
      >
        {budgetLine(budget)}
      </span>
    </span>
  );
}
