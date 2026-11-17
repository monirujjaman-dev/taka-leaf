import { formatBdt } from "@takaleaf/shared";
import { useState } from "react";
import { useRecurring } from "../../api/queries";
import type { RecurringRule } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { Icon } from "../../ui/Icon";
import { iconButtonClass } from "../../ui/Parts";
import { Button, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf, LoadError } from "../../ui/Feedback";
import { dayLabel, scheduleLabel } from "../../ui/format";
import { DueList, ruleTitle } from "./DueList";
import { RecurringForm } from "./RecurringForm";

const TONE = { Income: "text-forest dark:text-income-dark", Expense: "text-expense dark:text-expense-dark", Transfer: "" } as const;

function status(rule: RecurringRule): string {
  if (rule.nextDate === null) return "Ended";
  if (rule.paused) return "Paused";
  return `Next ${dayLabel(rule.nextDate)}`;
}

export function RecurringPage() {
  const rules = useRecurring();
  const [editing, setEditing] = useState<RecurringRule | "new" | null>(null);
  const all = rules.data ?? [];
  const due = all.filter((r) => r.dueCount > 0);

  return (
    <>
      <PageHeader
        title="Recurring"
        back="/settings"
        phoneAction={
          <button type="button" aria-label="Add recurring" onClick={() => setEditing("new")} className={iconButtonClass}>
            <Icon name="plus" size={20} />
          </button>
        }
      >
        <Button onClick={() => setEditing("new")}>
          <Icon name="plus" size={18} /> Add recurring
        </Button>
      </PageHeader>
      <p className="mb-3 mt-0 text-sm text-[var(--tl-muted)] lg:-mt-3 lg:mb-5">Rent, salary, subscriptions — anything that repeats.</p>

      {rules.isPending ? <Loading /> : null}
      <LoadError query={rules} />

      {due.length > 0 ? (
        <section className="glass mb-4 rounded-[22px] p-4" aria-labelledby="due-title">
          <h2 id="due-title" className="m-0 mb-3 text-base font-extrabold">
            Due to record
          </h2>
          <DueList rules={due} />
        </section>
      ) : null}

      {rules.isSuccess && all.length === 0 ? (
        <section className="glass rounded-[22px]">
          <EmptyState title="Nothing repeating yet">
            <p className="m-0 max-w-sm text-sm text-[var(--tl-muted)]">Add your house rent or salary once, and TakaLeaf reminds you — or records it for you — every time.</p>
          </EmptyState>
        </section>
      ) : null}

      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
        {all.map((rule) => (
          <li key={rule.id}>
            <button
              type="button"
              onClick={() => setEditing(rule)}
              className={`glass flex w-full cursor-pointer items-start gap-3 rounded-[20px] p-4 text-left ${focusRing} ${rule.paused || rule.nextDate === null ? "opacity-60" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-extrabold">{ruleTitle(rule)}</span>
                <span className="block text-[13px] text-[var(--tl-muted)]">
                  {scheduleLabel(rule.frequency, rule.interval)} · {status(rule)}
                </span>
                <span className="mt-1 block truncate text-[13px] text-[var(--tl-muted)]">
                  {rule.type === "Transfer" ? `${rule.fromWalletName} → ${rule.toWalletName}` : rule.type === "Income" ? `Into ${rule.toWalletName}` : `From ${rule.fromWalletName}`}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`block text-base font-extrabold ${TONE[rule.type]}`}>{formatBdt(rule.amount)}</span>
                <span className="mt-1 inline-block rounded-full bg-[var(--tl-chip)] px-2 py-0.5 text-[12px] font-bold text-[var(--tl-primary)]">
                  {rule.autoRecord ? "Automatic" : "Ask me"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {editing ? <RecurringForm rule={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
