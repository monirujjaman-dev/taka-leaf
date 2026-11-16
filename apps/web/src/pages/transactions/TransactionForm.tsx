import { formatBdt, parseTaka } from "@takaleaf/shared";
import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { useCategories, useDeleteTransaction, useSaveTransaction, useTransaction, useWallets } from "../../api/queries";
import type { Transaction, TransactionInput, TransactionType } from "../../api/types";
import { Button, focusRing } from "../../ui/Button";
import { ErrorNote, Loading, messageOf } from "../../ui/Feedback";
import { AmountField, SelectField, TextField } from "../../ui/Field";
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
      <Modal title="Edit transaction" onClose={onClose}>
        <Loading />
      </Modal>
    );
  }

  const error = existing.error ?? parent.error;
  if (error) {
    return (
      <Modal title="Edit transaction" onClose={onClose}>
        <ErrorNote>{messageOf(error)}</ErrorNote>
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

  return (
    <Modal title={title} onClose={onClose}>
      {noWallets ? (
        <ErrorNote>Add a wallet first, like Cash or bKash, then record transactions in it.</ErrorNote>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-1 rounded-[16px] bg-[var(--tl-chip)] p-1">
            {TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={type === option.value}
                onClick={() => {
                  setType(option.value);
                  setCategory("");
                }}
                className={`h-10 cursor-pointer rounded-[12px] text-sm font-bold ${focusRing} ${
                  type === option.value ? "bg-[var(--tl-surface)] text-[var(--tl-primary)] shadow-sm" : "text-[var(--tl-muted)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <AmountField
            label="Amount (৳)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={errorFor("amount")}
            className="text-lg font-bold"
          />

          <div className={`grid gap-4 ${type === "Transfer" ? "sm:grid-cols-2" : ""}`}>
            {type !== "Income" ? (
              <SelectField
                label={type === "Transfer" ? "From" : "Paid from"}
                value={fromWalletId}
                onChange={(e) => setFrom(e.target.value)}
                error={errorFor("fromWalletId")}
              >
                <option value="">Choose a wallet</option>
                <WalletOptions wallets={all} />
              </SelectField>
            ) : null}
            {type !== "Expense" ? (
              <SelectField
                label={type === "Transfer" ? "To" : "Received in"}
                value={toWalletId}
                onChange={(e) => setTo(e.target.value)}
                error={errorFor("toWalletId")}
              >
                <option value="">Choose a wallet</option>
                <WalletOptions wallets={all} />
              </SelectField>
            ) : null}
          </div>

          {type === "Transfer" ? (
            <AmountField
              label="Fee (৳, optional)"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              error={errorFor("fee")}
              hint="For example a bKash cash-out charge. It is saved as an expense under Fees and charges."
            />
          ) : (
            <SelectField label="Category" value={categoryId} onChange={(e) => setCategory(e.target.value)} error={errorFor("categoryId")}>
              <option value="">No category</option>
              <CategoryOptions categories={categories.data ?? []} keep={transaction?.categoryId} />
            </SelectField>
          )}

          <TextField
            label="When"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            error={errorFor("occurredAt")}
          />
          <TextField label="Note (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} error={errorFor("note")} />

          <ErrorNote>{generalError ?? messageOf(remove.error)}</ErrorNote>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {transaction ? (
              confirmDelete ? (
                <span className="flex items-center gap-2">
                  <Button variant="danger" onClick={doDelete} disabled={remove.isPending}>
                    {transaction.type === "Transfer" && transaction.fee ? `Delete with ${formatBdt(transaction.fee)} fee` : "Yes, delete"}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </Button>
                </span>
              ) : (
                <Button variant="ghost" className="text-expense dark:text-expense-dark" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )
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
        </form>
      )}
    </Modal>
  );
}
