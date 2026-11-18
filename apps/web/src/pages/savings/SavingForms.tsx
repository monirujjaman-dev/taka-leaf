import { formatBdt, parseRate, parseTaka, PRIZES, profit, taxOf } from "@takaleaf/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../../api/client";
import { useDeleteSaving, useSavingAction, useUpdateSaving, useWallets, type SavingActionName } from "../../api/queries";
import type { PolicyType, Saving } from "../../api/types";
import { Button } from "../../ui/Button";
import { ErrorNote, messageOf } from "../../ui/Feedback";
import { AmountField, SelectField, TextField } from "../../ui/Field";
import { fromLocalInput, toAmountText, toLocalInput } from "../../ui/format";
import { Modal } from "../../ui/Modal";
import { pickableWallets, WalletOptions } from "../transactions/pickers";
import { Chips, Line, minus } from "./parts";

function useAccounts(keep: string) {
  const wallets = useWallets();
  return pickableWallets(wallets.data?.wallets ?? [], [keep]);
}

interface ActionProps {
  saving: Saving;
  action: SavingActionName;
  title: string;
  submit: string;
  onClose: () => void;
  children: (errorFor: (field: string) => string | undefined) => ReactNode;
  /** The request body, or the field problems found before sending. */
  build: () => Record<string, unknown>;
}

/** The shared shell: the fields, an account, a date, the API's own message, and a submit button. Closes after a save. */
function ActionForm({ onClose, saving, action, title, submit, children, build }: ActionProps) {
  const run = useSavingAction(saving.id, action);
  const accounts = useAccounts(saving.payFromWalletId);
  const [walletId, setWalletId] = useState(saving.payFromWalletId);
  const [when, setWhen] = useState(toLocalInput(new Date()));
  const [problems, setProblems] = useState<Record<string, string>>({});
  const apiError = run.error instanceof ApiError ? run.error : null;
  const errorFor = (field: string) => problems[field] ?? apiError?.field(field);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const body = build();
    if ("problems" in body) {
      const found = body.problems as Record<string, string>;
      if (Object.keys(found).length > 0) {
        setProblems(found);
        return;
      }
    }
    setProblems({});
    const ok = await run.mutateAsync({ ...body, walletId, occurredAt: fromLocalInput(when) }).then(() => true, () => false);
    if (ok) onClose();
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {children(errorFor)}
        <SelectField label={action === "premium" || action === "deposit" ? "Paid from" : "Into"} value={walletId} onChange={(e) => setWalletId(e.target.value)} error={errorFor("walletId")}>
          <WalletOptions wallets={accounts} />
        </SelectField>
        <TextField label="Date" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <ErrorNote>{apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : null}</ErrorNote>
        <Button type="submit" disabled={run.isPending}>
          {run.isPending ? "Recording…" : submit}
        </Button>
      </form>
    </Modal>
  );
}


/** A profit payment before maturity: the expected profit and tax, which the person can correct. */
export function ProfitForm({ saving, onClose }: { saving: Saving; onClose: () => void }) {
  const expected = profit(saving.amount, saving.ratePoints, saving.everyMonths);
  const [gross, setGross] = useState(toAmountText(expected));
  const [tax, setTax] = useState(toAmountText(taxOf(expected, saving.taxPoints)));
  const g = parseTaka(gross);
  const t = tax ? parseTaka(tax) : 0;
  return (
    <ActionForm
      saving={saving}
      action="profit"
      title={`Record ${saving.next?.label.toLowerCase() ?? "profit"}`}
      submit="Record profit"
      onClose={onClose}
      build={() => (g === null || g <= 0 ? { problems: { profit: "Enter the profit before tax, like 13800." } } : t === null ? { problems: { tax: "Enter the tax in taka, like 690." } } : { profit: g, tax: t })}
    >
      {(errorFor) => (
        <>
          <AmountField label="Profit before tax (৳)" value={gross} onChange={(e) => setGross(e.target.value)} error={errorFor("profit")} />
          <AmountField label="Tax at source (৳)" value={tax} onChange={(e) => setTax(e.target.value)} error={errorFor("tax")} />
          <dl className="glass m-0 rounded-[18px] px-4 py-1.5">
            <Line label="Into your account" value={g !== null && t !== null ? formatBdt(g - t) : "—"} strong />
          </dl>
        </>
      )}
    </ActionForm>
  );
}

