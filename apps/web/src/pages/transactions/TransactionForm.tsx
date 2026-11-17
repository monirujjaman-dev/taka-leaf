import { formatBdt, parseTaka } from "@takaleaf/shared";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "../../api/client";
import { useCategories, useDeleteTransaction, useSaveTransaction, useTransaction, useWallets } from "../../api/queries";
import type { Category, Transaction, TransactionInput, TransactionType } from "../../api/types";
import { Button, focusRing } from "../../ui/Button";
import { ErrorNote, Loading, messageOf, LoadError } from "../../ui/Feedback";
import { AmountField } from "../../ui/Field";
import { Icon, type IconName } from "../../ui/Icon";
import { Segmented } from "../../ui/Parts";
import { useWide } from "../../ui/useWide";
import { fromLocalInput, toAmountText, toLocalInput } from "../../ui/format";
import { Modal } from "../../ui/Modal";
import { CategoryOptions, pickableWallets, WalletOptions } from "./pickers";

const TYPES: { value: TransactionType; label: string }[] = [
  { value: "Expense", label: "Expense" },
  { value: "Income", label: "Income" },
  { value: "Transfer", label: "Transfer" },
];

/** New or edit. For an edit, the transaction is loaded first; a fee row opens its transfer instead. */
export function TransactionForm({ id, onClose }: { id: string | null; onClose: () => void }) {
  const existing = useTransaction(id);
  const parentId = existing.data?.feeOfId ?? null;
  const parent = useTransaction(parentId);

  if (id && (existing.isPending || (parentId && parent.isPending))) {
    return (
      <Modal sheet title="Edit transaction" onClose={onClose}>
        <Loading />
      </Modal>
    );
  }

  const error = existing.error ?? parent.error;
  if (error) {
    return (
      <Modal sheet title="Edit transaction" onClose={onClose}>
        <LoadError query={existing.error ? existing : parent} />
      </Modal>
    );
  }

  const transaction = parent.data ?? existing.data ?? null;
  return <Editor transaction={transaction} onClose={onClose} />;
}

