import { formatBdt } from "@takaleaf/shared";
import { useState } from "react";
import { Link } from "react-router";
import { useBudgets, useDashboard, useRecurringDue, useWallets } from "../../api/queries";
import { BudgetBar } from "../budgets/BudgetsPage";
import { DueList } from "../recurring/DueList";
import { PageHeader } from "../../layout/AppShell";
import { useOpenTransaction, useTransactionSheet } from "../../layout/TransactionSheet";
import { Button, buttonClass, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { localMonth, monthLabel, shiftMonth } from "../../ui/format";
import { TransactionRow } from "../transactions/TransactionRow";

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const current = localMonth();
  return (
    <div className="glass inline-flex items-center gap-1 rounded-[14px] p-1">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(month, -1))}
        className={`grid h-9 w-9 cursor-pointer place-items-center rounded-[10px] hover:bg-[var(--tl-chip)] ${focusRing}`}
      >
        <Icon name="left" size={18} />
      </button>
      <span className="min-w-36 text-center text-sm font-bold" aria-live="polite">
        {monthLabel(month)}
      </span>
      <button
        type="button"
        aria-label="Next month"
        disabled={month >= current}
        onClick={() => onChange(shiftMonth(month, 1))}
        className={`grid h-9 w-9 cursor-pointer place-items-center rounded-[10px] hover:bg-[var(--tl-chip)] disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
      >
        <Icon name="right" size={18} />
      </button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "income" | "expense" }) {
  const color =
    tone === "income" ? "text-forest dark:text-income-dark" : tone === "expense" ? "text-expense dark:text-expense-dark" : "";
  return (
    <div className="glass rounded-[20px] p-4">
      <p className="m-0 text-[13px] font-semibold text-[var(--tl-muted)]">{label}</p>
      <p className={`m-0 mt-1 text-lg font-extrabold tracking-tight sm:text-xl ${color}`}>{formatBdt(value)}</p>
    </div>
  );
}

export function DashboardPage() {
  const [month, setMonth] = useState(localMonth);
  const dashboard = useDashboard(month);
  const due = useRecurringDue();
  const budgets = useBudgets(month);
  const wallets = useWallets();
  const sheet = useTransactionSheet();
  const openRow = useOpenTransaction();

  const hasWallets = (wallets.data?.wallets.length ?? 0) > 0;

  return (
    <>
      <PageHeader title="Dashboard">
        <MonthSwitcher month={month} onChange={setMonth} />
      </PageHeader>

      {dashboard.isPending ? <Loading /> : null}
      {dashboard.error ? <ErrorNote>{messageOf(dashboard.error)}</ErrorNote> : null}

      {wallets.isSuccess && !hasWallets ? (
        <section className="glass mb-5 rounded-[22px]">
          <EmptyState title="Start by adding your wallets">
            <p className="m-0 max-w-sm text-sm text-[var(--tl-muted)]">
              Add the places your money lives — cash in hand, a bank account, bKash or Nagad — with what each holds today.
            </p>
            <Link to="/wallets?add=1" className={`${buttonClass()} mt-1`}>
              Add a wallet
            </Link>
          </EmptyState>
        </section>
      ) : null}

      {dashboard.data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <section
              aria-label="Net balance"
              className="rounded-[26px] bg-forest p-5 text-white shadow-[0_12px_28px_rgb(11_59_36/0.22)]"
            >
              <p className="m-0 text-[13px] font-semibold text-[#D5EBDD]">Net balance</p>
              <p className="m-0 mt-1 text-[30px] font-extrabold tracking-tight sm:text-[34px]">{formatBdt(dashboard.data.netBalance)}</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-[#D5EBDD]">
                <span>
                  Assets <b className="text-white">{formatBdt(dashboard.data.assets)}</b>
                </span>
                <span>
                  Owed on cards and loans <b className="text-white">{formatBdt(dashboard.data.liabilities)}</b>
                </span>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Stat label={`Income in ${monthLabel(month).split(" ")[0]}`} value={dashboard.data.income} tone="income" />
              <Stat label={`Spent in ${monthLabel(month).split(" ")[0]}`} value={dashboard.data.expense} tone="expense" />
              {dashboard.data.owedToMe > 0 ? <Stat label="People owe you" value={dashboard.data.owedToMe} /> : null}
              {dashboard.data.iOwe > 0 ? <Stat label="You owe people" value={dashboard.data.iOwe} /> : null}
            </div>

            {due.data && due.data.length > 0 ? (
              <section className="glass rounded-[22px] p-4" aria-labelledby="due-title">
                <div className="mb-3 flex items-center justify-between">
                  <h2 id="due-title" className="m-0 text-base font-extrabold">
                    Due to record
                  </h2>
                  <Link to="/recurring" className="text-sm font-bold text-[var(--tl-primary)]">
                    Recurring
                  </Link>
                </div>
                <DueList rules={due.data} />
              </section>
            ) : null}

            <section className="glass rounded-[22px] p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="m-0 text-base font-extrabold">Recent</h2>
                <Link to="/transactions" className="text-sm font-bold text-[var(--tl-primary)]">
                  See all
                </Link>
              </div>
              {dashboard.data.recent.length === 0 ? (
                <EmptyState title="No transactions yet">
                  {hasWallets ? <Button onClick={() => sheet.open()}>Add your first one</Button> : null}
                </EmptyState>
              ) : (
                <ul className="m-0 flex list-none flex-col p-0">
                  {dashboard.data.recent.map((t) => (
                    <TransactionRow key={t.id} transaction={t} onOpen={openRow} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
          {budgets.data && budgets.data.budgets.length > 0 ? (
            <section className="glass rounded-[22px] p-5" aria-labelledby="budgets-title">
              <div className="mb-1 flex items-center justify-between">
                <h2 id="budgets-title" className="m-0 text-base font-extrabold">
                  Budgets
                </h2>
                <Link to="/budgets" className="text-sm font-bold text-[var(--tl-primary)]">
                  All
                </Link>
              </div>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {budgets.data.budgets.slice(0, 4).map((budget) => (
                  <li key={budget.id}>
                    <span className="text-sm font-semibold">{budget.name}</span>
                    <BudgetBar budget={budget} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="glass h-fit rounded-[22px] p-5" aria-labelledby="spending-title">
            <h2 id="spending-title" className="m-0 text-base font-extrabold">
              Where the money went
            </h2>
            <p className="mb-4 mt-1 text-[13px] text-[var(--tl-muted)]">{monthLabel(month)}, by category</p>
            {dashboard.data.spendingByCategory.length === 0 ? (
              <p className="m-0 text-sm text-[var(--tl-muted)]">No spending this month.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
                {dashboard.data.spendingByCategory.map((item) => {
                  const share = dashboard.data.expense > 0 ? item.amount / dashboard.data.expense : 0;
                  return (
                    <li key={item.categoryId ?? "none"}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-semibold">{item.name}</span>
                        <span className="shrink-0 font-bold">{formatBdt(item.amount)}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--tl-chip)]" aria-hidden="true">
                        <div className="h-full rounded-full bg-leaf" style={{ width: `${Math.max(share * 100, 2)}%` }} />
                      </div>
                      <span className="sr-only">{Math.round(share * 100)}% of spending</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