/** Closing at maturity (the expected amounts filled in) or early (what the bank paid). */
export function CloseForm({ saving, early, onClose }: { saving: Saving; early: boolean; onClose: () => void }) {
  const [received, setReceived] = useState(early ? "" : toAmountText(saving.estimate !== null && saving.kind === "Dps" ? saving.estimate - taxOf(Math.max(saving.estimate - saving.balance, 0), saving.taxPoints) : saving.estimate));
  const [tax, setTax] = useState(early || saving.kind !== "Dps" ? "" : toAmountText(taxOf(Math.max((saving.estimate ?? 0) - saving.balance, 0), saving.taxPoints)));
  const r = parseTaka(received);
  const t = tax ? parseTaka(tax) : 0;
  const difference = r !== null && t !== null ? r + t - saving.balance : null;
  const what = saving.kind === "Certificate" ? "the bank or post office" : "the bank";
  return (
    <ActionForm
      saving={saving}
      action="close"
      title={early ? `Close ${saving.name} early` : `${saving.name} matured`}
      submit={early ? "Encash early" : "Record maturity"}
      onClose={onClose}
      build={() => (r === null ? { problems: { received: "Enter what reached your account, like 500000." } } : t === null ? { problems: { tax: "Enter the tax in taka, or leave it empty." } } : early || received !== "" ? { received: r, tax: t } : {})}
    >
      {(errorFor) => (
        <>
          <p className="m-0 text-body text-[var(--tl-muted)]">
            {early ? `Enter what ${what} paid you. Breaking it early usually pays a lower rate, or none.` : "These are the expected amounts. Change them to what reached your account."}
          </p>
          <AmountField label="Amount that reached your account (৳)" value={received} onChange={(e) => setReceived(e.target.value)} error={errorFor("received")} />
          <AmountField label="Tax taken at source (optional, ৳)" value={tax} onChange={(e) => setTax(e.target.value)} error={errorFor("tax")} />
          <dl className="glass m-0 rounded-[18px] px-4 py-1.5" aria-live="polite">
            <Line label="Money in it" value={formatBdt(saving.balance)} />
            {difference !== null ? (
              difference >= 0 ? <Line label="Profit, before tax" value={formatBdt(difference)} tone="income" /> : <Line label="Early encashment charge" value={minus(-difference)} tone="expense" />
            ) : null}
          </dl>
        </>
      )}
    </ActionForm>
  );
}

/** A prize bond win: the prize (1st to 5th, or typed), the tax, and which bond won. */
export function PrizeForm({ saving, onClose }: { saving: Saving; onClose: () => void }) {
  const names = ["1st", "2nd", "3rd", "4th", "5th"];
  const [which, setWhich] = useState("5th");
  const [prize, setPrize] = useState(toAmountText(PRIZES[4]));
  const [taxText, setTaxText] = useState(String(saving.taxPoints / 100));
  const [bond, setBond] = useState(saving.bondNumbers[0] ?? "");
  const p = parseTaka(prize);
  const points = parseRate(taxText);
  const tax = p !== null && points !== null ? taxOf(p, points) : null;
  return (
    <ActionForm
      saving={saving}
      action="prize"
      title="I won a prize"
      submit="Record prize"
      onClose={onClose}
      build={() => (p === null || p <= 0 ? { problems: { prize: "Enter the prize, like 10000." } } : points === null ? { problems: { taxPoints: "Enter the tax as a %, like 20." } } : { prize: p, taxPoints: points, bond: bond.trim() || null })}
    >
      {(errorFor) => (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-small font-bold">Prize</span>
            <Chips
              label="Prize"
              options={names}
              value={which}
              onChange={(v) => {
                setWhich(v);
                setPrize(toAmountText(PRIZES[names.indexOf(v)]!));
              }}
            />
          </div>
          <AmountField label="Prize (৳)" value={prize} onChange={(e) => setPrize(e.target.value)} error={errorFor("prize")} />
          {saving.bondNumbers.length > 0 ? (
            <SelectField label="Winning bond" value={bond} onChange={(e) => setBond(e.target.value)}>
              {saving.bondNumbers.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </SelectField>
          ) : (
            <TextField label="Winning bond (optional)" value={bond} onChange={(e) => setBond(e.target.value)} error={errorFor("bond")} placeholder="কখ 0412303" />
          )}
          <TextField label="Tax at source (%)" inputMode="decimal" value={taxText} onChange={(e) => setTaxText(e.target.value)} error={errorFor("taxPoints")} hint="Taken before the prize is paid." />
          <dl className="glass m-0 rounded-[18px] px-4 py-1.5" aria-live="polite">
            <Line label="Tax at source" value={tax !== null ? minus(tax) : "—"} tone="expense" />
            <Line label="Into your account" value={p !== null && tax !== null ? formatBdt(p - tax) : "—"} strong />
          </dl>
        </>
      )}
    </ActionForm>
  );
}

/** More bonds bought, with their numbers. */
export function AddBondsForm({ saving, onClose }: { saving: Saving; onClose: () => void }) {
  const [count, setCount] = useState("");
  const [numbers, setNumbers] = useState("");
  const n = Number.parseInt(count, 10);
  return (
    <ActionForm
      saving={saving}
      action="deposit"
      title="Add bonds"
      submit="Add bonds"
      onClose={onClose}
      build={() => (!(n > 0) ? { problems: { bondCount: "Enter how many ৳100 bonds, like 10." } } : { bondCount: n, bondNumbers: numbers.split("\n").map((x) => x.trim()).filter(Boolean) })}
    >
      {(errorFor) => (
        <>
          <TextField label="How many ৳100 bonds" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} error={errorFor("bondCount")} hint={n > 0 ? `${formatBdt(n * 10_000)} from your account.` : undefined} />
          <label className="flex flex-col gap-1.5">
            <span className="text-small font-bold">Bond numbers (optional, one a line)</span>
            <textarea value={numbers} onChange={(e) => setNumbers(e.target.value)} rows={4} className="rounded-[16px] border border-[var(--tl-glass-border)] bg-[var(--tl-glass)] p-3.5 text-body outline-none focus:border-[var(--tl-primary)]" />
          </label>
        </>
      )}
    </ActionForm>
  );
}

