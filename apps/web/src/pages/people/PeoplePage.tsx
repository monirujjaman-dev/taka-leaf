import { formatBdt } from "@takaleaf/shared";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { usePeople } from "../../api/queries";
import type { Person } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { Button, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf } from "../../ui/Feedback";
import { PersonForm } from "./PersonForm";

export function Standing({ person, large = false }: { person: Person; large?: boolean }) {
  const size = large ? "text-[30px]" : "text-lg";
  if (person.net > 0)
    return (
      <span className="block">
        <span className="block text-[13px] font-semibold text-[var(--tl-muted)]">Owes you</span>
        <span className={`block font-extrabold tracking-tight text-forest dark:text-income-dark ${size}`}>{formatBdt(person.net)}</span>
      </span>
    );
  if (person.net < 0)
    return (
      <span className="block">
        <span className="block text-[13px] font-semibold text-[var(--tl-muted)]">You owe</span>
        <span className={`block font-extrabold tracking-tight text-expense dark:text-expense-dark ${size}`}>{formatBdt(-person.net)}</span>
      </span>
    );
  return <span className={`block font-bold text-[var(--tl-muted)] ${large ? "text-xl" : "text-sm"}`}>All settled</span>;
}

export function PeoplePage() {
  const people = usePeople();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const data = people.data;

  return (
    <>
      <PageHeader title="People">
        <Button onClick={() => setAdding(true)}>Add a person</Button>
      </PageHeader>
      <p className="-mt-3 mb-5 text-sm text-[var(--tl-muted)]">Money you lent and borrowed, person by person.</p>

      {people.isPending ? <Loading /> : null}
      {people.error ? <ErrorNote>{messageOf(people.error)}</ErrorNote> : null}

      {data ? (
        <>
          <section aria-label="Totals" className="mb-5 grid grid-cols-2 gap-3">
            <div className="glass min-w-0 rounded-[18px] p-3">
              <p className="m-0 text-[12px] font-semibold text-[var(--tl-muted)]">People owe you</p>
              <p className="m-0 truncate text-lg font-extrabold text-forest dark:text-income-dark">{formatBdt(data.owedToMe)}</p>
            </div>
            <div className="glass min-w-0 rounded-[18px] p-3">
              <p className="m-0 text-[12px] font-semibold text-[var(--tl-muted)]">You owe people</p>
              <p className="m-0 truncate text-lg font-extrabold text-expense dark:text-expense-dark">{formatBdt(data.iOwe)}</p>
            </div>
          </section>

          {data.people.length === 0 ? (
            <section className="glass rounded-[22px]">
              <EmptyState title="Nobody here yet">
                <p className="m-0 max-w-sm text-sm text-[var(--tl-muted)]">
                  Add a friend, colleague or relative when you lend them money or borrow from them.
                </p>
              </EmptyState>
            </section>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {data.people.map((person) => (
                <li key={person.id}>
                  <Link to={`/people/${person.id}`} className={`glass flex items-center gap-3 rounded-[20px] p-4 ${focusRing}`}>
                    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--tl-chip)] text-base font-extrabold text-[var(--tl-primary)]">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-extrabold">{person.name}</span>
                      {person.note ? <span className="block truncate text-[13px] text-[var(--tl-muted)]">{person.note}</span> : null}
                    </span>
                    <span className="shrink-0 text-right">
                      <Standing person={person} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {adding ? <PersonForm person={null} onClose={() => setAdding(false)} onCreated={(p) => navigate(`/people/${p.id}`)} /> : null}
    </>
  );
}
