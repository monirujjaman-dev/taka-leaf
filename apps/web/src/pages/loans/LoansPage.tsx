import { formatBdt, formatRate } from "@takaleaf/shared";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useBankLoans } from "../../api/queries";
import type { BankLoan, BankLoanType } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { Button, buttonClass, focusRing } from "../../ui/Button";
import { EmptyState, LoadError, Loading } from "../../ui/Feedback";
import { Icon, type IconName } from "../../ui/Icon";
import { Bar, iconButtonClass, IconTile, LeafWatermark, ListCard, Segmented, StatTile } from "../../ui/Parts";
import { LoanForm } from "./LoanForm";
import { dueInWords, dueLabel, HeroStat, Pill, progressWords, repaidPercent } from "./parts";
import { PayEmiForm } from "./PaymentForms";

type Show = "All" | BankLoanType;

export const loanIcon = (loan: Pick<BankLoan, "type" | "name">): IconName => (loan.type === "CardEmi" ? "card" : /home|flat|house/i.test(loan.name) ? "home" : "loan");

/** Bank loans and card EMIs: what is left, what is due next, and each loan's progress. */
export function LoansPage() {
  const loans = useBankLoans();
  const [params, setParams] = useSearchParams();
  const [show, setShow] = useState<Show>("All");
  const [paying, setPaying] = useState<BankLoan | null>(null);
  const adding = params.get("add") === "1";
  const openAdd = () => setParams({ add: "1" }, { replace: true });
  const closeAdd = () => setParams({}, { replace: true });

  const header = (
    <PageHeader title="Loans" back="/settings" phoneAction={<button type="button" aria-label="Add a loan" onClick={openAdd} className={iconButtonClass}><Icon name="plus" size={20} /></button>}>
      <Button onClick={openAdd}>
        <Icon name="plus" size={18} />
        Add a loan
      </Button>
    </PageHeader>
  );

  if (loans.isPending) return <>{header}<Loading /></>;
  if (loans.error) return <>{header}<LoadError query={loans} /></>;
  const { summary, loans: all } = loans.data;
  const open = all.filter((l) => !l.closed);
  const shown = all.filter((l) => show === "All" || l.type === show);
  const next = summary.upcoming[0];
  const nextLoan = next ? all.find((l) => l.id === next.loanId) : undefined;
  const thisMonth = summary.upcoming.filter((d) => d.dueDate.slice(0, 7) === summary.upcoming[0]?.dueDate.slice(0, 7));
  const finishing = [...open].filter((l) => l.endsOn).sort((a, b) => a.endsOn!.localeCompare(b.endsOn!))[0];

  return (
    <>
      {header}
      {all.length === 0 ? (
        <section className="glass rounded-[22px] p-4">
          <EmptyState title="No loans yet">
            <p className="m-0 text-body text-[var(--tl-muted)]">Add a bank loan or a credit card EMI to see what is left, the next EMI and how much interest you pay.</p>
            <button type="button" onClick={openAdd} className={`${buttonClass()} mt-1`}>
              Add a loan
            </button>
          </EmptyState>
        </section>
      ) : (
        <div className="flex flex-col gap-3 lg:gap-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
            <section aria-label="Left to pay on loans" className="@container relative flex min-h-[148px] flex-col justify-between gap-4 overflow-hidden rounded-[26px] bg-forest p-5 text-white shadow-hero lg:min-h-[168px]">
              <LeafWatermark />
              <div className="relative">
                <p className="m-0 text-small font-semibold text-mint">Left to pay on loans</p>
                <p className="m-0 mt-1 text-[length:min(var(--text-display),13cqi)] font-extrabold leading-tight tracking-[-0.025em] tabular-nums">{formatBdt(summary.outstanding)}</p>
              </div>
              <div className="relative flex flex-wrap gap-x-7 gap-y-2">
                <HeroStat label="Bank loans" value={formatBdt(summary.bank)} />
                <HeroStat label="Card EMIs" value={formatBdt(summary.cardEmi)} />
                <HeroStat label="Interest paid so far" value={formatBdt(open.reduce((s, l) => s + l.interestPaid, 0))} />
              </div>
            </section>
            <div className="hidden grid-cols-2 gap-3 lg:grid">
              <StatTile icon="calendar" label={next ? `Next EMI · ${dueLabel(next.dueDate)}` : "Next EMI"} value={next ? formatBdt(next.total) : "None due"} />
              <StatTile icon="moneyOut" tone="expense" label="EMIs due this month" value={formatBdt(thisMonth.reduce((s, d) => s + d.total, 0))} />
              <StatTile icon="loan" tone="expense" label="Interest still to come" value={formatBdt(open.reduce((s, l) => s + l.interestLeft, 0))} />
              <StatTile icon="flag" label="Next to finish" value={finishing ? `${finishing.name} · ${dueLabel(finishing.endsOn!)}` : "—"} />
            </div>
          </div>

          {next && nextLoan ? (
            <section className="glass rounded-[20px] p-4 lg:hidden" aria-label="Next EMI">
              <div className="flex items-center gap-3">
                <IconTile icon="calendar" tone={next.overdue ? "expense" : "primary"} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-body font-bold">
                    {next.name} {next.type === "CardEmi" ? "bill" : "EMI"} · {dueLabel(next.dueDate)}
                  </p>
                  <p className="m-0 truncate text-small text-[var(--tl-muted)]">
                    {dueInWords(next.dueDate)}
                    {next.payFromWalletName ? ` · from ${next.payFromWalletName}` : ""}
                  </p>
                </div>
                <p className="m-0 text-body font-extrabold tabular-nums">{formatBdt(next.total)}</p>
              </div>
              <div className="mt-3 flex gap-2.5">
                {next.type === "Bank" ? (
                  <Button className="flex-1" onClick={() => setPaying(nextLoan)}>
                    Pay EMI
                  </Button>
                ) : null}
                <Link to={`/loans/${next.loanId}`} className={`${buttonClass("secondary")} flex-1`}>
                  Schedule
                </Link>
              </div>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-5">
            <section className="flex flex-col gap-3" aria-labelledby="loans-title">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="loans-title" className="m-0 hidden text-base font-extrabold lg:block">
                  Your loans
                </h2>
                <Segmented
                  label="Show"
                  className="w-full lg:w-[320px]"
                  value={show}
                  onChange={setShow}
                  options={[
                    { value: "All", label: "All" },
                    { value: "Bank", label: "Bank loans" },
                    { value: "CardEmi", label: "Card EMIs" },
                  ]}
                />
              </div>
              <ListCard>
                {shown.length === 0 ? (
                  <p className="m-0 py-3 text-body text-[var(--tl-muted)]">None of this kind.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col p-0">
                    {shown.map((loan) => (
                      <li key={loan.id} className="border-b border-[var(--tl-border)] last:border-b-0">
                        <LoanRow loan={loan} />
                      </li>
                    ))}
                  </ul>
                )}
              </ListCard>
            </section>

            <section className="glass hidden self-start rounded-[22px] p-5 lg:block" aria-labelledby="upcoming-title">
              <h2 id="upcoming-title" className="m-0 mb-2 text-base font-extrabold">
                Due in the next 30 days
              </h2>
              {summary.upcoming.length === 0 ? (
                <p className="m-0 text-body text-[var(--tl-muted)]">Nothing due.</p>
              ) : (
                <>
                  <ul className="m-0 list-none p-0">
                    {summary.upcoming.map((due) => (
                      <li key={`${due.loanId}-${due.number}`} className="flex min-h-[60px] items-center gap-3 border-b border-[var(--tl-border)]">
                        <span className="w-11 shrink-0 text-center">
                          <span className="block text-lg font-extrabold">{Number(due.dueDate.slice(8))}</span>
                          <span className="block text-caption font-bold uppercase text-[var(--tl-muted)]">{dueLabel(due.dueDate).split(" ")[1]}</span>
                        </span>
                        <Link to={`/loans/${due.loanId}`} className={`min-w-0 flex-1 rounded-lg ${focusRing}`}>
                          <span className="block truncate text-body font-bold">
                            {due.name} {due.type === "CardEmi" ? "bill" : "EMI"}
                          </span>
                          <span className="block truncate text-small text-[var(--tl-muted)]">
                            {due.overdue ? "Late · " : ""}
                            {due.type === "CardEmi" ? `Added to ${due.payFromWalletName ?? "the card"}` : (due.payFromWalletName ?? "")}
                          </span>
                        </Link>
                        <span className="text-body font-extrabold tabular-nums">{formatBdt(due.total)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-between text-body font-extrabold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatBdt(summary.upcoming.reduce((s, d) => s + d.total, 0))}</span>
                  </div>
                </>
              )}
            </section>
          </div>

          <p className="m-0 px-1 text-small text-[var(--tl-muted)]">Loans count as liabilities in your net balance. Interest you pay is an expense under Loan interest.</p>
        </div>
      )}

      {adding ? <LoanForm loan={null} onClose={closeAdd} /> : null}
      {paying ? <PayEmiForm loan={paying} onClose={() => setPaying(null)} /> : null}
    </>
  );
}

function LoanRow({ loan }: { loan: BankLoan }) {
  const percent = loan.type === "CardEmi" ? Math.round((loan.paid * 100) / Math.max(1, loan.paid + loan.left)) : repaidPercent(loan);
  const detail =
    loan.type === "CardEmi"
      ? `${loan.payFromWalletName ?? "Card"} · ${formatRate(loan.ratePoints)} · ${formatBdt(loan.emi)} a month`
      : `${loan.lender ?? "Bank"} · ${formatRate(loan.ratePoints)} · EMI ${formatBdt(loan.emi)}`;
  const next = loan.next;
  return (
    <Link to={`/loans/${loan.id}`} className={`flex flex-col gap-2.5 rounded-[14px] py-3.5 ${focusRing}`}>
      <span className="flex items-center gap-3">
        <IconTile icon={loanIcon(loan)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-bold">{loan.name}</span>
          <span className="block truncate text-small text-[var(--tl-muted)]">{detail}</span>
        </span>
        <span className="text-right">
          <span className={`block text-body font-extrabold tabular-nums ${loan.closed ? "" : "text-expense dark:text-expense-dark"}`}>{formatBdt(loan.outstanding)}</span>
          <span className="block text-caption text-[var(--tl-muted)]">left to pay</span>
        </span>
      </span>
      <Bar share={percent / 100} />
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-small font-semibold text-[var(--tl-muted)]">{progressWords(loan)}</span>
        {loan.closed ? (
          <Pill tone="mint">Closed</Pill>
        ) : next ? (
          <Pill tone={next.overdue ? "rust" : "amber"}>
            {next.overdue ? "Late · " : loan.type === "CardEmi" ? "Bills " : "Next "}
            {dueLabel(next.dueDate)}
          </Pill>
        ) : null}
      </span>
    </Link>
  );
}
