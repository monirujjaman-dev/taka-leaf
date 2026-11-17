import { formatBdt, parseRate, parseTaka } from "@takaleaf/shared";
import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { usePayEmi, usePayExtra, useSettleLoan, useUpdateBankLoan, useWallets } from "../../api/queries";
import type { BankLoan } from "../../api/types";
import { Button } from "../../ui/Button";
import { ErrorNote } from "../../ui/Feedback";
import { AmountField, SelectField, TextField } from "../../ui/Field";
import { fromLocalInput, toAmountText, toLocalInput } from "../../ui/format";
import { Modal } from "../../ui/Modal";
import { pickableWallets, WalletOptions } from "../transactions/pickers";
import { monthOfDay, SwitchRow } from "./parts";

function useOwnWallets(keep: string) {
  const wallets = useWallets();
  return pickableWallets(wallets.data?.wallets ?? [], [keep]);
}

/** The next EMI: principal lowers the loan, interest is an expense; a different amount changes only the principal. */
export function PayEmiForm({ loan, onClose }: { loan: BankLoan; onClose: () => void }) {
  const next = loan.next!;
  const wallets = useOwnWallets(loan.payFromWalletId);
  const pay = usePayEmi(loan.id);
  const update = useUpdateBankLoan(loan.id);
  const [amount, setAmount] = useState(toAmountText(next.total));
  const [lateFee, setLateFee] = useState("");
  const [walletId, setWalletId] = useState(loan.payFromWalletId);
  const [when, setWhen] = useState(toLocalInput(new Date()));
  const [autoRecord, setAutoRecord] = useState(loan.autoRecord);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const apiError = pay.error instanceof ApiError ? pay.error : null;
  const errorFor = (field: string) => problems[field] ?? apiError?.field(field);

  const paid = parseTaka(amount);
  const principal = paid === null ? null : paid - next.interest;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (paid === null || principal === null || principal <= 0) found.amount = `Pay more than this month's interest, ${formatBdt(next.interest)}.`;
    const fee = lateFee ? parseTaka(lateFee) : 0;
    if (fee === null) found.lateFee = "Enter the fee in taka, like 500.";
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    const ok = await pay
      .mutateAsync({ walletId, amount: paid === next.total ? null : paid, lateFee: fee || null, occurredAt: fromLocalInput(when) })
      .then(() => true, () => false);
    if (!ok) return;
    if (autoRecord !== loan.autoRecord) {
      await update.mutateAsync({ name: loan.name, lender: loan.lender, payFromWalletId: loan.payFromWalletId, ratePoints: loan.ratePoints, emi: loan.emi, autoRecord }).catch(() => {});
    }
    onClose();
  }

  return (
    <Modal title={`Pay EMI ${next.number} · ${monthOfDay(next.dueDate)}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <AmountField label="Amount paid (৳)" value={amount} onChange={(e) => setAmount(e.target.value)} error={errorFor("amount")} className="text-center text-[30px] font-extrabold" />
        <dl className="glass m-0 grid grid-cols-[1fr_auto] items-center gap-y-2.5 rounded-[18px] px-4 py-3.5 text-body" aria-live="polite">
          <dt>
            <span className="block font-bold">Principal</span>
            <span className="block text-small text-[var(--tl-muted)]">Lowers what you owe</span>
          </dt>
          <dd className="m-0 font-extrabold tabular-nums">{principal !== null && principal > 0 ? formatBdt(principal) : "—"}</dd>
          <dt>
            <span className="block font-bold">Interest</span>
            <span className="block text-small text-[var(--tl-muted)]">An expense, under Loan interest</span>
          </dt>
          <dd className="m-0 font-extrabold tabular-nums">{formatBdt(next.interest)}</dd>
        </dl>
        <AmountField label="Late fee or charges (optional, ৳)" value={lateFee} onChange={(e) => setLateFee(e.target.value)} error={errorFor("lateFee")} hint="Counted under Fees and charges." />
        <SelectField label="Paid from" value={walletId} onChange={(e) => setWalletId(e.target.value)} error={errorFor("walletId")}>
          <WalletOptions wallets={wallets} />
        </SelectField>
        <TextField label="Date" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        {loan.type === "Bank" ? <SwitchRow label="The bank takes it automatically" detail="Record each EMI on its date without asking" checked={autoRecord} onChange={setAutoRecord} /> : null}
        <ErrorNote>{apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : null}</ErrorNote>
        <Button type="submit" disabled={pay.isPending}>
          {pay.isPending ? "Recording…" : "Record payment"}
        </Button>
        <p className="m-0 text-center text-small text-[var(--tl-muted)]">Paid a different amount? Change it: interest stays the same, the rest goes to principal.</p>
      </form>
    </Modal>
  );
}

/** A part payment: all of it lowers the principal, so later EMIs carry less interest. */
export function PayExtraForm({ loan, onClose }: { loan: BankLoan; onClose: () => void }) {
  const wallets = useOwnWallets(loan.payFromWalletId);
  const pay = usePayExtra(loan.id);
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState(loan.payFromWalletId);
  const [when, setWhen] = useState(toLocalInput(new Date()));
  const [problem, setProblem] = useState<string | null>(null);
  const apiError = pay.error instanceof ApiError ? pay.error : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const poisha = parseTaka(amount);
    if (!poisha) return setProblem("Enter the amount paid, like 50000.");
    setProblem(null);
    await pay.mutateAsync({ walletId, amount: poisha, occurredAt: fromLocalInput(when) }).then(onClose, () => {});
  }

  return (
    <Modal title={`Pay extra · ${loan.name}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <AmountField label="Amount (৳)" value={amount} onChange={(e) => setAmount(e.target.value)} error={problem ?? apiError?.field("amount")} hint={`All of it lowers the principal. ${formatBdt(loan.outstanding)} is left.`} />
        <SelectField label="Paid from" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
          <WalletOptions wallets={wallets} />
        </SelectField>
        <TextField label="Date" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <ErrorNote>{apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : null}</ErrorNote>
        <Button type="submit" disabled={pay.isPending}>
          {pay.isPending ? "Recording…" : "Record extra payment"}
        </Button>
      </form>
    </Modal>
  );
}

