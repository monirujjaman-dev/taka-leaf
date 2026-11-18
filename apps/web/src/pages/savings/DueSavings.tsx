import { useState } from "react";
import { Link } from "react-router";
import { useSavingAction, useSavings } from "../../api/queries";
import type { ComingUp, Saving } from "../../api/types";
import { Button, focusRing } from "../../ui/Button";
import { ErrorNote, messageOf } from "../../ui/Feedback";
import { localDate } from "../../ui/format";
import { CloseForm, ProfitForm } from "./SavingForms";
import { dueInWords, dueLabel, KindIcon, wholeBdt } from "./parts";

export const DUE_SOON_DAYS = 7;

/**
 * What to record by hand within a week (or late), for the dashboard: DPS instalments the bank
 * does not take itself, certificate profit not set to automatic, matured savings, and premiums of
 * policies with a reminder.
 */
export function DueSavings() {
  const savings = useSavings();
  const soon = localDate(new Date(Date.now() + DUE_SOON_DAYS * 86_400_000));
  const byId = new Map((savings.data?.savings ?? []).map((s) => [s.id, s]));
  const due = (savings.data?.comingUp ?? []).filter((c) => {
    const s = byId.get(c.savingId);
    if (!s || c.date > soon) return false;
    return c.action === "Record" || c.action === "Close" || (c.action === "Pay" && s.remind);
  });
  if (due.length === 0) return null;
  return (
    <section className="glass rounded-[22px] p-4 lg:col-span-2" aria-labelledby="savings-due-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="savings-due-title" className="m-0 text-base font-extrabold">
          Savings and premiums due
        </h2>
        <Link to="/savings" className={`text-small font-bold text-[var(--tl-primary)] ${focusRing}`}>
          Savings
        </Link>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {due.map((c) => (
          <DueItem key={`${c.savingId}-${c.label}`} item={c} saving={byId.get(c.savingId)!} />
        ))}
      </ul>
    </section>
  );
}

function DueItem({ item, saving }: { item: ComingUp; saving: Saving }) {
  const action = useSavingAction(saving.id, item.action === "Pay" ? "premium" : "deposit");
  const [form, setForm] = useState<"profit" | "close" | null>(null);
  const label = item.action === "Pay" ? "Pay" : item.action === "Close" ? "Record" : "Record";
  function act() {
    if (item.action === "Close") setForm("close");
    else if (saving.kind === "Certificate") setForm("profit");
    else action.mutate({});
  }
  return (
    <li className="flex min-h-14 flex-wrap items-center gap-3">
      <KindIcon item={item} />
      <Link to={`/savings/${saving.id}`} className={`min-w-0 flex-1 rounded-lg ${focusRing}`}>
        <span className="block truncate text-body font-bold">
          {item.name} · {item.label} · {dueLabel(item.date)}
        </span>
        <span className="block truncate text-small text-[var(--tl-muted)]">
          {dueInWords(item.date)}
          {item.detail ? ` · ${item.detail}` : ""}
        </span>
      </Link>
      {item.amount !== null ? <span className="hidden text-body font-extrabold tabular-nums sm:inline">{wholeBdt(item.amount)}</span> : null}
      <Button disabled={action.isPending} onClick={act}>
        {label}
      </Button>
      {action.error ? <div className="basis-full"><ErrorNote>{messageOf(action.error)}</ErrorNote></div> : null}
      {form === "profit" ? <ProfitForm saving={saving} onClose={() => setForm(null)} /> : null}
      {form === "close" ? <CloseForm saving={saving} early={false} onClose={() => setForm(null)} /> : null}
    </li>
  );
}
