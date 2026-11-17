import { balanceAfter, emiFor, formatBdt, formatRate, parseRate, parseTaka, schedule } from "@takaleaf/shared";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../../api/client";
import { useAddBankLoan, useCategories, useDeleteBankLoan, useUpdateBankLoan, useWallets } from "../../api/queries";
import type { BankLoan, BankLoanType } from "../../api/types";
import { Button } from "../../ui/Button";
import { ErrorNote, messageOf } from "../../ui/Feedback";
import { AmountField, SelectField, TextField } from "../../ui/Field";
import { localDate, toAmountText } from "../../ui/format";
import { Icon } from "../../ui/Icon";
import { Modal } from "../../ui/Modal";
import { Segmented } from "../../ui/Parts";
import { CategoryOptions, pickableWallets, WalletOptions } from "../transactions/pickers";
import { Chips, monthOfDay, SwitchRow } from "./parts";

const BANKS = ["City Bank", "BRAC Bank", "EBL", "DBBL", "Islami Bank", "Other…"];
const TERMS = ["12", "24", "36", "48", "60", "120"];
const SELLER = "seller";

/** One month after today, as the usual first EMI date. */
function nextMonth(): string {
  const [y, m, d] = localDate().split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m, Math.min(d, 28)));
  return date.toISOString().slice(0, 10);
}

/** EMI n is due n − 1 months after the first. */
function dueOf(first: string, number: number): string {
  const [y, m, d] = first.split("-").map(Number) as [number, number, number];
  const last = new Date(Date.UTC(y, m - 1 + number, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + number - 1, Math.min(d, last))).toISOString().slice(0, 10);
}

/** Add a bank loan or card EMI, or change one (name, bank, paying wallet, rate, EMI, automatic). */
export function LoanForm({ loan, onClose }: { loan: BankLoan | null; onClose: () => void }) {
  return loan ? <EditLoan loan={loan} onClose={onClose} /> : <AddLoan onClose={onClose} />;
}

