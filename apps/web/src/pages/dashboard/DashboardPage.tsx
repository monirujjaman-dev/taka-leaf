import { formatBdt } from "@takaleaf/shared";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { useBudgets, useDashboard, useRecurringDue, useWallets } from "../../api/queries";
import type { Wallet } from "../../api/types";
import { useTheme } from "../../app/theme";
import { AddTransactionButton, PageHeader } from "../../layout/AppShell";
import { useOpenTransaction, useTransactionSheet } from "../../layout/TransactionSheet";
import { Logo } from "../../shared/Logo";
import { Button, buttonClass, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf, LoadError } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { MonthPicker } from "../../ui/MonthPicker";
import { useWide } from "../../ui/useWide";
import { Bar, IconTile, iconButtonClass, LeafWatermark, ListCard, StatTile, walletIcon } from "../../ui/Parts";
import { localMonth, monthLabel, WALLET_TYPE_LABEL } from "../../ui/format";
import { BudgetBar } from "../budgets/BudgetsPage";
import { DueList } from "../recurring/DueList";
import { TransactionRow } from "../transactions/TransactionRow";

const linkClass = `text-[13px] font-bold text-[var(--tl-primary)] ${focusRing} rounded-[6px]`;

function walletDetail(wallet: Wallet): string {
  if (wallet.type === "CreditCard" && wallet.availableCredit !== null) return `${formatBdt(wallet.availableCredit)} left`;
  return WALLET_TYPE_LABEL[wallet.type];
}

