import { formatBdt } from "@takaleaf/shared";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useCategories, useTransactions, useWallets } from "../../api/queries";
import type { Transaction } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { useTransactionSheet } from "../../layout/TransactionSheet";
import { Button } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf } from "../../ui/Feedback";
import { SelectField, TextField } from "../../ui/Field";
import { dayLabel, lastDayOf, localDate, localMonth } from "../../ui/format";
import { CategoryOptions, WalletOptions } from "./pickers";
import { TransactionRow } from "./TransactionRow";

const PAGE_SIZE = 50;

function groupByDay(items: Transaction[]): [string, Transaction[]][] {
  const days = new Map<string, Transaction[]>();
  for (const item of items) {
    const day = localDate(new Date(item.occurredAt));
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return [...days.entries()];
}

/** History with filters kept in the address, so a filtered view can be bookmarked or refreshed. */
export function TransactionsPage() {
  const [params, setParams] = useSearchParams();
  const sheet = useTransactionSheet();
  const wallets = useWallets();
  const categories = useCategories(undefined, true);

  const month = localMonth();
  const filters = {
    from: params.get("from") ?? `${month}-01`,
    to: params.get("to") ?? lastDayOf(month),
    walletId: params.get("walletId") ?? "",
    categoryId: params.get("categoryId") ?? "",
    type: params.get("type") ?? "",
    search: params.get("search") ?? "",
    page: Number(params.get("page") ?? "1") || 1,
  };

  const [search, setSearch] = useState(filters.search);
  const [moreFilters, setMoreFilters] = useState(false);
  const activeExtra = [filters.walletId, filters.type, filters.categoryId].filter(Boolean).length;
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== filters.search) update({ search });
    }, 300);
    return () => clearTimeout(timer);
  });

  function update(changes: Partial<Record<keyof typeof filters, string | number>>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries({ ...changes, page: changes.page ?? 1 })) {
      if (value === "" || value === undefined || (key === "page" && value === 1)) next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next, { replace: true });
  }

  const list = useTransactions({ ...filters, pageSize: PAGE_SIZE });
  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;
  const ownWallets = (wallets.data?.wallets ?? []).filter((w) => w.personId === null);

  return (
    <>
      <PageHeader title="Transactions">
        <span className="hidden lg:block">
          <Button onClick={() => sheet.open()}>Add transaction</Button>
        </span>
      </PageHeader>

      <section aria-label="Filters" className="glass mb-4 grid grid-cols-1 gap-3 rounded-[22px] p-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField label="Search notes" type="search" value={search} placeholder="Bazaar, rent…" onChange={(e) => setSearch(e.target.value)} />
        <div className="grid grid-cols-2 gap-3 sm:col-span-1 lg:col-span-2">
          <TextField label="From" type="date" value={filters.from} max={filters.to} onChange={(e) => update({ from: e.target.value })} />
          <TextField label="To" type="date" value={filters.to} min={filters.from} onChange={(e) => update({ to: e.target.value })} />
        </div>
        <button
          type="button"
          aria-expanded={moreFilters}
          onClick={() => setMoreFilters((value) => !value)}
          className="h-9 cursor-pointer justify-self-start text-sm font-bold text-[var(--tl-primary)] sm:hidden"
        >
          {moreFilters ? "Fewer filters" : `More filters${activeExtra > 0 ? ` (${activeExtra})` : ""}`}
        </button>
        <div className={`${moreFilters ? "contents" : "hidden"} sm:contents`}>
        <SelectField label="Wallet" value={filters.walletId} onChange={(e) => update({ walletId: e.target.value })}>
          <option value="">All wallets</option>
          <WalletOptions wallets={ownWallets} />
        </SelectField>
        <SelectField label="Type" value={filters.type} onChange={(e) => update({ type: e.target.value })}>
          <option value="">All types</option>
          <option value="Expense">Expenses</option>
          <option value="Income">Income</option>
          <option value="Transfer">Transfers</option>
        </SelectField>
        <SelectField label="Category" value={filters.categoryId} onChange={(e) => update({ categoryId: e.target.value })}>
          <option value="">All categories</option>
          <CategoryOptions categories={categories.data ?? []} keep={filters.categoryId} />
        </SelectField>
        </div>
      </section>

      {data ? (
        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="glass rounded-[18px] p-3">
            <p className="m-0 text-[12px] font-semibold text-[var(--tl-muted)]">Income</p>
            <p className="m-0 truncate text-[15px] font-extrabold sm:text-base text-forest dark:text-income-dark">{formatBdt(data.totals.income)}</p>
          </div>
          <div className="glass rounded-[18px] p-3">
            <p className="m-0 text-[12px] font-semibold text-[var(--tl-muted)]">Expense</p>
            <p className="m-0 truncate text-[15px] font-extrabold sm:text-base text-expense dark:text-expense-dark">{formatBdt(data.totals.expense)}</p>
          </div>
          <div className="glass rounded-[18px] p-3">
            <p className="m-0 text-[12px] font-semibold text-[var(--tl-muted)]">Entries</p>
            <p className="m-0 text-base font-extrabold">{data.totalCount}</p>
          </div>
        </div>
      ) : null}

      <section className="glass rounded-[22px] p-3 sm:p-4">
        {list.isPending ? <Loading /> : null}
        {list.error ? <ErrorNote>{messageOf(list.error)}</ErrorNote> : null}
        {data && data.items.length === 0 ? (
          <EmptyState title="Nothing matches these filters">
            <p className="m-0 text-sm text-[var(--tl-muted)]">Try a wider date range or clear the search.</p>
          </EmptyState>
        ) : null}
        {data
          ? groupByDay(data.items).map(([day, items]) => (
              <div key={day} className="mb-2">
                <h2 className="m-0 px-2 pb-1 pt-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--tl-muted)]">
                  {dayLabel(day)}
                </h2>
                <ul className="m-0 flex list-none flex-col p-0">
                  {items.map((t) => (
                    <TransactionRow key={t.id} transaction={t} onOpen={sheet.open} />
                  ))}
                </ul>
              </div>
            ))
          : null}
        {data && pages > 1 ? (
          <nav aria-label="Pages" className="flex items-center justify-between gap-2 border-t border-[var(--tl-glass-border)] px-2 pt-3">
            <Button variant="secondary" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>
              Newer
            </Button>
            <span className="text-sm text-[var(--tl-muted)]">
              Page {filters.page} of {pages}
            </span>
            <Button variant="secondary" disabled={filters.page >= pages} onClick={() => update({ page: filters.page + 1 })}>
              Older
            </Button>
          </nav>
        ) : null}
      </section>
    </>
  );
}