function AddLoan({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const wallets = useWallets();
  const categories = useCategories("Expense");
  const add = useAddBankLoan();
  const own = pickableWallets(wallets.data?.wallets ?? [], []);
  const cards = own.filter((w) => w.type === "CreditCard");

  const [type, setType] = useState<BankLoanType>("Bank");
  const [bank, setBank] = useState(BANKS[0]!);
  const [otherBank, setOtherBank] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [months, setMonths] = useState("");
  const [firstDue, setFirstDue] = useState(nextMonth());
  const [bankEmi, setBankEmi] = useState<string | null>(null);
  const [payFrom, setPayFrom] = useState("");
  const [receivedIn, setReceivedIn] = useState("");
  const [fee, setFee] = useState("");
  const [running, setRunning] = useState(false);
  const [paidBefore, setPaidBefore] = useState("");
  const [autoRecord, setAutoRecord] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [problems, setProblems] = useState<Record<string, string>>({});

  const card = type === "CardEmi";
  const payWallets = card ? cards : own.filter((w) => w.type !== "CreditCard");
  const chosenPayFrom = payFrom || payWallets[0]?.id || "";
  const chosenReceived = receivedIn || chosenPayFrom;
  const apiError = add.error instanceof ApiError ? add.error : null;
  const errorFor = (field: string) => problems[field] ?? apiError?.field(field);

  const principal = parseTaka(amount) ?? 0;
  const ratePoints = parseRate(rate || (card ? "0" : "")) ?? -1;
  const term = Number(months) || 0;
  const worked = principal > 0 && ratePoints >= 0 && term > 0 ? emiFor(principal, ratePoints, term) : 0;
  const emi = bankEmi !== null ? (parseTaka(bankEmi) ?? 0) : worked;
  const plan = useMemo(() => (principal > 0 && ratePoints >= 0 && emi > 0 ? schedule(principal, ratePoints, emi) : []), [principal, ratePoints, emi]);
  const totalInterest = plan.reduce((s, r) => s + r.interest, 0);
  const already = running ? Number(paidBefore) || 0 : 0;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(firstDue);
  const leftToday = already > 0 && emi > 0 ? balanceAfter(principal, ratePoints, emi, already) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const lender = card ? null : bank === "Other…" ? otherBank.trim() : bank;
    if (!name.trim()) found.name = card ? "Name it, like Laptop EMI." : "Name it, like Home loan.";
    if (principal <= 0) found.principal = card ? "Enter the price, like 119400." : "Enter the loan amount, like 1200000.";
    if (ratePoints < 0) found.ratePoints = "Enter the rate a year, like 9.5.";
    if (term < 1 || term > 600) found.months = "Enter the months, like 60.";
    if (!validDate) found.firstDueDate = card ? "Choose the first statement date." : "Choose the date of the first EMI.";
    if (!chosenPayFrom) found.payFromWalletId = card ? "Add your credit card as a wallet first." : "Choose the wallet the EMIs are paid from.";
    if (bankEmi !== null && !(emi > 0)) found.emi = "Enter the bank's EMI, like 25202.23.";
    if (running && (already < 1 || already >= term)) found.paidBefore = `Enter how many are paid, from 1 to ${Math.max(1, term - 1)}.`;
    const processing = fee ? parseTaka(fee) : 0;
    if (processing === null) found.processingFee = "Enter the fee in taka, like 6000.";
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    const created = await add
      .mutateAsync({
        type,
        name: name.trim(),
        lender: lender || null,
        payFromWalletId: chosenPayFrom,
        principal,
        ratePoints,
        months: term,
        emi: bankEmi !== null ? emi : null,
        firstDueDate: firstDue,
        paidBefore: already,
        autoRecord: card || autoRecord,
        receivedInWalletId: card || running || chosenReceived === SELLER ? null : chosenReceived,
        processingFee: processing || null,
        purchaseCategoryId: card && categoryId ? categoryId : null,
      })
      .catch(() => null);
    if (created) {
      onClose();
      navigate(`/loans/${created.id}`);
    }
  }

  const generalError = apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : null;
  return (
    <Modal title="Add a loan" onClose={onClose} sheet>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Segmented
          label="Kind of loan"
          value={type}
          onChange={(next) => {
            setType(next);
            setPayFrom("");
            setProblems({});
          }}
          options={[
            { value: "Bank", label: "Bank loan" },
            { value: "CardEmi", label: "Credit card EMI" },
          ]}
        />
        <section className="glass flex flex-col gap-4 rounded-[20px] p-4">
          {card ? (
            <SelectField label="Credit card" value={chosenPayFrom} onChange={(e) => setPayFrom(e.target.value)} error={errorFor("payFromWalletId")} hint={cards.length === 0 ? "Add your credit card in Wallets first." : undefined}>
              <WalletOptions wallets={cards} />
            </SelectField>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-small font-bold">Bank</span>
              <Chips label="Bank" options={BANKS} value={bank} onChange={setBank} />
              {bank === "Other…" ? <TextField label="Bank name" value={otherBank} maxLength={80} onChange={(e) => setOtherBank(e.target.value)} error={errorFor("lender")} /> : null}
            </div>
          )}
          <TextField label="Name" placeholder={card ? "Laptop EMI" : "Home loan"} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} error={errorFor("name")} />
          <AmountField label={card ? "Price (৳)" : "Loan amount (৳)"} value={amount} onChange={(e) => setAmount(e.target.value)} error={errorFor("principal")} hint={card ? "The full price put on EMI." : "The principal the bank gave you."} />
          <div className="grid grid-cols-2 gap-2.5">
            <TextField label="Interest rate (% a year)" inputMode="decimal" placeholder={card ? "0" : "9.5"} value={rate} onChange={(e) => setRate(e.target.value)} error={errorFor("ratePoints")} />
            <TextField label="Months" inputMode="numeric" placeholder="60" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ""))} error={errorFor("months")} />
          </div>
          <Chips label="Common terms in months" options={card ? ["3", "6", "12", "18", "24", "36"] : TERMS} value={months} onChange={setMonths} />
          <TextField
            label={card ? "First statement date" : "First EMI date"}
            type="date"
            value={firstDue}
            onChange={(e) => setFirstDue(e.target.value)}
            error={errorFor("firstDueDate")}
            hint={validDate ? (card ? `Each instalment is added to the card on the ${Number(firstDue.slice(8))}th.` : `EMIs repeat on the ${Number(firstDue.slice(8))}th of each month.`) : undefined}
          />
        </section>

        <section className="glass flex flex-col gap-1 rounded-[20px] p-4" aria-live="polite">
          <h2 className="m-0 text-base font-extrabold">{card ? "Each month" : "Your EMI"}</h2>
          <p className="m-0 text-[30px] font-extrabold tracking-[-0.5px] text-[var(--tl-primary)] tabular-nums">
            {emi > 0 ? formatBdt(emi) : "৳—"}
            <span className="text-sm font-semibold text-[var(--tl-muted)]"> a month</span>
          </p>
          <dl className="m-0 mt-2 grid grid-cols-[1fr_auto] gap-y-2 text-body">
            <dt className="text-[var(--tl-muted)]">Total interest</dt>
            <dd className="m-0 text-right font-bold tabular-nums">{plan.length ? formatBdt(totalInterest) : "—"}</dd>
            <dt className="text-[var(--tl-muted)]">Total to pay</dt>
            <dd className="m-0 text-right font-bold tabular-nums">{plan.length ? formatBdt(principal + totalInterest) : "—"}</dd>
            <dt className="text-[var(--tl-muted)]">{card ? "Last bill" : "Last EMI"}</dt>
            <dd className="m-0 text-right font-bold">{plan.length && validDate ? monthOfDay(dueOf(firstDue, plan.length)) : "—"}</dd>
          </dl>
          {bankEmi !== null ? (
            <AmountField label="EMI from your bank (৳)" value={bankEmi} onChange={(e) => setBankEmi(e.target.value)} error={errorFor("emi")} hint={worked ? `Worked out: ${formatBdt(worked)}.` : undefined} />
          ) : null}
          <p className="m-0 mt-2 flex items-start gap-2 text-small text-[var(--tl-muted)]">
            <Icon name="info" size={16} className="mt-0.5 shrink-0" />
            <span>
              Worked out on the reducing balance, as Bangladeshi banks do.{" "}
              {bankEmi === null ? (
                <button type="button" onClick={() => setBankEmi(worked ? toAmountText(worked) : "")} className="cursor-pointer font-bold text-[var(--tl-primary)] underline-offset-2 hover:underline">
                  Use the bank's EMI
                </button>
              ) : (
                <button type="button" onClick={() => setBankEmi(null)} className="cursor-pointer font-bold text-[var(--tl-primary)] underline-offset-2 hover:underline">
                  Use the worked-out EMI
                </button>
              )}
            </span>
          </p>
        </section>

        <section className="glass flex flex-col gap-4 rounded-[20px] p-4">
          {card ? (
            <SelectField label="What it was for (optional)" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} hint="The price is recorded once as an expense in this category.">
              <option value="">No category</option>
              <CategoryOptions categories={categories.data ?? []} />
            </SelectField>
          ) : (
            <>
              <SelectField label="EMIs paid from" value={chosenPayFrom} onChange={(e) => setPayFrom(e.target.value)} error={errorFor("payFromWalletId")}>
                <WalletOptions wallets={payWallets} />
              </SelectField>
              {running ? null : (
                <SelectField
                  label="Money received in"
                  value={chosenReceived}
                  onChange={(e) => setReceivedIn(e.target.value)}
                  error={errorFor("receivedInWalletId")}
                  hint="Adds the loan to this wallet on the day you got it. Choose “Paid to the seller” for a car or flat loan."
                >
                  <WalletOptions wallets={own} />
                  <option value={SELLER}>Paid to the seller</option>
                </SelectField>
              )}
            </>
          )}
          {running ? null : (
            <AmountField label="Processing fee (optional, ৳)" value={fee} onChange={(e) => setFee(e.target.value)} error={errorFor("processingFee")} hint="Recorded once, under Fees and charges." />
          )}
          <SwitchRow label={card ? "Some instalments are already billed" : "I'm already paying this loan"} detail="Start from today: no need to enter old EMIs" checked={running} onChange={setRunning} />
          {running ? (
            <TextField
              label={card ? "Instalments already billed" : "EMIs already paid"}
              inputMode="numeric"
              value={paidBefore}
              onChange={(e) => setPaidBefore(e.target.value.replace(/\D/g, ""))}
              error={errorFor("paidBefore")}
              hint={leftToday !== null ? `Left to pay today: ${formatBdt(leftToday)}. Check it against your bank statement.` : term ? `Of ${term}.` : undefined}
            />
          ) : null}
          {card ? null : <SwitchRow label="The bank takes it automatically" detail="Record each EMI on its date without asking" checked={autoRecord} onChange={setAutoRecord} />}
        </section>

        <ErrorNote>{generalError}</ErrorNote>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? "Saving…" : "Save loan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditLoan({ loan, onClose }: { loan: BankLoan; onClose: () => void }) {
  const navigate = useNavigate();
  const wallets = useWallets();
  const update = useUpdateBankLoan(loan.id);
  const remove = useDeleteBankLoan();
  const card = loan.type === "CardEmi";
  const own = pickableWallets(wallets.data?.wallets ?? [], [loan.payFromWalletId]).filter((w) => (card ? w.type === "CreditCard" : true));
  const [name, setName] = useState(loan.name);
  const [lender, setLender] = useState(loan.lender ?? "");
  const [payFrom, setPayFrom] = useState(loan.payFromWalletId);
  const [rate, setRate] = useState(String(loan.ratePoints / 100));
  const [emi, setEmi] = useState(toAmountText(loan.emi));
  const [autoRecord, setAutoRecord] = useState(loan.autoRecord);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const apiError = update.error instanceof ApiError ? update.error : null;
  const errorFor = (field: string) => problems[field] ?? apiError?.field(field);

  const ratePoints = parseRate(rate);
  // Keeping the end date: the EMI that repays what is left over the EMIs still to go.
  const suggested = ratePoints !== null && loan.left > 0 && ratePoints !== loan.ratePoints ? emiFor(loan.outstanding, ratePoints, loan.left) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const poisha = parseTaka(emi);
    if (!name.trim()) found.name = "Give the loan a name.";
    if (ratePoints === null) found.ratePoints = "Enter the rate a year, like 9.5.";
    if (!poisha) found.emi = "Enter the EMI, like 25202.23.";
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    await update
      .mutateAsync({ name: name.trim(), lender: card ? null : lender.trim() || null, payFromWalletId: payFrom, ratePoints: ratePoints!, emi: poisha!, autoRecord })
      .then(onClose, () => {});
  }

  const generalError = apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : messageOf(remove.error);
  return (
    <Modal title={`Edit ${loan.name}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} error={errorFor("name")} />
        {card ? null : <TextField label="Bank" value={lender} maxLength={80} onChange={(e) => setLender(e.target.value)} error={errorFor("lender")} />}
        <SelectField label={card ? "Credit card" : "EMIs paid from"} value={payFrom} onChange={(e) => setPayFrom(e.target.value)} error={errorFor("payFromWalletId")}>
          <WalletOptions wallets={own} />
        </SelectField>
        <TextField
          label="Interest rate (% a year)"
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          error={errorFor("ratePoints")}
          hint={`Now ${formatRate(loan.ratePoints)}. A new rate applies from the next EMI.`}
        />
        <AmountField label="EMI (৳)" value={emi} onChange={(e) => setEmi(e.target.value)} error={errorFor("emi")} />
        {suggested ? (
          <button type="button" onClick={() => setEmi(toAmountText(suggested))} className="-mt-2 h-11 cursor-pointer self-start rounded-full bg-[var(--tl-chip)] px-3 text-small font-bold text-[var(--tl-primary)]">
            Keep the end date: EMI {formatBdt(suggested)}
          </button>
        ) : null}
        {card ? null : <SwitchRow label="The bank takes it automatically" detail="Record each EMI on its date without asking" checked={autoRecord} onChange={setAutoRecord} />}
        <ErrorNote>{generalError}</ErrorNote>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {confirmDelete ? (
            <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutateAsync(loan.id).then(() => (onClose(), navigate("/loans")), () => {})}>
              Yes, delete it and its payments
            </Button>
          ) : (
            <Button variant="ghost" className="text-expense dark:text-expense-dark" onClick={() => setConfirmDelete(true)}>
              Delete loan
            </Button>
          )}
          <span className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </span>
        </div>
      </form>
    </Modal>
  );
}