function Editor({ transaction, onClose }: { transaction: Transaction | null; onClose: () => void }) {
  const wallets = useWallets();
  const save = useSaveTransaction();
  const remove = useDeleteTransaction();

  const [type, setType] = useState<TransactionType>(transaction?.type ?? "Expense");
  const [amount, setAmount] = useState(toAmountText(transaction?.amount));
  const [fromWalletId, setFrom] = useState(transaction?.fromWalletId ?? "");
  const [toWalletId, setTo] = useState(transaction?.toWalletId ?? "");
  const [categoryId, setCategory] = useState(transaction?.categoryId ?? "");
  const [occurredAt, setOccurredAt] = useState(toLocalInput(transaction?.occurredAt ?? new Date()));
  const [note, setNote] = useState(transaction?.note ?? "");
  const [fee, setFee] = useState(toAmountText(transaction?.fee));
  const [localError, setLocalError] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const amountId = useId();
  const noteId = useId();
  const wide = useWide();

  const kind = type === "Income" ? "Income" : "Expense";
  const categories = useCategories(kind, Boolean(transaction?.categoryId));
  const all = pickableWallets(wallets.data?.wallets ?? [], [transaction?.fromWalletId, transaction?.toWalletId]);

  const apiError = save.error instanceof ApiError ? save.error : null;
  const errorFor = (field: string) => localError[field] ?? apiError?.field(field);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problems: Record<string, string> = {};
    const poisha = parseTaka(amount);
    if (poisha === null || poisha <= 0) problems.amount = "Enter an amount above zero, like 1250 or 1250.50.";
    const feePoisha = type === "Transfer" && fee.trim() !== "" ? parseTaka(fee) : 0;
    if (feePoisha === null) problems.fee = "Enter the fee like 18.50, or leave it empty.";
    if (type !== "Income" && !fromWalletId) problems.fromWalletId = "Choose the wallet the money left.";
    if (type !== "Expense" && !toWalletId) problems.toWalletId = "Choose the wallet the money went to.";
    if (!occurredAt) problems.occurredAt = "Choose when it happened.";
    setLocalError(problems);
    if (Object.keys(problems).length > 0) return;

    const input: TransactionInput = {
      type,
      amount: poisha!,
      fromWalletId: type === "Income" ? null : fromWalletId,
      toWalletId: type === "Expense" ? null : toWalletId,
      categoryId: type === "Transfer" || !categoryId ? null : categoryId,
      occurredAt: fromLocalInput(occurredAt),
      note: note.trim() || null,
      fee: type === "Transfer" ? feePoisha : null,
    };
    await save.mutateAsync({ id: transaction?.id ?? null, input }).then(onClose, () => {});
  }

  async function doDelete() {
    if (!transaction) return;
    await remove.mutateAsync(transaction.id).then(onClose, () => {});
  }

  const title = transaction ? "Edit transaction" : "Add transaction";
  const generalError = apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : null;
  const noWallets = wallets.isSuccess && all.length === 0;

  const tone = type === "Expense" ? "text-expense dark:text-expense-dark" : type === "Income" ? "text-forest dark:text-income-dark" : "";
  const quick = quickCategories(categories.data ?? []);
  const press = (key: string) =>
    setAmount((current) => {
      if (key === "back") return current.slice(0, -1);
      if (key === "." && current.includes(".")) return current;
      const decimals = current.split(".")[1];
      if (decimals !== undefined && decimals.length >= 2) return current;
      return current === "0" && key !== "." ? key : `${current}${key}`;
    });

  return (
    <Modal sheet title={title} onClose={onClose}>
      {noWallets ? (
        <ErrorNote>Add a wallet first, like Cash or bKash, then record transactions in it.</ErrorNote>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <Segmented
            label="Type"
            options={TYPES}
            value={type}
            onChange={(value) => {
              setType(value);
              setCategory("");
            }}
          />

          <div className="flex flex-col items-center py-1">
            <label htmlFor={amountId} className="text-[13px] font-semibold text-[var(--tl-muted)]">
              Amount (৳)
            </label>
            <div
              className={`flex max-w-full items-baseline justify-center gap-1 rounded-[16px] px-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--tl-primary)] ${tone}`}
              // Long amounts step down in size so every digit stays in view on a phone.
              style={{ fontSize: `${Math.max(28, Math.min(48, Math.floor((48 * 10) / Math.max(amount.length, 10))))}px` }}
            >
              <span aria-hidden="true" className="text-[0.67em] font-extrabold">
                ৳
              </span>
              <input
                id={amountId}
                data-autofocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode={wide ? "decimal" : "none"}
                autoComplete="off"
                placeholder="0"
                aria-invalid={Boolean(errorFor("amount"))}
                aria-describedby={errorFor("amount") ? `${amountId}-error` : undefined}
                style={{ width: `${Math.max(amount.length, 1) * 0.62 + 0.4}em` }}
                className="max-w-[80vw] bg-transparent text-center text-[1em] font-extrabold leading-tight tracking-[-1px] outline-none placeholder:text-current placeholder:opacity-40"
              />
            </div>
            {errorFor("amount") ? (
              <p id={`${amountId}-error`} className="m-0 text-center text-[13px] font-semibold text-expense dark:text-expense-dark">
                {errorFor("amount")}
              </p>
            ) : null}
            <label htmlFor={noteId} className="sr-only">
              Note (optional)
            </label>
            <input
              id={noteId}
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note"
              aria-invalid={Boolean(errorFor("note"))}
              aria-describedby={errorFor("note") ? `${noteId}-error` : undefined}
              className={`glass mt-2 h-11 w-full max-w-72 rounded-[12px] px-3 text-center text-sm outline-none placeholder:text-[var(--tl-muted)] ${focusRing}`}
            />
            {errorFor("note") ? (
              <p id={`${noteId}-error`} className="m-0 text-[13px] font-semibold text-expense dark:text-expense-dark">
                {errorFor("note")}
              </p>
            ) : null}
          </div>

          {type !== "Transfer" && quick.length > 0 ? (
            <div role="group" aria-label="Quick categories" className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
              {quick.map((c) => {
                const on = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCategory(on ? "" : c.id)}
                    className={`h-11 shrink-0 cursor-pointer rounded-[14px] border px-3.5 text-sm font-bold ${focusRing} ${
                      on ? "border-forest bg-mint text-forest dark:border-sage dark:bg-sage/15 dark:text-sage" : "glass"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          ) : null}

          {type !== "Income" ? (
            <PickerRow
              icon="wallet"
              label={type === "Transfer" ? "From" : "Paid from"}
              value={fromWalletId}
              onChange={setFrom}
              error={errorFor("fromWalletId")}
            >
              <option value="">Choose a wallet</option>
              <WalletOptions wallets={all} />
            </PickerRow>
          ) : null}
          {type !== "Expense" ? (
            <PickerRow
              icon="wallet"
              label={type === "Transfer" ? "To" : "Received in"}
              value={toWalletId}
              onChange={setTo}
              error={errorFor("toWalletId")}
            >
              <option value="">Choose a wallet</option>
              <WalletOptions wallets={all} />
            </PickerRow>
          ) : null}

          {type === "Transfer" ? (
            <AmountField
              label="Fee (৳, optional)"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              error={errorFor("fee")}
              hint="For example a bKash cash-out charge. It is saved as an expense under Fees and charges."
            />
          ) : (
            <PickerRow icon="tag" label="Category" value={categoryId} onChange={setCategory} error={errorFor("categoryId")}>
              <option value="">No category</option>
              <CategoryOptions categories={categories.data ?? []} keep={transaction?.categoryId} />
            </PickerRow>
          )}

          <TimeRow value={occurredAt} onChange={setOccurredAt} error={errorFor("occurredAt")} />

          <div className="grid grid-cols-3 gap-2 lg:hidden" role="group" aria-label="Number pad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label={key === "back" ? "Delete last digit" : key === "." ? "Decimal point" : undefined}
                className={`glass grid h-12 cursor-pointer place-items-center rounded-[14px] text-xl font-bold ${focusRing}`}
              >
                {key === "back" ? <Icon name="backspace" size={22} /> : key}
              </button>
            ))}
          </div>

          <ErrorNote>{generalError ?? messageOf(remove.error)}</ErrorNote>

          <Button type="submit" disabled={save.isPending} className="h-[52px] w-full rounded-[18px] text-base font-extrabold">
            {save.isPending ? "Saving…" : transaction ? "Save changes" : `Save ${type.toLowerCase()}`}
          </Button>

          {transaction ? (
            confirmDelete ? (
              <span className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="danger" onClick={doDelete} disabled={remove.isPending}>
                  {transaction.type === "Transfer" && transaction.fee ? `Delete with ${formatBdt(transaction.fee)} fee` : "Yes, delete"}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </span>
            ) : (
              <Button variant="ghost" className="self-center text-expense dark:text-expense-dark" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )
          ) : null}
        </form>
      )}
    </Modal>
  );
}

/** Up to eight categories to pick with one tap: the subcategories first, then parents without any. */
function quickCategories(categories: Category[]): { id: string; name: string }[] {
  const leaves = categories.filter((c) => !c.archived).flatMap((p) => (p.children.length > 0 ? p.children.filter((c) => !c.archived) : [p]));
  return leaves.slice(0, 8).map((c) => ({ id: c.id, name: c.name }));
}

/** A 52 px glass row: icon, label on the left, the chosen value on the right (a native select). */
function PickerRow({
  icon,
  label,
  value,
  onChange,
  error,
  children,
}: {
  icon: IconName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="glass relative flex h-[52px] items-center gap-3 rounded-[16px] pl-3.5 pr-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--tl-primary)]">
        <span aria-hidden="true" className="flex text-[var(--tl-primary)]">
          <Icon name={icon} size={19} />
        </span>
        <label htmlFor={id} className="shrink-0 text-sm font-bold">
          {label}
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-full min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent pr-6 text-right text-sm font-semibold text-[var(--tl-muted)] outline-none"
        >
          {children}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-3 flex text-[var(--tl-muted)]">
          <Icon name="right" size={18} />
        </span>
      </div>
      {error ? (
        <p id={`${id}-error`} className="m-0 text-[13px] font-semibold text-expense dark:text-expense-dark">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TimeRow({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="glass flex h-[52px] items-center gap-3 rounded-[16px] px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--tl-primary)]">
        <span aria-hidden="true" className="flex text-[var(--tl-primary)]">
          <Icon name="calendar" size={19} />
        </span>
        <label htmlFor={id} className="shrink-0 text-sm font-bold">
          When
        </label>
        <input
          id={id}
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-right text-sm font-semibold text-[var(--tl-muted)] outline-none"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="m-0 text-[13px] font-semibold text-expense dark:text-expense-dark">
          {error}
        </p>
      ) : null}
    </div>
  );
}
