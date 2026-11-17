import { formatBdt, parseTaka } from "@takaleaf/shared";
import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { useBudgets, useCategories, useDeleteBudget, useSaveBudget } from "../../api/queries";
import type { Budget } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { Button, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf, LoadError } from "../../ui/Feedback";
import { AmountField, SelectField } from "../../ui/Field";
import { lastDayOf, localDate, localMonth, monthLabel, toAmountText } from "../../ui/format";
import { Icon } from "../../ui/Icon";
import { IconTile, iconButtonClass, LeafWatermark, ListCard } from "../../ui/Parts";
import { Modal } from "../../ui/Modal";
import { MonthPicker } from "../../ui/MonthPicker";
import { CategoryOptions } from "../transactions/pickers";
import { BudgetBar } from "./BudgetBar";


function BudgetForm({ budget, taken, onClose }: { budget: Budget | null; taken: (string | null)[]; onClose: () => void }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
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
            <option value="">Choose a category</option>
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
            confirmRemove ? (
              <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutateAsync(budget.id).then(onClose, () => {})}>
                Yes, remove
              </Button>
            ) : (
              <Button variant="ghost" className="text-expense dark:text-expense-dark" onClick={() => setConfirmRemove(true)}>
                Remove budget
              </Button>
            )
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
        {budget && confirmRemove ? (
          <p className="m-0 text-[13px] text-[var(--tl-muted)]">Your spending stays as it is. Only this monthly limit goes.</p>
        ) : null}
      </form>
    </Modal>
  );
}

function daysToGo(month: string): number | null {
  if (month !== localMonth()) return null;
  const today = Number(localDate().slice(8, 10));
  return Number(lastDayOf(month).slice(8, 10)) - today + 1;
}

export function BudgetsPage() {
  const [month, setMonth] = useState(localMonth);
  const budgets = useBudgets(month);
  const [editing, setEditing] = useState<Budget | "new" | null>(null);
  const list = budgets.data?.budgets ?? [];
  // An "All spending" budget is the month's total; otherwise the category budgets add up to it.
  const overall = list.find((b) => b.categoryId === null);
  const total = overall
    ? { spent: overall.spent, amount: overall.amount }
    : { spent: list.reduce((s, b) => s + b.spent, 0), amount: list.reduce((s, b) => s + b.amount, 0) };
  const left = total.amount - total.spent;
  const days = daysToGo(month);

  return (
    <>
      <PageHeader
        title="Budgets"
        back="/settings"
        phoneAction={
          <button type="button" aria-label="Add a budget" onClick={() => setEditing("new")} className={iconButtonClass}>
            <Icon name="plus" size={20} />
          </button>
        }
      >
        <MonthPicker month={month} onChange={setMonth} />
        <Button onClick={() => setEditing("new")}>
          <Icon name="plus" size={18} /> Add a budget
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 lg:max-w-3xl">
        <div className="lg:hidden">
          <MonthPicker month={month} onChange={setMonth} />
        </div>

        {budgets.isPending ? <Loading /> : null}
        <LoadError query={budgets} />
        {budgets.isSuccess && list.length === 0 ? (
          <section className="glass rounded-[22px]">
            <EmptyState title="No budgets yet">
              <p className="m-0 max-w-sm text-sm text-[var(--tl-muted)]">
                Set a monthly limit for all spending, or for a category like Food and dining, and see how {monthLabel(month).split(" ")[0]} is going.
              </p>
            </EmptyState>
          </section>
        ) : null}

        {list.length > 0 ? (
          <section
            aria-label="Monthly budget"
            className="relative overflow-hidden rounded-[26px] bg-forest p-5 text-white shadow-hero"
          >
            <LeafWatermark />
            <p className="relative m-0 text-[13px] font-semibold text-mint">{monthLabel(month).split(" ")[0]} budget</p>
            <p className="relative m-0 mt-1 text-[28px] font-extrabold tracking-[-0.5px] [overflow-wrap:anywhere]">
              {formatBdt(total.spent)} <span className="text-[15px] font-semibold text-mint">of {formatBdt(total.amount)}</span>
            </p>
            <div className="relative mt-3.5 h-2 overflow-hidden rounded-[4px] bg-white/25" aria-hidden="true">
              <div className="h-full rounded-[4px] bg-white" style={{ width: `${total.amount > 0 ? Math.min(100, (total.spent / total.amount) * 100) : 0}%` }} />
            </div>
            <p className="relative m-0 mt-2.5 text-[13px] font-semibold text-mint">
              {left >= 0 ? `${formatBdt(left)} left` : `${formatBdt(-left)} over`}
              {days !== null ? ` · ${days} ${days === 1 ? "day" : "days"} to go` : ""}
            </p>
          </section>
        ) : null}

        {list.length > 0 ? (
          <ListCard>
            <ul className="m-0 flex list-none flex-col p-0">
              {list.map((budget) => (
                <li key={budget.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(budget)}
                    className={`-mx-1.5 flex w-[calc(100%+12px)] cursor-pointer items-center gap-3 rounded-[14px] px-1.5 py-2.5 text-left hover:bg-[var(--tl-chip)] ${focusRing}`}
                  >
                    <IconTile icon={budget.categoryId ? "tag" : "target"} />
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2 text-sm font-bold">
                        <span className="truncate">{budget.name}</span>
                        <span className="shrink-0">
                          {formatBdt(budget.spent)} / {formatBdt(budget.amount)}
                        </span>
                      </span>
                      <BudgetBar budget={budget} />
                    </span>
                    {/* The name keeps what was spent and what is left; this only adds the action. */}
                    <span className="sr-only">, edit</span>
                  </button>
                </li>
              ))}
            </ul>
          </ListCard>
        ) : null}
      </div>

      {editing ? (
        <BudgetForm budget={editing === "new" ? null : editing} taken={list.map((b) => b.categoryId)} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
