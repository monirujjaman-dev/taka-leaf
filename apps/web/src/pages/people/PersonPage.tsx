import { formatBdt } from "@takaleaf/shared";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { usePerson } from "../../api/queries";
import type { Loan, LoanKind } from "../../api/types";
import { Button, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf, LoadError } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { iconButtonClass } from "../../ui/Parts";
import { dayLabel, localDate, timeLabel } from "../../ui/format";
import { LOAN_LABEL, LoanForm } from "./LoanForm";
import { Standing } from "./PeoplePage";
import { PersonForm } from "./PersonForm";

const ACTIONS: { kind: LoanKind; label: string }[] = [
  { kind: "Lend", label: "Lend" },
  { kind: "GotBack", label: "Got paid back" },
  { kind: "Borrow", label: "Borrow" },
  { kind: "PaidBack", label: "Pay back" },
];

/** Lending raises what they owe you; being paid back lowers it. Borrowing and paying back mirror that. */
const SIGN: Record<LoanKind, string> = { Lend: "+", GotBack: "−", Borrow: "+", PaidBack: "−" };

export function PersonPage() {
  const { id = "" } = useParams();
  const detail = usePerson(id);
  const [form, setForm] = useState<{ kind: LoanKind; loan: Loan | null } | null>(null);
  const [editing, setEditing] = useState(false);

  if (detail.isPending) return <Loading />;
  if (detail.error) return <LoadError query={detail} />;
  const { person, loans } = detail.data;

  const canGetBack = person.owesMe > 0;
  const canPayBack = person.iOwe > 0;

  return (
    <>
      <div className="mb-3 flex min-h-14 items-center gap-3 lg:mb-5">
        <Link to="/people" aria-label="Back to people" className={iconButtonClass}>
          <Icon name="left" size={20} />
        </Link>
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest text-base font-extrabold text-white">
          {person.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-xl font-extrabold tracking-tight [overflow-wrap:anywhere] lg:text-[26px]">{person.name}</h1>
          {person.note ? <p className="m-0 line-clamp-2 text-[13px] text-[var(--tl-muted)]">{person.note}</p> : null}
        </div>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>

      <section className="glass mb-4 rounded-[22px] p-5">
        <Standing person={person} large />
        {person.owesMe > 0 && person.iOwe > 0 ? (
          <p className="m-0 mt-2 text-[13px] text-[var(--tl-muted)]">
            They owe you {formatBdt(person.owesMe)}; you owe them {formatBdt(person.iOwe)}.
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACTIONS.map((action) => {
            const disabled = (action.kind === "GotBack" && !canGetBack) || (action.kind === "PaidBack" && !canPayBack);
            return (
              <Button
                key={action.kind}
                variant={action.kind === "Lend" || action.kind === "Borrow" ? "secondary" : "primary"}
                disabled={disabled}
                title={disabled ? "Nothing is owed" : undefined}
                onClick={() => setForm({ kind: action.kind, loan: null })}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      </section>

      <section className="glass rounded-[22px] p-3 sm:p-4" aria-labelledby="loans-title">
        <h2 id="loans-title" className="m-0 px-2 pb-2 pt-1 text-base font-extrabold">
          History
        </h2>
        {loans.length === 0 ? (
          <EmptyState title="No loans yet">
            <p className="m-0 text-sm text-[var(--tl-muted)]">Use Lend or Borrow above to record the first one.</p>
          </EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {loans.map((loan) => (
              <li key={loan.id}>
                <button
                  type="button"
                  onClick={() => setForm({ kind: loan.kind, loan })}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-[16px] px-2 py-2.5 text-left hover:bg-[var(--tl-chip)] ${focusRing}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{LOAN_LABEL[loan.kind](person.name)}</span>
                    <span className="block truncate text-[13px] text-[var(--tl-muted)]">
                      {dayLabel(localDate(new Date(loan.occurredAt)))}, {timeLabel(loan.occurredAt)}
                      {[loan.walletName, loan.note].filter(Boolean).map((part) => ` · ${part}`)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-extrabold">
                    {SIGN[loan.kind]}
                    {formatBdt(loan.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {form ? <LoanForm key={form.loan?.id ?? form.kind} person={person} kind={form.kind} loan={form.loan} onClose={() => setForm(null)} /> : null}
      {editing ? <PersonForm person={person} onClose={() => setEditing(false)} /> : null}
    </>
  );
}