/** Bonds sold back at ৳100 each. */
export function SellForm({ saving, onClose }: { saving: Saving; onClose: () => void }) {
  const [count, setCount] = useState(String(saving.bondCount));
  const n = Number.parseInt(count, 10);
  return (
    <ActionForm
      saving={saving}
      action="sell"
      title="Sell bonds back"
      submit="Sell back"
      onClose={onClose}
      build={() => (!(n > 0 && n <= saving.bondCount) ? { problems: { bondCount: `Enter 1 to ${saving.bondCount}.` } } : { bondCount: n })}
    >
      {(errorFor) => <TextField label="How many" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} error={errorFor("bondCount")} hint={n > 0 ? `${formatBdt(n * 10_000)} back to your account.` : undefined} />}
    </ActionForm>
  );
}

/** A claim, survival benefit or the maturity amount of a policy. */
export function PayoutForm({ saving, kind, onClose }: { saving: Saving; kind: "Claim" | "Maturity"; onClose: () => void }) {
  const [amount, setAmount] = useState(kind === "Maturity" && saving.cover ? toAmountText(saving.cover) : "");
  const a = parseTaka(amount);
  return (
    <ActionForm
      saving={saving}
      action="payout"
      title={kind === "Claim" ? "Got a claim" : "Policy matured"}
      submit={kind === "Claim" ? "Record claim" : "Record maturity"}
      onClose={onClose}
      build={() => (a === null || a <= 0 ? { problems: { amount: "Enter the amount paid to you, like 100000." } } : { amount: a, kind })}
    >
      {(errorFor) => (
        <>
          <AmountField label="Amount paid to you (৳)" value={amount} onChange={(e) => setAmount(e.target.value)} error={errorFor("amount")} hint="Income under Insurance payouts." />
          {kind === "Maturity" ? <p className="m-0 text-small text-[var(--tl-muted)]">This closes the policy.</p> : null}
        </>
      )}
    </ActionForm>
  );
}