/** Closing early: everything left plus the bank's settlement charge, as a % of what is left or an amount. */
export function SettleForm({ loan, onClose }: { loan: BankLoan; onClose: () => void }) {
  const wallets = useOwnWallets(loan.payFromWalletId);
  const settle = useSettleLoan(loan.id);
  const card = loan.type === "CardEmi";
  const [by, setBy] = useState<"percent" | "amount">("percent");
  const [percent, setPercent] = useState(card ? "0" : "");
  const [charge, setCharge] = useState("");
  const [walletId, setWalletId] = useState(loan.payFromWalletId);
  const [when, setWhen] = useState(toLocalInput(new Date()));
  const [problem, setProblem] = useState<string | null>(null);
  const apiError = settle.error instanceof ApiError ? settle.error : null;

  const points = parseRate(percent || "0");
  // The same rounding as the server: half up to the poisha.
  const fromPercent = points !== null ? Math.round((loan.outstanding * points) / 10_000) : null;
  const chargeAmount = by === "percent" ? fromPercent : charge ? parseTaka(charge) : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (by === "percent" && points === null) return setProblem("Enter the charge as a % of what is left, like 2.");
    if (by === "amount" && chargeAmount === null) return setProblem("Enter the charge in taka, like 18000.");
    setProblem(null);
    await settle
      .mutateAsync({ walletId, chargePoints: by === "percent" ? points : null, charge: by === "amount" ? chargeAmount : null, occurredAt: fromLocalInput(when) })
      .then(onClose, () => {});
  }

  return (
    <Modal title={card ? `Pay off ${loan.name}` : `Settle ${loan.name} early`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="m-0 text-body text-[var(--tl-muted)]">
          {card
            ? "Moves everything still to be billed onto the card now, and closes the EMI."
            : "Pays everything left in one go and closes the loan. Banks usually charge a fee for settling early: a share of what is left."}
        </p>
        <div role="radiogroup" aria-label="Settlement charge as" className="flex gap-2">
          {(["percent", "amount"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={by === option}
              onClick={() => setBy(option)}
              className={`h-10 flex-1 cursor-pointer rounded-full border text-sm font-bold ${by === option ? "border-forest bg-forest text-white dark:border-sage dark:bg-sage dark:text-ink" : "border-[var(--tl-border)] bg-[var(--tl-surface)]"}`}
            >
              {option === "percent" ? "% of what is left" : "An amount"}
            </button>
          ))}
        </div>
        {by === "percent" ? (
          <TextField label="Settlement charge (%)" inputMode="decimal" placeholder="2" value={percent} onChange={(e) => setPercent(e.target.value)} error={problem ?? apiError?.field("chargePoints")} />
        ) : (
          <AmountField label="Settlement charge (৳)" value={charge} onChange={(e) => setCharge(e.target.value)} error={problem ?? apiError?.field("charge")} />
        )}
        <dl className="glass m-0 grid grid-cols-[1fr_auto] gap-y-2 rounded-[18px] px-4 py-3.5 text-body" aria-live="polite">
          <dt className="text-[var(--tl-muted)]">Left to pay</dt>
          <dd className="m-0 text-right font-bold tabular-nums">{formatBdt(loan.outstanding)}</dd>
          <dt className="text-[var(--tl-muted)]">Settlement charge</dt>
          <dd className="m-0 text-right font-bold tabular-nums">{chargeAmount !== null ? formatBdt(chargeAmount) : "—"}</dd>
          <dt className="font-extrabold">You pay</dt>
          <dd className="m-0 text-right text-lg font-extrabold tabular-nums">{chargeAmount !== null ? formatBdt(loan.outstanding + chargeAmount) : "—"}</dd>
        </dl>
        <SelectField label="Paid from" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
          <WalletOptions wallets={wallets} />
        </SelectField>
        <TextField label="Date" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <ErrorNote>{apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : null}</ErrorNote>
        <Button type="submit" disabled={settle.isPending}>
          {settle.isPending ? "Settling…" : card ? "Pay off the rest" : "Settle the loan"}
        </Button>
        <p className="m-0 text-center text-small text-[var(--tl-muted)]">The charge is recorded as an expense under Fees and charges.</p>
      </form>
    </Modal>
  );
}
