import { parseTaka } from "@takaleaf/shared";
import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { useCategories, useRecurringAction, useSaveRecurring, useWallets } from "../../api/queries";
import type { Frequency, RecurringRule, TransactionType } from "../../api/types";
import { Button, focusRing } from "../../ui/Button";
import { ErrorNote, messageOf } from "../../ui/Feedback";
import { AmountField, SelectField, TextField } from "../../ui/Field";
import { localDate, toAmountText } from "../../ui/format";
import { Modal } from "../../ui/Modal";
import { CategoryOptions, pickableWallets, WalletOptions } from "../transactions/pickers";

const TYPES: TransactionType[] = ["Expense", "Income", "Transfer"];
const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "Monthly", label: "Months" },
  { value: "Weekly", label: "Weeks" },
  { value: "Daily", label: "Days" },
  { value: "Yearly", label: "Years" },
];

export function RecurringForm({ rule, onClose }: { rule: RecurringRule | null; onClose: () => void }) {
  const wallets = useWallets();
  const save = useSaveRecurring();
  const action = useRecurringAction();
  const [type, setType] = useState<TransactionType>(rule?.type ?? "Expense");
  const [amount, setAmount] = useState(toAmountText(rule?.amount));
  const [fromWalletId, setFrom] = useState(rule?.fromWalletId ?? "");
  const [toWalletId, setTo] = useState(rule?.toWalletId ?? "");
  const [categoryId, setCategory] = useState(rule?.categoryId ?? "");
  const [note, setNote] = useState(rule?.note ?? "");
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? "Monthly");
  const [interval, setInterval] = useState(String(rule?.interval ?? 1));
  const [startDate, setStartDate] = useState(rule?.startDate ?? localDate());
  const [endDate, setEndDate] = useState(rule?.endDate ?? "");
  const [autoRecord, setAutoRecord] = useState(rule?.autoRecord ?? false);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categories = useCategories(type === "Income" ? "Income" : "Expense", Boolean(rule?.categoryId));
  const all = pickableWallets(wallets.data?.wallets ?? [], [rule?.fromWalletId, rule?.toWalletId]);
  const apiError = save.error instanceof ApiError ? save.error : null;
  const errorFor = (field: string) => problems[field] ?? apiError?.field(field);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const poisha = parseTaka(amount);
    const every = Number(interval);
    if (poisha === null || poisha <= 0) found.amount = "Enter an amount above zero, like 1250 or 1250.50.";
    if (type !== "Income" && !fromWalletId) found.fromWalletId = "Choose the wallet the money leaves.";
    if (type !== "Expense" && !toWalletId) found.toWalletId = "Choose the wallet the money goes to.";
    if (!Number.isInteger(every) || every < 1 || every > 366) found.interval = "Use a whole number from 1 to 366.";
    if (!startDate) found.startDate = "Choose the first date.";
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    await save
      .mutateAsync({
        id: rule?.id ?? null,
        input: {
          type,
          amount: poisha!,
          fromWalletId: type === "Income" ? null : fromWalletId,
          toWalletId: type === "Expense" ? null : toWalletId,
          categoryId: type === "Transfer" || !categoryId ? null : categoryId,
          note: note.trim() || null,
          frequency,
          interval: every,
          startDate,
          endDate: endDate || null,
          autoRecord,
        },
      })
      .then(onClose, () => {});
  }

  const run = (kind: "pause" | "resume" | "delete") => rule && action.mutateAsync({ id: rule.id, action: kind }).then(onClose, () => {});
  const generalError = apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : messageOf(action.error);

  return (
    <Modal title={rule ? "Edit recurring" : "Add recurring"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-1 rounded-[16px] bg-[var(--tl-chip)] p-1">
          {TYPES.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={type === option}
              onClick={() => {
                setType(option);
                setCategory("");
              }}
              className={`h-10 cursor-pointer rounded-[12px] text-sm font-bold ${focusRing} ${
                type === option ? "bg-[var(--tl-surface)] text-[var(--tl-primary)] shadow-sm" : "text-[var(--tl-muted)]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <AmountField label="Amount (৳)" value={amount} onChange={(e) => setAmount(e.target.value)} error={errorFor("amount")} hint="You can change it each time you record." />
        <div className={`grid gap-4 ${type === "Transfer" ? "sm:grid-cols-2" : ""}`}>
          {type !== "Income" ? (
            <SelectField label={type === "Transfer" ? "From" : "Paid from"} value={fromWalletId} onChange={(e) => setFrom(e.target.value)} error={errorFor("fromWalletId")}>
              <option value="">Choose a wallet</option>
              <WalletOptions wallets={all} />
            </SelectField>
          ) : null}
          {type !== "Expense" ? (
            <SelectField label={type === "Transfer" ? "To" : "Received in"} value={toWalletId} onChange={(e) => setTo(e.target.value)} error={errorFor("toWalletId")}>
              <option value="">Choose a wallet</option>
              <WalletOptions wallets={all} />
            </SelectField>
          ) : null}
        </div>
        {type !== "Transfer" ? (
          <SelectField label="Category" value={categoryId} onChange={(e) => setCategory(e.target.value)} error={errorFor("categoryId")}>
            <option value="">No category</option>
            <CategoryOptions categories={categories.data ?? []} keep={rule?.categoryId} />
          </SelectField>
        ) : null}
        <TextField label="Note (optional)" value={note} maxLength={500} placeholder="House rent, Claude Pro…" onChange={(e) => setNote(e.target.value)} />

        <fieldset className="m-0 grid grid-cols-[6rem_1fr] gap-3 border-0 p-0">
          <legend className="mb-1.5 text-small font-bold">Repeat every</legend>
          <TextField label="How many" type="number" min={1} max={366} value={interval} onChange={(e) => setInterval(e.target.value)} error={errorFor("interval")} />
          <SelectField label="Unit" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {Number(interval) === 1 ? f.label.slice(0, -1) : f.label}
              </option>
            ))}
          </SelectField>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="First date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} error={errorFor("startDate")} />
          <TextField label="Last date (optional)" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} error={errorFor("endDate")} />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={autoRecord} onChange={(e) => setAutoRecord(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--tl-primary)]" />
          <span>
            Record it automatically
            <span className="block text-small text-[var(--tl-muted)]">Otherwise it waits for you to record or skip each time, with the amount you choose.</span>
          </span>
        </label>

        <ErrorNote>{generalError}</ErrorNote>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {rule ? (
            <span className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => run(rule.paused ? "resume" : "pause")} disabled={action.isPending}>
                {rule.paused ? "Resume" : "Pause"}
              </Button>
              {confirmDelete ? (
                <Button variant="danger" onClick={() => run("delete")} disabled={action.isPending}>
                  Yes, delete
                </Button>
              ) : (
                <Button variant="ghost" className="text-expense dark:text-expense-dark" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </span>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </span>
        </div>
        {rule && confirmDelete ? <p className="m-0 text-small text-[var(--tl-muted)]">Transactions it already recorded stay in your history. To stop it for a while, use Pause instead.</p> : null}
      </form>
    </Modal>
  );
}