/** Changing what the bank or insurer changed: names, the account, the rate or tax, the instalment, policy details. Delete lives here too. */
export function EditSavingForm({ saving, onClose }: { saving: Saving; onClose: () => void }) {
  const navigate = useNavigate();
  const update = useUpdateSaving(saving.id);
  const remove = useDeleteSaving();
  const accounts = useAccounts(saving.payFromWalletId);
  const [name, setName] = useState(saving.name);
  const [provider, setProvider] = useState(saving.provider ?? "");
  const [payFrom, setPayFrom] = useState(saving.payFromWalletId);
  const [rate, setRate] = useState(String(saving.ratePoints / 100));
  const [tax, setTax] = useState(String(saving.taxPoints / 100));
  const [amount, setAmount] = useState(toAmountText(saving.amount));
  const [excise, setExcise] = useState(toAmountText(saving.chargesPerYear || null));
  const [maturity, setMaturity] = useState(toAmountText(saving.maturityAmount));
  const [cover, setCover] = useState(toAmountText(saving.cover));
  const [policy, setPolicy] = useState<PolicyType>(saving.policy ?? "Other");
  const [policyNumber, setPolicyNumber] = useState(saving.policyNumber ?? "");
  const [insured, setInsured] = useState(saving.insured ?? "");
  const [nominee, setNominee] = useState(saving.nominee ?? "");
  const [bonds, setBonds] = useState(saving.bondNumbers.join("\n"));
  const [confirm, setConfirm] = useState(false);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const apiError = update.error instanceof ApiError ? update.error : null;
  const errorFor = (field: string) => problems[field] ?? apiError?.field(field);
  const k = saving.kind;
  const hasRate = k === "Fdr" || k === "Dps" || k === "Certificate";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const ratePoints = parseRate(rate);
    const taxPoints = parseRate(tax);
    if (hasRate && ratePoints === null) found.ratePoints = "Enter the rate a year, like 9.75.";
    if (k !== "Insurance" && taxPoints === null) found.taxPoints = "Enter the tax as a %, like 10.";
    if ((k === "Dps" || k === "Insurance") && parseTaka(amount) === null) found.amount = "Enter the amount, like 5000.";
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    const ok = await update
      .mutateAsync({
        name: name.trim(),
        provider: provider.trim() || null,
        payFromWalletId: payFrom,
        amount: k === "Dps" || k === "Insurance" ? parseTaka(amount) : null,
        ratePoints: hasRate ? ratePoints : null,
        taxPoints: k !== "Insurance" ? taxPoints : null,
        chargesPerYear: k === "Fdr" ? (excise ? parseTaka(excise) : 0) : null,
        maturityAmount: k === "Dps" && maturity ? parseTaka(maturity) : null,
        cover: k === "Insurance" && cover ? parseTaka(cover) : null,
        policy: k === "Insurance" ? policy : null,
        policyNumber: policyNumber.trim() || null,
        insured: insured.trim() || null,
        nominee: nominee.trim() || null,
        bondNumbers: k === "PrizeBond" ? bonds.split("\n").map((x) => x.trim()).filter(Boolean) : null,
        autoRecord: null,
        remind: null,
        renew: null,
      })
      .then(() => true, () => false);
    if (ok) onClose();
  }

  return (
    <Modal title={`Edit ${saving.name}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errorFor("name")} />
        {k !== "PrizeBond" ? <TextField label={k === "Insurance" ? "Insurer" : "Bank"} value={provider} onChange={(e) => setProvider(e.target.value)} error={errorFor("provider")} /> : null}
        <SelectField label={k === "Insurance" || k === "Dps" ? "Pay from" : "Profit and money paid into"} value={payFrom} onChange={(e) => setPayFrom(e.target.value)} error={errorFor("payFromWalletId")}>
          <WalletOptions wallets={accounts} />
        </SelectField>
        {hasRate ? <TextField label="Profit rate (% a year)" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} error={errorFor("ratePoints")} hint="A new rate applies from the next payment." /> : null}
        {k !== "Insurance" ? <TextField label={k === "PrizeBond" ? "Tax on prizes (%)" : "Tax at source (%)"} inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} error={errorFor("taxPoints")} /> : null}
        {k === "Dps" || k === "Insurance" ? <AmountField label={k === "Dps" ? "Each month (৳)" : "Premium (৳)"} value={amount} onChange={(e) => setAmount(e.target.value)} error={errorFor("amount")} /> : null}
        {k === "Fdr" ? <AmountField label="Excise duty a year (৳)" value={excise} onChange={(e) => setExcise(e.target.value)} error={errorFor("chargesPerYear")} /> : null}
        {k === "Dps" ? <AmountField label="Maturity amount from your DPS book (optional, ৳)" value={maturity} onChange={(e) => setMaturity(e.target.value)} error={errorFor("maturityAmount")} /> : null}
        {k === "Insurance" ? (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-small font-bold">Kind of policy</span>
              <Chips label="Kind of policy" options={["Life", "Health", "Car", "Other"]} value={policy} onChange={(v) => setPolicy(v as PolicyType)} />
            </div>
            <AmountField label={policy === "Life" ? "Sum assured (৳)" : "Cover (৳)"} value={cover} onChange={(e) => setCover(e.target.value)} error={errorFor("cover")} />
            <TextField label="Policy number" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} error={errorFor("policyNumber")} />
            <TextField label="Insured" value={insured} onChange={(e) => setInsured(e.target.value)} error={errorFor("insured")} />
            <TextField label="Nominee" value={nominee} onChange={(e) => setNominee(e.target.value)} error={errorFor("nominee")} />
          </>
        ) : null}
        {k === "PrizeBond" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-small font-bold">Bond numbers (one a line)</span>
            <textarea value={bonds} onChange={(e) => setBonds(e.target.value)} rows={5} className="rounded-[16px] border border-[var(--tl-glass-border)] bg-[var(--tl-glass)] p-3.5 text-body outline-none focus:border-[var(--tl-primary)]" />
          </label>
        ) : null}
        <ErrorNote>{apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : messageOf(remove.error)}</ErrorNote>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
        {confirm ? (
          <div className="flex flex-col gap-2 rounded-[18px] border border-[var(--tl-border)] p-3">
            <p className="m-0 text-body">Delete {saving.name} and everything recorded for it? Balances go back as if it never existed.</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
                Keep it
              </Button>
              <Button variant="danger" className="flex-1" disabled={remove.isPending} onClick={() => remove.mutateAsync(saving.id).then(() => navigate("/savings", { replace: true }), () => {})}>
                Yes, delete
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirm(true)}>
            Delete
          </Button>
        )}
      </form>
    </Modal>
  );
}
