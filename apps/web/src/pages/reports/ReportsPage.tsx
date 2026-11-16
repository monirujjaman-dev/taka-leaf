import { formatBdt } from "@takaleaf/shared";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useBudgets, useReport } from "../../api/queries";
import type { CategoryTotal, Report, ReportPeriod } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { Segmented } from "../../ui/Parts";
import { focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { compactTaka, localMonth, monthLabel, shortMonth } from "../../ui/format";
import { BudgetBar } from "../budgets/BudgetsPage";
import { MonthPicker } from "../../ui/MonthPicker";

function YearSwitcher({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  const current = Number(localMonth().slice(0, 4));
  return (
    <div className="glass inline-flex items-center gap-1 rounded-[14px] p-1">
      <button type="button" aria-label="Previous year" onClick={() => onChange(year - 1)} className={`grid h-11 w-11 cursor-pointer place-items-center rounded-[10px] hover:bg-[var(--tl-chip)] ${focusRing}`}>
        <Icon name="left" size={18} />
      </button>
      <span className="min-w-20 text-center text-sm font-bold" aria-live="polite">
        {year}
      </span>
      <button
        type="button"
        aria-label="Next year"
        disabled={year >= current}
        onClick={() => onChange(year + 1)}
        className={`grid h-11 w-11 cursor-pointer place-items-center rounded-[10px] hover:bg-[var(--tl-chip)] disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
      >
        <Icon name="right" size={18} />
      </button>
    </div>
  );
}

function Bar({ share, tone }: { share: number; tone: "leaf" | "income" | "expense" }) {
  const fill = { leaf: "bg-leaf", income: "bg-leaf", expense: "bg-expense dark:bg-expense-dark" }[tone];
  return (
    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--tl-chip)]" aria-hidden="true">
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${share > 0 ? Math.max(share * 100, 2) : 0}%` }} />
    </div>
  );
}

function IncomeAndExpense({ report }: { report: Report }) {
  const max = Math.max(report.income, report.expense, 1);
  return (
    <section className="glass min-w-0 rounded-[22px] p-5" aria-labelledby="ie-title">
      <h2 id="ie-title" className="m-0 mb-3 text-base font-extrabold">
        Income and expense
      </h2>
      {[
        ["Income", report.income, "income"],
        ["Expense", report.expense, "expense"],
      ].map(([label, amount, tone]) => (
        <div key={label as string} className="mb-3">
          <div className="flex justify-between gap-2 text-sm font-bold">
            <span>{label}</span>
            <span>{formatBdt(amount as number)}</span>
          </div>
          <Bar share={(amount as number) / max} tone={tone as "income" | "expense"} />
        </div>
      ))}
      <p className={`m-0 text-sm font-bold ${report.saved < 0 ? "text-expense dark:text-expense-dark" : "text-[var(--tl-primary)]"}`}>
        {report.saved >= 0
          ? `Saved ${formatBdt(report.saved)}${report.savedPercent !== null ? ` · ${report.savedPercent}% of income` : ""}`
          : `Spent ${formatBdt(-report.saved)} more than came in`}
      </p>
    </section>
  );
}

function Trend({ report }: { report: Report }) {
  const max = Math.max(...report.trend.map((t) => t.expense), 1);
  const last = report.trend.at(-1)?.month;
  const title = report.period === "Year" ? `Expense by month, ${report.label}` : "Expense, last 6 months";
  return (
    <section className="glass min-w-0 rounded-[22px] p-5" aria-labelledby="trend-title">
      <h2 id="trend-title" className="m-0 mb-3 text-base font-extrabold">
        {title}
      </h2>
      <ol className="m-0 flex h-40 list-none items-end gap-1.5 p-0 sm:gap-2.5">
        {report.trend.map((point) => {
          const highlight = report.period === "Month" && point.month === last;
          return (
            <li key={point.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-bold text-[var(--tl-muted)] sm:text-[11px]" aria-hidden="true">
                {point.expense > 0 ? compactTaka(point.expense) : ""}
              </span>
              <div
                aria-hidden="true"
                className={`w-full max-w-11 rounded-t-[8px] rounded-b-[3px] ${highlight ? "bg-forest dark:bg-sage" : "bg-sage dark:bg-leaf"}`}
                style={{ height: `${point.expense > 0 ? Math.max((point.expense / max) * 100, 3) : 1}%` }}
              />
              <span className={`text-[11px] font-bold sm:text-[12px] ${highlight ? "" : "text-[var(--tl-muted)]"}`}>
                <span aria-hidden="true">{shortMonth(point.month)}</span>
                <span className="sr-only">
                  {monthLabel(point.month)}: {formatBdt(point.expense)} spent
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Each category opens to its sub-categories; every line links to the matching transactions. */
function ByCategory({ title, rows, total, report, type }: { title: string; rows: CategoryTotal[]; total: number; report: Report; type: "Expense" | "Income" }) {
  const [open, setOpen] = useState<string | null>(null);
  const link = (categoryId: string | null) =>
    `/transactions?from=${report.from}&to=${report.to}&type=${type}&${categoryId ? `categoryId=${categoryId}` : "uncategorised=true"}`;

  return (
    <section className="glass min-w-0 rounded-[22px] p-5" aria-labelledby={`${type}-title`}>
      <h2 id={`${type}-title`} className="m-0 mb-1 text-base font-extrabold">
        {title}
      </h2>
      <p className="mb-3 mt-0 text-[13px] text-[var(--tl-muted)]">
        {formatBdt(total)} in all · open a category to see what is in it
      </p>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-[var(--tl-muted)]">Nothing in this period.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {rows.map((row) => {
            const key = row.categoryId ?? "none";
            const expanded = open === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : key)}
                  className={`w-full cursor-pointer rounded-[14px] px-2 py-2 text-left hover:bg-[var(--tl-chip)] ${focusRing}`}
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-1 font-bold">
                      <Icon name={expanded ? "down" : "right"} size={14} className="shrink-0 text-[var(--tl-muted)]" />
                      <span className="truncate">{row.name}</span>
                    </span>
                    <span className="shrink-0 font-bold">
                      {formatBdt(row.amount)} <span className="font-semibold text-[var(--tl-muted)]">· {row.percent}%</span>
                    </span>
                  </span>
                  <Bar share={row.percent / 100} tone="leaf" />
                </button>
                {expanded ? (
                  <ul className="m-0 mb-2 ml-6 mt-1 flex list-none flex-col gap-0.5 border-l border-[var(--tl-glass-border)] p-0 pl-3">
                    {row.children.map((child) => (
                      <li key={child.categoryId ?? "none"}>
                        <Link
                          to={link(child.categoryId)}
                          className={`flex justify-between gap-3 rounded-[10px] px-2 py-1.5 text-[13px] hover:bg-[var(--tl-chip)] ${focusRing}`}
                        >
                          <span className="truncate">{child.name}</span>
                          <span className="shrink-0 font-bold">{formatBdt(child.amount)}</span>
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link to={link(row.categoryId)} className="inline-block px-2 py-1.5 text-[13px] font-bold text-[var(--tl-primary)]">
                        See all {row.name} transactions
                      </Link>
                    </li>
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MonthBudgets({ month }: { month: string }) {
  const budgets = useBudgets(month);
  const list = budgets.data?.budgets ?? [];
  if (list.length === 0) return null;
  return (
    <section className="glass min-w-0 rounded-[22px] p-5" aria-labelledby="rb-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="rb-title" className="m-0 text-base font-extrabold">
          Budgets
        </h2>
        <Link to="/budgets" className="text-sm font-bold text-[var(--tl-primary)]">
          All
        </Link>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {list.map((budget) => (
          <li key={budget.id}>
            <span className="text-sm font-semibold">{budget.name}</span>
            <BudgetBar budget={budget} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Period and month/year live in the address, so a report can be bookmarked. */
export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const period: ReportPeriod = params.get("period") === "Year" ? "Year" : "Month";
  const month = params.get("month") ?? localMonth();
  const year = Number(params.get("year") ?? localMonth().slice(0, 4));
  const report = useReport(period, period === "Year" ? String(year) : month);

  const set = (changes: Record<string, string>) => setParams({ ...Object.fromEntries(params), ...changes }, { replace: true });

  return (
    <>
      <PageHeader title="Reports">
        <Segmented
          label="Period"
          className="w-44"
          options={[
            { value: "Month", label: "Month" },
            { value: "Year", label: "Year" },
          ]}
          value={period}
          onChange={(option) => set({ period: option })}
        />
        {period === "Month" ? (
          <MonthPicker month={month} onChange={(m) => set({ month: m })} />
        ) : (
          <YearSwitcher year={year} onChange={(y) => set({ year: String(y) })} />
        )}
      </PageHeader>

      {report.isPending ? <Loading /> : null}
      {report.error ? <ErrorNote>{messageOf(report.error)}</ErrorNote> : null}

      {report.data ? (
        report.data.income === 0 && report.data.expense === 0 && report.data.trend.every((t) => t.expense === 0) ? (
          <section className="glass rounded-[22px]">
            <EmptyState title={`Nothing recorded in ${period === "Year" ? year : monthLabel(month)}`}>
              <p className="m-0 text-sm text-[var(--tl-muted)]">Reports fill in as you add income and expenses.</p>
            </EmptyState>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <IncomeAndExpense report={report.data} />
            <Trend report={report.data} />
            <ByCategory title="Spending by category" rows={report.data.spending} total={report.data.expense} report={report.data} type="Expense" />
            <div className="flex min-w-0 flex-col gap-4">
              {period === "Month" ? <MonthBudgets month={month} /> : null}
              <ByCategory title="Income by category" rows={report.data.earning} total={report.data.income} report={report.data} type="Income" />
            </div>
          </div>
        )
      ) : null}
    </>
  );
}