/** Phones: logo, a short month button and refresh, in place of a title bar. */
function PhoneHeader({ month, onMonth }: { month: string; onMonth: (m: string) => void }) {
  const [theme] = useTheme();
  const client = useQueryClient();
  const fetching = useIsFetching() > 0;
  return (
    <div className="mb-2 flex h-14 items-center gap-2.5">
      <h1 className="sr-only">Dashboard</h1>
      <span className="flex-1">
        <Logo theme={theme} size={30} />
      </span>
      <MonthPicker month={month} onChange={onMonth} short />
      <button type="button" aria-label="Refresh" aria-busy={fetching} onClick={() => void client.invalidateQueries()} className={iconButtonClass}>
        <Icon name="sync" size={20} className={fetching ? "motion-safe:animate-spin motion-reduce:opacity-50" : ""} />
      </button>
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
  // One h1 either way: the phone header shows the logo, the wide one the title.
  const wide = useWide();

  const own = (wallets.data?.wallets ?? []).filter((w) => w.personId === null && !w.archived);
  const hasWallets = own.length > 0;
  const d = dashboard.data;

  return (
    <>
      {wide ? (
        <PageHeader title="Dashboard">
          <MonthPicker month={month} onChange={setMonth} />
          <AddTransactionButton />
        </PageHeader>
      ) : (
        <PhoneHeader month={month} onMonth={setMonth} />
      )}

      {dashboard.isPending ? <Loading /> : null}
      <LoadError query={dashboard} />

      {wallets.isSuccess && !hasWallets ? (
        <section className="glass mb-3 rounded-[22px] lg:mb-5">
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

      {d ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
          <section
            aria-label="Net balance"
            className="relative flex min-h-[148px] flex-col justify-between overflow-hidden rounded-[26px] bg-forest p-5 text-white shadow-hero lg:min-h-[168px]"
          >
            <LeafWatermark />
            <div className="relative">
              <p className="m-0 text-[13px] font-semibold text-mint">Net balance</p>
              <p className="m-0 mt-1 text-[34px] font-extrabold leading-tight tracking-[-0.8px] [overflow-wrap:anywhere]">{formatBdt(d.netBalance)}</p>
            </div>
            <div className="relative mt-3 flex gap-8">
              <div>
                <p className="m-0 text-[12px] font-semibold text-mint">Assets</p>
                <p className="m-0 text-[15px] font-bold">{formatBdt(d.assets)}</p>
              </div>
              <div>
                <p className="m-0 text-[12px] font-semibold text-mint">Liabilities</p>
                <p className="m-0 text-[15px] font-bold">{formatBdt(d.liabilities)}</p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2.5 lg:gap-3">
            <StatTile icon="moneyIn" label="Income" value={formatBdt(d.income)} />
            <StatTile icon="moneyOut" tone="expense" label="Expense" value={formatBdt(d.expense)} />
            <StatTile icon="people" label="Owed to me" value={formatBdt(d.owedToMe)} />
            <StatTile icon="people" tone="expense" label="I owe" value={formatBdt(d.iOwe)} />
          </div>

          {due.data && due.data.length > 0 ? (
            <section className="glass rounded-[22px] p-4 lg:col-span-2" aria-labelledby="due-title">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="due-title" className="m-0 text-base font-extrabold">
                  Due to record
                </h2>
                <Link to="/recurring" className={linkClass}>
                  Recurring
                </Link>
              </div>
              <DueList rules={due.data} />
            </section>
          ) : null}

          {hasWallets ? (
            <section aria-labelledby="wallets-strip" className="lg:hidden">
              <div className="mb-2 mt-1 flex items-center justify-between">
                <h2 id="wallets-strip" className="m-0 text-[15px] font-extrabold">
                  Wallets
                </h2>
                <Link to="/wallets" className={linkClass}>
                  See all
                </Link>
              </div>
              <ul className="-mx-5 m-0 flex list-none gap-2.5 overflow-x-auto px-5 py-1 [scrollbar-width:none]">
                {own.map((wallet) => (
                  <li key={wallet.id} className="shrink-0">
                    <Link
                      to={`/transactions?walletId=${wallet.id}&from=2000-01-01`}
                      className={`glass flex h-[84px] w-max min-w-32 max-w-56 flex-col justify-between rounded-[18px] p-3 ${focusRing}`}
                    >
                      <span className="flex items-center gap-1.5 text-[13px] font-bold">
                        <span className="flex text-[var(--tl-primary)]">
                          <Icon name={walletIcon(wallet.type)} size={16} />
                        </span>
                        <span className="truncate">{wallet.name}</span>
                      </span>
                      <span className={`whitespace-nowrap text-[15px] font-extrabold ${wallet.balance < 0 ? "text-expense dark:text-expense-dark" : ""}`}>
                        {formatBdt(wallet.balance)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="glass hidden rounded-[22px] p-5 lg:block" aria-labelledby="spending-title">
            <Spending id="spending-title" month={month} items={d.spendingByCategory} total={d.expense} />
          </section>

          <section className="glass hidden rounded-[22px] px-5 py-4 lg:block" aria-labelledby="wallets-list">
            <div className="mb-1 flex items-center justify-between">
              <h2 id="wallets-list" className="m-0 text-base font-extrabold">
                Wallets
              </h2>
              <Link to="/wallets" className={linkClass}>
                See all
              </Link>
            </div>
            {own.length === 0 ? <p className="m-0 py-3 text-sm text-[var(--tl-muted)]">No wallets yet.</p> : null}
            <ul className="m-0 flex list-none flex-col p-0">
              {own.slice(0, 6).map((wallet) => (
                <li key={wallet.id} className="flex h-[52px] items-center gap-3">
                  <IconTile icon={walletIcon(wallet.type)} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{wallet.name}</span>
                    <span className="block truncate text-[12px] text-[var(--tl-muted)]">{walletDetail(wallet)}</span>
                  </span>
                  <span className={`text-sm font-extrabold ${wallet.balance < 0 ? "text-expense dark:text-expense-dark" : ""}`}>
                    {formatBdt(wallet.balance)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="recent-title" className="lg:col-span-2">
            <div className="mb-2 mt-1 flex items-center justify-between lg:mt-0">
              <h2 id="recent-title" className="m-0 text-[15px] font-extrabold lg:text-base">
                <span className="lg:hidden">Recent</span>
                <span className="hidden lg:inline">Recent transactions</span>
              </h2>
              <Link to="/transactions" className={linkClass}>
                History
              </Link>
            </div>
            <ListCard>
              {d.recent.length === 0 ? (
                <EmptyState title="No transactions yet">
                  {hasWallets ? <Button onClick={() => sheet.open()}>Add your first one</Button> : null}
                </EmptyState>
              ) : (
                <ul className="m-0 flex list-none flex-col p-0">
                  {d.recent.map((t) => (
                    <TransactionRow key={t.id} transaction={t} onOpen={openRow} withDate />
                  ))}
                </ul>
              )}
            </ListCard>
          </section>

          {budgets.data && budgets.data.budgets.length > 0 ? (
            <section className="glass rounded-[22px] p-5" aria-labelledby="budgets-title">
              <div className="mb-2 flex items-center justify-between">
                <h2 id="budgets-title" className="m-0 text-base font-extrabold">
                  Budgets
                </h2>
                <Link to="/budgets" className={linkClass}>
                  All budgets
                </Link>
              </div>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {budgets.data.budgets.slice(0, 4).map((budget) => (
                  <li key={budget.id}>
                    <span className="text-sm font-bold">{budget.name}</span>
                    <BudgetBar budget={budget} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="glass rounded-[22px] p-5 lg:hidden" aria-labelledby="spending-phone">
            <Spending id="spending-phone" month={month} items={d.spendingByCategory} total={d.expense} />
          </section>
        </div>
      ) : null}
    </>
  );
}

function Spending({
  id,
  month,
  items,
  total,
}: {
  id: string;
  month: string;
  items: { categoryId: string | null; name: string; amount: number }[];
  total: number;
}) {
  return (
    <>
      <h2 id={id} className="m-0 text-base font-extrabold">
        Spending by category
      </h2>
      <p className="mb-4 mt-1 text-[13px] text-[var(--tl-muted)]">{monthLabel(month)}</p>
      {items.length === 0 ? (
        <p className="m-0 text-sm text-[var(--tl-muted)]">No spending this month.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {items.map((item) => {
            const share = total > 0 ? item.amount / total : 0;
            return (
              <li key={item.categoryId ?? "none"} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-semibold">{item.name}</span>
                  <span className="shrink-0 font-bold">{formatBdt(item.amount)}</span>
                </div>
                <Bar share={share} />
                <span className="sr-only">{Math.round(share * 100)}% of spending</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
