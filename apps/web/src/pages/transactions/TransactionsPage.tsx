import { formatBdt } from "@takaleaf/shared";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { download } from "../../api/client";
import { useCategories, useTransactions, useWallets } from "../../api/queries";
import type { Transaction } from "../../api/types";
import { AddTransactionButton, PageHeader } from "../../layout/AppShell";
import { useOpenTransaction } from "../../layout/TransactionSheet";
import { Button, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf, LoadError } from "../../ui/Feedback";
import { TextField } from "../../ui/Field";
import { Icon } from "../../ui/Icon";
import { MonthPicker } from "../../ui/MonthPicker";
import { ListCard, Segmented } from "../../ui/Parts";
import { useWide } from "../../ui/useWide";
import { dayHeading, lastDayOf, localDate, localMonth, monthLabel, shortDate, signedAmount } from "../../ui/format";
import { CategoryOptions, WalletOptions } from "./pickers";
import { describe, TransactionRow } from "./TransactionRow";

const PAGE_SIZE = 50;

const TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "Expense", label: "Expense" },
  { value: "Income", label: "Income" },
  { value: "Transfer", label: "Transfer" },
];

const AMOUNT_TONE = {
  Income: "text-forest dark:text-income-dark",
  Expense: "text-expense dark:text-expense-dark",
  Transfer: "",
} as const;

