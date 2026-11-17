import { formatBdt } from "@takaleaf/shared";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { usePeople } from "../../api/queries";
import type { Person } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { Button, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf, LoadError } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { Chevron, iconButtonClass, ListCard, Segmented, StatTile } from "../../ui/Parts";
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

type Filter = "all" | "owed" | "owe";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "owed", label: "Owed to me" },
  { value: "owe", label: "I owe" },
];

function standingLine(person: Person): string {
  const lead = person.net > 0 ? "Owes you" : person.net < 0 ? "You owe" : "All settled";
  return [lead, person.note].filter(Boolean).join(" · ");
}

export function PeoplePage() {
  const people = usePeople();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const data = people.data;
  const shown = (data?.people ?? []).filter((p) => filter === "all" || (filter === "owed" ? p.net > 0 : p.net < 0));

  return (
    <>
      <PageHeader
        title="People and loans"
        back="/settings"
        phoneAction={
          <button type="button" aria-label="Add a person" onClick={() => setAdding(true)} className={iconButtonClass}>
            <Icon name="plus" size={20} />
          </button>
        }
      >
        <Button onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Add a person
        </Button>
      </PageHeader>

      {people.isPending ? <Loading /> : null}
      <LoadError query={people} />

      {data ? (
        <div className="flex flex-col gap-3 lg:max-w-3xl">
          <section aria-label="Totals" className="grid grid-cols-2 gap-2.5">
            <StatTile icon="moneyIn" label="Owed to me" value={formatBdt(data.owedToMe)} />
            <StatTile icon="moneyOut" tone="expense" label="I owe" value={formatBdt(data.iOwe)} />
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
            <>
              <Segmented label="Show" options={FILTERS} value={filter} onChange={setFilter} />
              <ListCard>
                {shown.length === 0 ? (
                  <p className="m-0 py-4 text-center text-sm text-[var(--tl-muted)]">
                    {filter === "owed" ? "Nobody owes you money right now." : filter === "owe" ? "You do not owe anyone right now." : "Nobody here yet."}
                  </p>
                ) : null}
                <ul className="m-0 flex list-none flex-col p-0">
                  {shown.map((person) => (
                    <li key={person.id}>
                      <Link
                        to={`/people/${person.id}`}
                        className={`-mx-1.5 flex h-[60px] items-center gap-3 rounded-[14px] px-1.5 hover:bg-[var(--tl-chip)] ${focusRing}`}
                      >
                        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest text-[15px] font-extrabold text-white">
                          {person.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-bold">{person.name}</span>
                          <span className="block truncate text-[12px] text-[var(--tl-muted)]">{standingLine(person)}</span>
                        </span>
                        <span
                          className={`shrink-0 text-[15px] font-extrabold ${
                            person.net > 0 ? "text-forest dark:text-income-dark" : person.net < 0 ? "text-expense dark:text-expense-dark" : "text-[var(--tl-muted)]"
                          }`}
                        >
                          {formatBdt(person.net)}
                        </span>
                        <Chevron />
                      </Link>
                    </li>
                  ))}
                </ul>
              </ListCard>
            </>
          )}
        </div>
      ) : null}

      {adding ? <PersonForm person={null} onClose={() => setAdding(false)} onCreated={(p) => navigate(`/people/${p.id}`)} /> : null}
    </>
  );
}
