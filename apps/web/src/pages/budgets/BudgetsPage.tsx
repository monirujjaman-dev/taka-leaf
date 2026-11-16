import { formatBdt, parseTaka } from "@takaleaf/shared";
import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { useBudgets, useCategories, useDeleteBudget, useSaveBudget } from "../../api/queries";
import type { Budget } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { Button, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf } from "../../ui/Feedback";
import { AmountField, SelectField } from "../../ui/Field";
import { localMonth, monthLabel, toAmountText } from "../../ui/format";
import { Modal } from "../../ui/Modal";
import { MonthSwitcher } from "../dashboard/DashboardPage";
import { CategoryOptions } from "../transactions/pickers";

const BAR = { OnTrack: "bg-leaf", Near: "bg-[#c98a1b]", Over: "bg-expense dark:bg-expense-dark" } as const;
const NOTE = { OnTrack: "", Near: "Close to the limit", Over: "Over budget" } as const;

export function BudgetBar({ budget }: { budget: Budget }) {
  return (
    <>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--tl-chip)]" aria-hidden="true">
        <div className={`h-full rounded-full ${BAR[budget.status]}`} style={{ width: `${Math.min(Math.max(budget.percent, 2), 100)}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-[13px]">
        <span className="text-[var(--tl-muted)]">
          {formatBdt(budget.spent)} of {formatBdt(budget.amount)}
        </span>
        <span className={budget.status === "Over" ? "font-bold text-expense dark:text-expense-dark" : "font-semibold"}>
          {budget.remaining >= 0 ? `${formatBdt(budget.remaining)} left` : `${formatBdt(-budget.remaining)} over`}
        </span>
      </div>
    </>
  );
}

function BudgetForm({ budget, taken, onClose }: { budget: Budget | null; taken: (string | null)[]; onClose: () => void }) {
  const categories = useCategories("Expense");
  const save = useSaveBudget();
  const remove = useDeleteBudget();
  const [categoryId, setCategoryId] = useState<string>(budget?.categoryId ?? (taken.includes(null) ? "" : "all"));
  const [amount, setAmount] = useState(toAmountText(budget?.amount));
  const [problem, setProblem] = useState<string | null>(null);
  const apiError = save.error instanceof ApiError ? save.error : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const poisha = parseTaka(amount);
    if (poisha === null || poisha <= 0) return setProblem("Enter a monthly amount above zero, like 20000.");
    setProblem(null);
    await save
      .mutateAsync({ id: budget?.id ?? null, categoryId: categoryId === "all" ? null : categoryId, amount: poisha })
      .then(onClose, () => {});
  }

  return (
    <Modal title={budget ? `${budget.name} budget` : "Add a budget"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {budget ? null : (
          <SelectField label="For" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} error={apiError?.field("categoryId")}>
            <option value="">Choose…</option>
            {taken.includes(null) ? null : <option value="all">All spending</option>}
            <CategoryOptions categories={(categories.data ?? []).map((c) => ({ ...c, children: c.children.filter((x) => !taken.includes(x.id)) })).filter((c) => !taken.includes(c.id))} />
          </SelectField>
        )}
        <AmountField
          label="Monthly limit (৳)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={problem ?? apiError?.field("amount")}
          hint="The same limit applies every month."
        />
        <ErrorNote>{apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : messageOf(remove.error)}</ErrorNote>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {budget ? (
            <Button variant="ghost" className="text-expense dark:text-expense-dark" onClick={() => remove.mutateAsync(budget.id).then(onClose, () => {})}>
              Remove budget
            </Button>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || (!budget && categoryId === "")}>
              Save
            </Button>
          </span>
        </div>
      </form>
    </Modal>
  );
}

export function BudgetsPage() {
  const [month, setMonth] = useState(localMonth);
  const budgets = useBudgets(month);
  const [editing, setEditing] = useState<Budget | "new" | null>(null);
  const list = budgets.data?.budgets ?? [];

  return (
    <>
      <PageHeader title="Budgets">
        <MonthSwitcher month={month} onChange={setMonth} />
        <Button onClick={() => setEditing("new")}>Add a budget</Button>
      </PageHeader>

      {budgets.isPending ? <Loading /> : null}
      {budgets.error ? <ErrorNote>{messageOf(budgets.error)}</ErrorNote> : null}
      {budgets.isSuccess && list.length === 0 ? (
        <section className="glass rounded-[22px]">
          <EmptyState title="No budgets yet">
            <p className="m-0 max-w-sm text-sm text-[var(--tl-muted)]">
              Set a monthly limit for all spending, or for a category like Food and dining, and see how {monthLabel(month).split(" ")[0]} is going.
            </p>
          </EmptyState>
        </section>
      ) : null}

      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
        {list.map((budget) => (
          <li key={budget.id}>
            <button
              type="button"
              onClick={() => setEditing(budget)}
              className={`glass block w-full cursor-pointer rounded-[20px] p-4 text-left ${focusRing}`}
              aria-label={`${budget.name}: ${budget.percent}% used. Edit`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-base font-extrabold">{budget.name}</span>
                <span className="shrink-0 text-sm font-bold">{budget.percent}%</span>
              </span>
              {NOTE[budget.status] ? (
                <span className={`text-[12px] font-bold ${budget.status === "Over" ? "text-expense dark:text-expense-dark" : "text-[#9a6a10] dark:text-[#e8b766]"}`}>
                  {NOTE[budget.status]}
                </span>
              ) : null}
              <BudgetBar budget={budget} />
            </button>
          </li>
        ))}
      </ul>

      {editing ? (
        <BudgetForm budget={editing === "new" ? null : editing} taken={list.map((b) => b.categoryId)} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