function groupByDay(items: Transaction[]): [string, Transaction[]][] {
  const days = new Map<string, Transaction[]>();
  for (const item of items) {
    const day = localDate(new Date(item.occurredAt));
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return [...days.entries()];
}

/** Money in minus money out for a day; transfers move money between own wallets and count as zero. */
function dayTotal(items: Transaction[]): string {
  const net = items.reduce((sum, t) => sum + (t.type === "Income" ? t.amount : t.type === "Expense" ? -t.amount : 0), 0);
  return net > 0 ? `+${formatBdt(net)}` : formatBdt(net);
}

/** A glass select that looks like the design's "All wallets ▾" filter buttons. */
function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <span className="glass relative inline-flex h-11 min-w-0 items-center rounded-[14px]">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-full w-full min-w-0 cursor-pointer appearance-none truncate rounded-[14px] bg-transparent pl-3.5 pr-9 text-sm font-bold text-[var(--tl-text)] ${focusRing}`}
      >
        {children}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 flex">
        <Icon name="down" size={16} />
      </span>
    </span>
  );
}

/** History with filters kept in the address, so a filtered view can be bookmarked or refreshed. */
export function TransactionsPage() {
  const [params, setParams] = useSearchParams();
  const openRow = useOpenTransaction();
  const wallets = useWallets();
  const categories = useCategories(undefined, true);
  const wide = useWide();

  const month = localMonth();
  const filters = {
    from: params.get("from") ?? `${month}-01`,
    to: params.get("to") ?? lastDayOf(month),
    walletId: params.get("walletId") ?? "",
    categoryId: params.get("categoryId") ?? "",
    uncategorised: params.get("uncategorised") === "true" ? "true" : "",
    type: params.get("type") ?? "",
    search: params.get("search") ?? "",
    page: Number(params.get("page") ?? "1") || 1,
  };

  const [search, setSearch] = useState(filters.search);
  const [showFilters, setShowFilters] = useState(false);
  const customRange = !(filters.from.endsWith("-01") && filters.to === lastDayOf(filters.from.slice(0, 7)));
  const activeExtra = [filters.walletId, filters.categoryId, filters.uncategorised, customRange ? "range" : ""].filter(Boolean).length;
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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /** The same filters as the list, without paging: the file holds every matching row. */
  async function exportCsv() {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (key !== "page" && value !== "") query.set(key, String(value));
    }
    setExporting(true);
    setExportError(null);
    try {
      await download(`/transactions/export.csv?${query}`, "takaleaf-transactions.csv");
    } catch (error) {
      setExportError(messageOf(error));
    } finally {
      setExporting(false);
    }
  }
  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;
  const ownWallets = (wallets.data?.wallets ?? []).filter((w) => w.personId === null);

  // A whole calendar month reads as "November 2026"; anything else as its two dates.
  const wholeMonth = filters.from.endsWith("-01") && filters.to === lastDayOf(filters.from.slice(0, 7));
  const rangeMonth = wholeMonth ? filters.from.slice(0, 7) : "";
  const rangeLabel = wholeMonth ? monthLabel(rangeMonth) : `${shortDate(filters.from)} – ${shortDate(filters.to)}`;
  const setMonth = (m: string) => update({ from: `${m}-01`, to: lastDayOf(m) });

  const walletSelect = (
    <FilterSelect label="Wallet" value={filters.walletId} onChange={(v) => update({ walletId: v })}>
      <option value="">All wallets</option>
      <WalletOptions wallets={ownWallets} />
    </FilterSelect>
  );
  const categorySelect = (
    <FilterSelect
      label="Category"
      value={filters.uncategorised ? "none" : filters.categoryId}
      onChange={(v) => (v === "none" ? update({ categoryId: "", uncategorised: "true" }) : update({ categoryId: v, uncategorised: "" }))}
    >
      <option value="">All categories</option>
      <option value="none">No category</option>
      <CategoryOptions categories={categories.data ?? []} keep={filters.categoryId} />
    </FilterSelect>
  );

  return (
    <>
      <PageHeader title="Transactions">
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          aria-label={exporting ? "Preparing CSV" : "Export CSV"}
          className={`glass inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-[14px] px-3 text-sm font-bold disabled:opacity-50 lg:px-3.5 ${focusRing}`}
        >
          <span className="hidden lg:inline">{exporting ? "Preparing…" : "Export"}</span>
          <Icon name="download" size={16} />
        </button>
        <AddTransactionButton />
      </PageHeader>

      {exportError ? (
        <div className="mb-3">
          <ErrorNote>{exportError}</ErrorNote>
        </div>
      ) : null}

      <section aria-label="Filters" className="mb-3 flex flex-col gap-3 lg:mb-5">
        <div className="flex flex-wrap gap-2.5">
          <label className="glass flex h-11 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-[14px] px-3 text-[var(--tl-muted)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--tl-primary)]">
            <Icon name="search" size={18} />
            <span className="sr-only">Search transactions</span>
            <input
              type="search"
              value={search}
              placeholder="Search transactions"
              onChange={(e) => setSearch(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-[var(--tl-text)] outline-none placeholder:text-[var(--tl-muted)]"
            />
          </label>
          {wide ? (
            <>
              <MonthPicker month={rangeMonth || month} onChange={setMonth} />
              {walletSelect}
              {categorySelect}
              <FilterSelect label="Type" value={filters.type} onChange={(v) => update({ type: v })}>
                <option value="">All types</option>
                <option value="Expense">Expenses</option>
                <option value="Income">Income</option>
                <option value="Transfer">Transfers</option>
              </FilterSelect>
            </>
          ) : null}
          <button
            type="button"
            aria-expanded={showFilters}
            aria-label={activeExtra > 0 ? `Filters (${activeExtra} on)` : "Filters"}
            onClick={() => setShowFilters((v) => !v)}
            className={`relative grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[14px] ${focusRing} ${
              showFilters ? "bg-forest text-white" : "glass"
            }`}
          >
            <Icon name="filter" size={20} />
            {activeExtra > 0 && !showFilters ? (
              <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-forest dark:bg-sage" />
            ) : null}
          </button>
        </div>

        {showFilters ? (
          <div className="glass grid grid-cols-2 gap-3 rounded-[20px] p-4 lg:grid-cols-4">
            <TextField label="From" type="date" value={filters.from} max={filters.to} onChange={(e) => update({ from: e.target.value })} />
            <TextField label="To" type="date" value={filters.to} min={filters.from} onChange={(e) => update({ to: e.target.value })} />
            {wide ? null : (
              <>
                <div className="col-span-2 grid gap-3">
                  {walletSelect}
                  {categorySelect}
                </div>
              </>
            )}
          </div>
        ) : null}

        {wide ? null : (
          <Segmented label="Type" options={TYPE_OPTIONS} value={filters.type} onChange={(v) => update({ type: v })} />
        )}

        {data && !wide ? (
          <div className="glass flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[18px] px-4 py-3">
            <span className="text-sm font-extrabold">{rangeLabel}</span>
            <span className="flex gap-3 text-[13px] font-semibold text-[var(--tl-muted)]">
              <span>
                In <b className="text-forest dark:text-income-dark">{formatBdt(data.totals.income)}</b>
              </span>
              <span>
                Out <b className="text-expense dark:text-expense-dark">{formatBdt(data.totals.expense)}</b>
              </span>
            </span>
          </div>
        ) : null}
      </section>

      {list.isPending ? <Loading /> : null}
      <LoadError query={list} />
      {data && data.items.length === 0 ? (
        <section className="glass rounded-[22px]">
          <EmptyState title="Nothing matches these filters">
            <p className="m-0 text-sm text-[var(--tl-muted)]">Try a wider date range or clear the search.</p>
          </EmptyState>
        </section>
      ) : null}

      {data && data.items.length > 0 && wide ? (
        <section className="glass min-w-0 rounded-[22px] px-2 pb-3 pt-2">
          <p className="m-0 flex flex-wrap gap-x-5 px-3 pb-1 pt-1 text-[13px] font-semibold text-[var(--tl-muted)]">
            <span>{rangeLabel}</span>
            <span>
              In <b className="text-forest dark:text-income-dark">{formatBdt(data.totals.income)}</b>
            </span>
            <span>
              Out <b className="text-expense dark:text-expense-dark">{formatBdt(data.totals.expense)}</b>
            </span>
            <span>{data.totalCount} entries</span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="text-left text-[12px] font-extrabold text-[var(--tl-muted)]">
                  {["Date", "Description", "Category", "Wallet"].map((h) => (
                    <th key={h} scope="col" className="h-11 border-b border-[var(--tl-glass-border)] px-3">
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="h-11 border-b border-[var(--tl-glass-border)] px-3 text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => {
                  const { title: described } = describe(t);
                  const title = t.feeOfId || t.personId || t.type === "Transfer" ? described : (t.note ?? described);
                  const wallet =
                    t.type === "Transfer" ? `${t.fromWalletName} → ${t.toWalletName}` : t.type === "Income" ? t.toWalletName : t.fromWalletName;
                  const category = t.type === "Transfer" ? "Transfer" : t.personId ? "Loan" : (t.categoryName ?? "No category");
                  return (
                    <tr key={t.id} className="text-sm hover:bg-[var(--tl-chip)]">
                      <td className="h-[52px] whitespace-nowrap border-b border-[var(--tl-glass-border)] px-3 text-[var(--tl-muted)]">
                        {shortDate(t.occurredAt)}
                      </td>
                      <td className="h-[52px] border-b border-[var(--tl-glass-border)] px-3 font-bold">
                        <button type="button" onClick={() => openRow(t)} className={`cursor-pointer rounded-[6px] text-left hover:underline ${focusRing}`}>
                          {title}
                        </button>
                      </td>
                      <td className="h-[52px] whitespace-nowrap border-b border-[var(--tl-glass-border)] px-3">{category}</td>
                      <td className="h-[52px] whitespace-nowrap border-b border-[var(--tl-glass-border)] px-3">{wallet}</td>
                      <td className={`h-[52px] whitespace-nowrap border-b border-[var(--tl-glass-border)] px-3 text-right font-extrabold ${AMOUNT_TONE[t.type]}`}>
                        {signedAmount(t)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {data && data.items.length > 0 && !wide ? (
        <div className="flex flex-col gap-2.5">
          {groupByDay(data.items).map(([day, items]) => (
            <section key={day} aria-label={dayHeading(day)} className="flex flex-col gap-2">
              <div className="mt-1 flex items-center justify-between gap-3">
                <h2 className="m-0 text-[13px] font-extrabold text-[var(--tl-muted)]">{dayHeading(day)}</h2>
                <span className="text-[13px] font-bold text-[var(--tl-muted)]">{dayTotal(items)}</span>
              </div>
              <ListCard>
                <ul className="m-0 flex list-none flex-col p-0">
                  {items.map((t) => (
                    <TransactionRow key={t.id} transaction={t} onOpen={openRow} />
                  ))}
                </ul>
              </ListCard>
            </section>
          ))}
        </div>
      ) : null}

      {data && pages > 1 ? (
        <nav aria-label="Pages" className="mt-3 flex items-center justify-between gap-2">
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
    </>
  );
}
