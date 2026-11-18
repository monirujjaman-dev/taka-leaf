import { formatBdt, percent } from "@takaleaf/shared";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { download } from "../../api/client";
import { useSavings } from "../../api/queries";
import type { ComingUp, Saving, SavingKind, SavingList } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { Button, buttonClass, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, LoadError, Loading, messageOf } from "../../ui/Feedback";
import { localDate } from "../../ui/format";
import { Icon } from "../../ui/Icon";
import { Bar, iconButtonClass, LeafWatermark, ListCard, StatTile } from "../../ui/Parts";
import { AddSavingForm } from "./AddSavingForm";
import { DateBadge, dueLabel, HeroStat, KIND_LABEL, KindIcon, Pill, premiumWords, progress, subtitle, wholeBdt } from "./parts";

type Show = "All" | SavingKind;
const FILTERS: { value: Show; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Fdr", label: "FDR" },
  { value: "Dps", label: "DPS" },
  { value: "Certificate", label: "Sanchayapatra" },
  { value: "PrizeBond", label: "Prize bonds" },
  { value: "Insurance", label: "Insurance" },
];

/** FDR, DPS, Sanchayapatra, prize bonds and policies: what is saved, what comes next, and this tax year. */
export function SavingsPage() {
  const savings = useSavings();
  const [params, setParams] = useSearchParams();
  const [show, setShow] = useState<Show>("All");
  const adding = params.get("add") === "1";
  const openAdd = () => setParams({ add: "1" }, { replace: true });
  const closeAdd = () => setParams({}, { replace: true });

  const header = (
    <PageHeader
      title="Savings and insurance"
      back="/settings"
      phoneAction={
        <button type="button" aria-label="Add savings or a policy" onClick={openAdd} className={iconButtonClass}>
          <Icon name="plus" size={20} />
        </button>
      }
    >
      <Button onClick={openAdd}>
        <Icon name="plus" size={18} />
        Add
      </Button>
    </PageHeader>
  );

  if (savings.isPending) return <>{header}<Loading /></>;
  if (savings.error) return <>{header}<LoadError query={savings} /></>;
  const { summary, comingUp, savings: all } = savings.data;
  const kept = all.filter((s) => s.kind !== "Insurance" && (show === "All" || show === s.kind));
  const policies = all.filter((s) => s.kind === "Insurance" && (show === "All" || show === "Insurance"));

  return (
    <>
      {header}
      {all.length === 0 ? (
        <section className="glass rounded-[22px] p-4">
          <EmptyState title="Nothing saved here yet">
            <p className="m-0 text-body text-[var(--tl-muted)]">Add an FDR, a DPS, a Sanchayapatra, prize bonds or an insurance policy to see what you have, what comes next and the tax taken.</p>
            <button type="button" onClick={openAdd} className={`${buttonClass()} mt-1`}>
              Add savings or a policy
            </button>
          </EmptyState>
        </section>
      ) : (
        <div className="flex flex-col gap-3 lg:gap-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
            <Hero summary={summary} />
            <div className="hidden grid-cols-2 gap-3 lg:grid">
              <StatTile icon="moneyIn" label="Profit this tax year" value={formatBdt(summary.taxYear.profit)} />
              <StatTile icon="percent" tone="expense" label="Tax at source" value={formatBdt(summary.taxYear.tax)} />
              <StatTile icon="shield" tone="blue" label="Insurance cover" value={formatBdt(summary.cover)} />
              <StatTile icon="flag" label="Next to mature" value={summary.nextToMature && summary.nextToMatureOn ? `${summary.nextToMature} · ${dueLabel(summary.nextToMatureOn)}` : "—"} />
            </div>
          </div>

          {comingUp.length > 0 ? (
            <section className="glass rounded-[20px] px-3.5 py-1.5 lg:hidden" aria-labelledby="coming-title">
              <h2 id="coming-title" className="m-0 pt-2 text-small font-extrabold text-[var(--tl-muted)]">
                Coming up
              </h2>
              <ComingUpList items={comingUp.slice(0, 4)} />
            </section>
          ) : null}

          <div role="group" aria-label="Show" className="flex gap-2 overflow-x-auto lg:hidden">
            {FILTERS.map((f) => (
              <FilterChip key={f.value} label={f.label} on={show === f.value} onClick={() => setShow(f.value)} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-5">
            <div className="flex min-w-0 flex-col gap-3 lg:gap-5">
              {show !== "Insurance" ? (
                <section aria-labelledby="savings-title">
                  <ListCard className="lg:hidden">
                    <SectionTitle id="savings-title" title="Savings" right={`${kept.length}`} />
                    {kept.length === 0 ? <p className="m-0 py-3 text-body text-[var(--tl-muted)]">None of this kind.</p> : (
                      <ul className="m-0 list-none p-0">
                        {kept.map((s) => (
                          <li key={s.id} className="border-b border-[var(--tl-border)] last:border-b-0">
                            <SavingItem saving={s} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </ListCard>
                  <SavingsTable savings={kept} show={show} onShow={setShow} />
                </section>
              ) : null}
              {show === "All" || show === "Insurance" ? (
                <section aria-labelledby="insurance-title">
                  <ListCard className="lg:hidden">
                    <SectionTitle id="insurance-title" title="Insurance" right={`${formatBdt(summary.cover).replace(/\.00$/, "")} cover`} />
                    {policies.length === 0 ? <p className="m-0 py-3 text-body text-[var(--tl-muted)]">No policies yet.</p> : (
                      <ul className="m-0 list-none p-0">
                        {policies.map((s) => (
                          <li key={s.id} className="border-b border-[var(--tl-border)] last:border-b-0">
                            <PolicyItem saving={s} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </ListCard>
                  <PoliciesTable policies={policies} />
                </section>
              ) : null}
            </div>

            <div className="hidden min-w-0 flex-col gap-5 self-start lg:flex">
              <section className="glass rounded-[22px] p-5" aria-labelledby="coming-desk-title">
                <h2 id="coming-desk-title" className="m-0 mb-2 text-base font-extrabold">
                  Coming up
                </h2>
                {comingUp.length === 0 ? <p className="m-0 text-body text-[var(--tl-muted)]">Nothing coming up.</p> : <ComingUpList items={comingUp.slice(0, 5)} />}
              </section>
              <TaxYearCard summary={summary} />
            </div>
          </div>

          <p className="m-0 flex gap-2 px-1 text-small text-[var(--tl-muted)]">
            <Icon name="info" size={15} className="mt-0.5 shrink-0" />
            <span>Savings count as assets in your net balance. Profit is income; tax taken at source is an expense under Tax at source. Premiums are an expense under Insurance.</span>
          </p>
        </div>
      )}
      {adding ? <AddSavingForm kind={(params.get("kind") as SavingKind | null) ?? undefined} onClose={closeAdd} /> : null}
    </>
  );
}

function Hero({ summary }: { summary: SavingList["summary"] }) {
  return (
    <section aria-label="Saved and invested" className="@container relative flex min-h-[148px] flex-col justify-between gap-4 overflow-hidden rounded-[26px] bg-forest p-5 text-white shadow-hero lg:min-h-[168px]">
      <LeafWatermark />
      <div className="relative">
        <p className="m-0 text-small font-semibold text-mint">Saved and invested</p>
        <p className="m-0 mt-1 text-[length:min(var(--text-display),13cqi)] font-extrabold leading-tight tracking-[-0.025em] tabular-nums">{formatBdt(summary.saved)}</p>
      </div>
      <div className="relative flex flex-wrap gap-x-6 gap-y-2">
        <HeroStat label="Deposits (FDR, DPS)" value={wholeBdt(summary.deposits)} />
        <HeroStat label="Sanchayapatra" value={wholeBdt(summary.certificates)} />
        <HeroStat label="Prize bonds" value={wholeBdt(summary.prizeBonds)} />
      </div>
    </section>
  );
}

function SectionTitle({ id, title, right }: { id: string; title: string; right?: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between pt-1">
      <h2 id={id} className="m-0 text-small font-extrabold text-[var(--tl-muted)]">
        {title}
      </h2>
      {right ? <span className="text-caption font-bold text-[var(--tl-muted)]">{right}</span> : null}
    </div>
  );
}

function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-10 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-sm font-bold ${focusRing} ${
        on ? "border-forest bg-forest text-white dark:border-sage dark:bg-sage dark:text-ink" : "border-[var(--tl-border)] bg-[var(--tl-surface)] text-[var(--tl-text)] hover:bg-[var(--tl-chip)]"
      }`}
    >
      {label}
    </button>
  );
}

const actionPill = (c: ComingUp) => (c.action === "Draw" ? "Draw" : c.action === "Pay" ? "Pay" : c.action === "Close" ? "Matured" : c.action === "Record" ? "Record" : null);

export function ComingUpList({ items }: { items: ComingUp[] }) {
  return (
    <ul className="m-0 list-none p-0">
      {items.map((c) => (
        <li key={`${c.savingId}-${c.label}`} className="border-b border-[var(--tl-border)] last:border-b-0">
          <Link to={`/savings/${c.savingId}`} className={`flex min-h-[60px] items-center gap-3 rounded-[14px] py-2 ${focusRing}`}>
            <DateBadge date={c.date} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-bold">{c.kind === "PrizeBond" ? c.label : c.name}</span>
              <span className="block truncate text-small text-[var(--tl-muted)]">
                {c.overdue ? "Late · " : ""}
                {c.kind === "PrizeBond" ? c.detail : [c.label, c.detail].filter(Boolean).join(" · ")}
              </span>
            </span>
            {c.amount !== null ? <span className="text-body font-extrabold tabular-nums">{wholeBdt(c.amount)}</span> : null}
            {c.amount === null && actionPill(c) ? <Pill tone="amber">{actionPill(c)}</Pill> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SavingItem({ saving }: { saving: Saving }) {
  const p = progress(saving);
  return (
    <Link to={`/savings/${saving.id}`} className={`flex flex-col gap-2.5 rounded-[14px] py-3.5 ${saving.closed ? "opacity-70" : ""} ${focusRing}`}>
      <span className="flex items-center gap-3">
        <KindIcon item={saving} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-bold">{saving.name}</span>
          <span className="block truncate text-small text-[var(--tl-muted)]">{subtitle(saving)}</span>
        </span>
        <span className="whitespace-nowrap text-body font-extrabold tabular-nums">{wholeBdt(saving.balance)}</span>
      </span>
      {p.share !== null ? <Bar share={p.share} /> : null}
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-small font-semibold text-[var(--tl-muted)]">{p.words}</span>
        {p.pill ? <Pill tone={saving.next?.overdue ? "rust" : saving.closed ? "mint" : "grey"}>{p.pill}</Pill> : null}
      </span>
    </Link>
  );
}

function PolicyItem({ saving }: { saving: Saving }) {
  const soon = saving.next && !saving.closed && saving.next.date <= localDate(new Date(Date.now() + 30 * 86_400_000));
  return (
    <Link to={`/savings/${saving.id}`} className={`flex min-h-[60px] items-center gap-3 rounded-[14px] py-2 ${saving.closed ? "opacity-70" : ""} ${focusRing}`}>
      <KindIcon item={saving} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold">{saving.name}</span>
        <span className="block truncate text-small text-[var(--tl-muted)]">
          {[saving.provider, saving.next ? `${saving.policy === "Life" ? "next" : "renews"} ${dueLabel(saving.next.date)}` : saving.closed ? "Closed" : null].filter(Boolean).join(" · ")}
        </span>
      </span>
      {soon ? (
        <Pill tone={saving.next!.overdue ? "rust" : "amber"}>{saving.next!.overdue ? "Late" : "Due soon"}</Pill>
      ) : saving.cover ? (
        <span className="text-right">
          <span className="block whitespace-nowrap text-body font-extrabold tabular-nums">{wholeBdt(saving.cover)}</span>
          <span className="block text-caption text-[var(--tl-muted)]">cover</span>
        </span>
      ) : null}
    </Link>
  );
}

const th = "px-2 py-2 font-bold";
const td = "px-2 py-3 tabular-nums";

function SavingsTable({ savings, show, onShow }: { savings: Saving[]; show: Show; onShow: (show: Show) => void }) {
  return (
    <div className="glass hidden min-w-0 rounded-[22px] p-5 lg:block">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-base font-extrabold">Savings</h2>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {FILTERS.filter((f) => f.value !== "Insurance").map((f) => (
            <FilterChip key={f.value} label={f.label} on={show === f.value} onClick={() => onShow(f.value)} />
          ))}
        </div>
      </div>
      {savings.length === 0 ? (
        <p className="m-0 py-3 text-body text-[var(--tl-muted)]">None of this kind.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <caption className="sr-only">Savings and what is in each</caption>
            <thead>
              <tr className="text-left text-caption text-[var(--tl-muted)]">
                <th scope="col" className={th}>Name</th>
                <th scope="col" className={th}>Kind</th>
                <th scope="col" className={th}>Rate</th>
                <th scope="col" className={th}>Progress</th>
                <th scope="col" className={`${th} text-right`}>In it now</th>
                <th scope="col" className={`${th} text-right`}>Next</th>
              </tr>
            </thead>
            <tbody>
              {savings.map((s) => {
                const p = progress(s);
                return (
                  <tr key={s.id} className={`border-t border-[var(--tl-border)] ${s.closed ? "opacity-70" : ""}`}>
                    <td className="px-2 py-3">
                      <Link to={`/savings/${s.id}`} className={`flex items-center gap-2.5 rounded-lg ${focusRing}`}>
                        <KindIcon item={s} size={36} />
                        <span className="min-w-0">
                          <span className="block font-bold">{s.name}</span>
                          <span className="block text-caption text-[var(--tl-muted)]">{s.provider ?? subtitle(s)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={td}>{s.kind === "Certificate" ? "Certificate" : s.kind === "PrizeBond" ? "Prize bond" : KIND_LABEL[s.kind]}</td>
                    <td className={td}>{s.kind === "PrizeBond" ? "—" : percent(s.ratePoints)}</td>
                    <td className={`${td} min-w-[140px]`}>
                      <div className="mb-1.5 text-caption text-[var(--tl-muted)]">{p.words}</div>
                      {p.share !== null ? <Bar share={p.share} /> : null}
                    </td>
                    <td className={`${td} text-right font-extrabold`}>{wholeBdt(s.balance)}</td>
                    <td className="px-2 py-3 text-right">{p.pill ? <Pill tone={s.next?.overdue ? "rust" : s.next?.action === "Record" ? "amber" : "grey"}>{p.pill.replace(/^Next /, "")}</Pill> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PoliciesTable({ policies }: { policies: Saving[] }) {
  return (
    <div className="glass hidden min-w-0 rounded-[22px] p-5 lg:block">
      <h2 className="m-0 mb-2 text-base font-extrabold">Insurance</h2>
      {policies.length === 0 ? (
        <p className="m-0 py-3 text-body text-[var(--tl-muted)]">No policies yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">Insurance policies</caption>
            <thead>
              <tr className="text-left text-caption text-[var(--tl-muted)]">
                <th scope="col" className={th}>Policy</th>
                <th scope="col" className={`${th} text-right`}>Cover</th>
                <th scope="col" className={`${th} text-right`}>Premium</th>
                <th scope="col" className={`${th} text-right`}>Next due</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((s) => (
                <tr key={s.id} className={`border-t border-[var(--tl-border)] ${s.closed ? "opacity-70" : ""}`}>
                  <td className="px-2 py-3">
                    <Link to={`/savings/${s.id}`} className={`flex items-center gap-2.5 rounded-lg ${focusRing}`}>
                      <KindIcon item={s} size={36} />
                      <span className="min-w-0">
                        <span className="block font-bold">{s.name}</span>
                        <span className="block text-caption text-[var(--tl-muted)]">{s.provider ?? s.policy}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={`${td} text-right`}>{s.cover ? wholeBdt(s.cover) : "—"}</td>
                  <td className={`${td} text-right`}>
                    {wholeBdt(s.amount)} {premiumWords(s.everyMonths)}
                  </td>
                  <td className="px-2 py-3 text-right">{s.next ? <Pill tone={s.next.overdue ? "rust" : s.next.date <= localDate(new Date(Date.now() + 30 * 86_400_000)) ? "amber" : "grey"}>{dueLabel(s.next.date)}</Pill> : s.closed ? <Pill tone="mint">Closed</Pill> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TaxYearCard({ summary }: { summary: SavingList["summary"] }) {
  const { taxYear } = summary;
  const label = `${taxYear.from.slice(0, 4)}–${taxYear.to.slice(2, 4)}`;
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="glass rounded-[22px] p-5" aria-labelledby="tax-year-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="tax-year-title" className="m-0 text-base font-extrabold">
          Tax year {label}
        </h2>
        <Pill>Jul–Jun</Pill>
      </div>
      <p className="m-0 mb-1.5 mt-1 text-small text-[var(--tl-muted)]">For your tax return: what you invested, earned and had taken at source.</p>
      <dl className="m-0">
        <div className="flex min-h-10 items-center justify-between gap-3 border-b border-[var(--tl-border)]">
          <dt className="text-body text-[var(--tl-muted)]">Invested</dt>
          <dd className="m-0 text-body font-bold tabular-nums">{wholeBdt(taxYear.invested)}</dd>
        </div>
        <div className="flex min-h-10 items-center justify-between gap-3 border-b border-[var(--tl-border)]">
          <dt className="text-body text-[var(--tl-muted)]">Profit received</dt>
          <dd className="m-0 text-body font-bold tabular-nums text-[var(--tl-primary)]">{wholeBdt(taxYear.profit)}</dd>
        </div>
        <div className="flex min-h-10 items-center justify-between gap-3">
          <dt className="text-body text-[var(--tl-muted)]">Tax taken at source</dt>
          <dd className="m-0 text-body font-bold tabular-nums text-expense dark:text-expense-dark">{wholeBdt(taxYear.tax)}</dd>
        </div>
      </dl>
      <Button
        variant="secondary"
        className="mt-2.5 w-full"
        disabled={exporting}
        onClick={async () => {
          setExporting(true);
          setError(null);
          await download(`/savings/tax-year.csv?from=${taxYear.from.slice(0, 4)}`, `takaleaf-tax-year-${label}.csv`).catch((e: unknown) => setError(messageOf(e)));
          setExporting(false);
        }}
      >
        <Icon name="download" size={18} />
        {exporting ? "Exporting…" : "Export for my tax return"}
      </Button>
      <ErrorNote>{error}</ErrorNote>
    </section>
  );
}
