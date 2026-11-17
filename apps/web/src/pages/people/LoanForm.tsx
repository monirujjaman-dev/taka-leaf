import { formatBdt, parseTaka } from "@takaleaf/shared";
import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { useDeleteLoan, useSaveLoan, useWallets } from "../../api/queries";
import type { Loan, LoanKind, Person } from "../../api/types";
import { Button } from "../../ui/Button";
import { ErrorNote, messageOf } from "../../ui/Feedback";
import { AmountField, SelectField, TextField } from "../../ui/Field";
import { fromLocalInput, toAmountText, toLocalInput } from "../../ui/format";
import { Modal } from "../../ui/Modal";
import { pickableWallets, WalletOptions } from "../transactions/pickers";

export const LOAN_LABEL: Record<LoanKind, (name: string) => string> = {
  Lend: (name) => `Lent to ${name}`,
  GotBack: (name) => `${name} paid back`,
  Borrow: (name) => `Borrowed from ${name}`,
  PaidBack: (name) => `Paid back ${name}`,
};

const WALLET_LABEL: Record<LoanKind, string> = {
  Lend: "Paid from",
  GotBack: "Received in",
  Borrow: "Received in",
  PaidBack: "Paid from",
};

export function LoanForm({ person, kind: startKind, loan, onClose }: { person: Person; kind: LoanKind; loan: Loan | null; onClose: () => void }) {
  const wallets = useWallets();
  const save = useSaveLoan(person.id);
  const remove = useDeleteLoan(person.id);
  const [kind] = useState<LoanKind>(loan?.kind ?? startKind);
  const [amount, setAmount] = useState(toAmountText(loan?.amount));
  const [walletId, setWalletId] = useState(loan?.walletId ?? "");
  const [occurredAt, setOccurredAt] = useState(toLocalInput(loan?.occurredAt ?? new Date()));
  const [note, setNote] = useState(loan?.note ?? "");
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const all = pickableWallets(wallets.data?.wallets ?? [], [loan?.walletId]);
  const apiError = save.error instanceof ApiError ? save.error : null;
  const errorFor = (field: string) => problems[field] ?? apiError?.field(field);

  // What is still owed, counting this repayment (when editing) as not there yet.
  const outstanding =
    kind === "GotBack" ? person.owesMe + (loan?.kind === "GotBack" ? loan.amount : 0)
    : kind === "PaidBack" ? person.iOwe + (loan?.kind === "PaidBack" ? loan.amount : 0)
    : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const poisha = parseTaka(amount);
    if (poisha === null || poisha <= 0) found.amount = "Enter an amount above zero, like 5000.";
    if (!walletId) found.walletId = "Choose a wallet.";
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    await save
      .mutateAsync({ id: loan?.id ?? null, input: { kind, amount: poisha!, walletId, occurredAt: fromLocalInput(occurredAt), note: note.trim() || null } })
      .then(onClose, () => {});
  }

  const generalError = apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : messageOf(remove.error);

  return (
    <Modal title={LOAN_LABEL[kind](person.name)} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <AmountField
          label="Amount (৳)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errorFor("amount")}
          className="text-lg font-bold"
          hint={outstanding !== null ? `${person.name} ${kind === "GotBack" ? "owes you" : "is owed"} ${formatBdt(outstanding)}.` : undefined}
        />
        {outstanding !== null && outstanding > 0 && !loan ? (
          <button
            type="button"
            onClick={() => setAmount(toAmountText(outstanding))}
            className="-mt-2 h-11 cursor-pointer self-start rounded-full bg-[var(--tl-chip)] px-3 text-small font-bold text-[var(--tl-primary)]"
          >
            All of it: {formatBdt(outstanding)}
          </button>
        ) : null}
        <SelectField label={WALLET_LABEL[kind]} value={walletId} onChange={(e) => setWalletId(e.target.value)} error={errorFor("walletId")}>
          <option value="">Choose a wallet</option>
          <WalletOptions wallets={all} />
        </SelectField>
        <TextField label="When" type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        <TextField label="Note (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} error={errorFor("note")} />
        <ErrorNote>{generalError}</ErrorNote>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {loan ? (
            confirmDelete ? (
              <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutateAsync(loan.id).then(onClose, () => {})}>
                Yes, delete
              </Button>
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
    </Modal>
  );
}
