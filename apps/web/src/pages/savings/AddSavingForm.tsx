import { CERTIFICATE_LOW_TAX_LIMIT, dpsMaturity, drawCutoff, excise, formatBdt, nextDraw, parseRate, parseTaka, profit, taxOf } from "@takaleaf/shared";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../../api/client";
import { useAddSaving, useSavings, useWallets } from "../../api/queries";
import type { AddSavingInput, PolicyType, SavingKind } from "../../api/types";
import { Button } from "../../ui/Button";
import { ErrorNote } from "../../ui/Feedback";
import { AmountField, SelectField, TextField } from "../../ui/Field";
import { Modal } from "../../ui/Modal";
import { Segmented } from "../../ui/Parts";
import { pickableWallets, WalletOptions } from "../transactions/pickers";
import { Chips, dueLabel, KIND_LABEL, kindLook, Line, minus, SwitchRow, today } from "./parts";
import { IconTile } from "../../ui/Parts";

const KINDS: { kind: SavingKind; label: string; sub: string }[] = [
  { kind: "Fdr", label: "FDR", sub: "Fixed deposit" },
  { kind: "Dps", label: "DPS", sub: "Monthly deposit" },
  { kind: "Certificate", label: "Sanchayapatra", sub: "Savings certificate" },
  { kind: "PrizeBond", label: "Prize bonds", sub: "৳100 bonds, draws" },
  { kind: "Insurance", label: "Insurance", sub: "Life, health, car…" },
];

const FDR_TERMS = ["1 month", "3 months", "6 months", "12 months", "24 months", "36 months"];
const DPS_TERMS = ["1 year", "2 years", "3 years", "5 years", "10 years"];
const PROFIT_EVERY: Record<string, number> = { "At maturity": 0, "Every month": 1, "Every 3 months": 3, "Every year": 12 };
const PREMIUM_EVERY: Record<string, number> = { Monthly: 1, "Every 3 months": 3, "Every 6 months": 6, Yearly: 12 };
const SCHEMES: Record<string, { months: number; every: number }> = {
  "5-year Bangladesh": { months: 60, every: 0 },
  "3-month profit": { months: 36, every: 3 },
  "Family (Paribar)": { months: 60, every: 1 },
  Pensioner: { months: 60, every: 3 },
};
const POLICY_NAMES: Record<PolicyType, string> = { Life: "Life policy", Health: "Health cover", Car: "Car insurance", Other: "Insurance" };

const monthsOf = (term: string) => Number(term.split(" ")[0]) * (term.includes("year") ? 12 : 1);
const termText = (months: number, years: boolean) => (years ? `${months / 12} ${months === 12 ? "year" : "years"}` : `${months} ${months === 1 ? "month" : "months"}`);
const keyOf = (map: Record<string, number>, value: number) => Object.keys(map).find((k) => map[k] === value) ?? Object.keys(map)[0]!;
const validDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`));
const addMonths = (day: string, months: number) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
};

/** Adding an FDR, DPS, Sanchayapatra, prize bonds or a policy: choose the kind, then its few fields, with what it will pay worked out live. */
export function AddSavingForm({ kind: initial, onClose }: { kind?: SavingKind; onClose: () => void }) {
  const navigate = useNavigate();
  const wallets = useWallets();
  const savings = useSavings();
  const add = useAddSaving();
  const own = pickableWallets(wallets.data?.wallets ?? []);
  const [kind, setKind] = useState<SavingKind>(initial ?? "Fdr");
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [fdrTerm, setFdrTerm] = useState("12 months");
  const [dpsTerm, setDpsTerm] = useState("5 years");
  const [profitEvery, setProfitEvery] = useState("At maturity");
  const [scheme, setScheme] = useState("3-month profit");
  const [start, setStart] = useState(today());
  const [taxChoice, setTaxChoice] = useState("10%");
  const [otherTax, setOtherTax] = useState("");
  const [exciseText, setExciseText] = useState("");
  const [held, setHeld] = useState(false);
  const [paidBefore, setPaidBefore] = useState("");
  const [accountId, setAccountId] = useState("");
  const [renew, setRenew] = useState<"Pay into my account" | "Renew">("Renew");
  const [auto, setAuto] = useState(true);
  const [maturityText, setMaturityText] = useState("");
  const [bondCount, setBondCount] = useState("");
  const [bondNumbers, setBondNumbers] = useState("");
  const [policy, setPolicy] = useState<PolicyType>("Life");
  const [premiumEvery, setPremiumEvery] = useState("Yearly");
  const [termYears, setTermYears] = useState("");
  const [cover, setCover] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [insured, setInsured] = useState("");
  const [nominee, setNominee] = useState("");
  const [remind, setRemind] = useState(true);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const apiError = add.error instanceof ApiError ? add.error : null;
  const errorFor = (field: string) => problems[field] ?? apiError?.field(field);
  const account = accountId || own[0]?.id || "";

  function choose(next: SavingKind) {
    setKind(next);
    setProblems({});
    setAuto(next !== "Dps");
    setTaxChoice(next === "PrizeBond" ? "20%" : next === "Certificate" ? certificateTax(parseTaka(amount) ?? 0) : "10%");
    if (next === "Certificate") applyScheme(scheme);
  }

  function applyScheme(value: string) {
    setScheme(value);
    if (!name || Object.keys(SCHEMES).some((s) => name === `${s} Sanchayapatra`)) setName(`${value} Sanchayapatra`);
  }

  const heldCertificates = (savings.data?.savings ?? []).filter((s) => s.kind === "Certificate" && !s.closed).reduce((sum, s) => sum + s.balance, 0);
  function certificateTax(poisha: number) {
    return heldCertificates + poisha <= CERTIFICATE_LOW_TAX_LIMIT ? "5%" : "10%";
  }

  const principal = kind === "PrizeBond" ? (Number.parseInt(bondCount, 10) || 0) * 10_000 : (parseTaka(amount) ?? 0);
  const ratePoints = rate.trim() === "" ? 0 : parseRate(rate);
  const taxPoints = taxChoice === "Other" ? parseRate(otherTax) : parseRate(taxChoice);
  const months = kind === "Fdr" ? monthsOf(fdrTerm) : kind === "Dps" ? monthsOf(dpsTerm) : kind === "Certificate" ? SCHEMES[scheme]!.months : kind === "Insurance" ? (Number.parseInt(termYears, 10) || 0) * 12 : 0;
  const every = kind === "Fdr" ? PROFIT_EVERY[profitEvery]! : kind === "Certificate" ? SCHEMES[scheme]!.every : kind === "Insurance" ? PREMIUM_EVERY[premiumEvery]! : kind === "Dps" ? 1 : 0;
  const yearlyExcise = exciseText ? (parseTaka(exciseText) ?? 0) : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = kind === "Insurance" ? "Name the policy, like Life policy." : "Give it a name, like City Bank FDR.";
    if (kind === "PrizeBond" ? principal <= 0 : parseTaka(amount) === null || principal <= 0)
      found[kind === "PrizeBond" ? "bondCount" : "amount"] = kind === "PrizeBond" ? "Enter how many ৳100 bonds, like 30." : kind === "Dps" ? "Enter the monthly instalment, like 5000." : kind === "Insurance" ? "Enter the premium, like 48500." : "Enter the amount, like 500000.";
    if (ratePoints === null) found.ratePoints = "Enter the rate a year, like 9.75.";
    if (taxPoints === null && kind !== "Insurance") found.taxPoints = "Enter the tax as a %, like 10.";
    if (exciseText && parseTaka(exciseText) === null) found.chargesPerYear = "Enter the duty in taka, like 3000.";
    if (maturityText && parseTaka(maturityText) === null) found.maturityAmount = "Enter the amount from your DPS book, like 379950.";
    if (cover && parseTaka(cover) === null) found.cover = "Enter the cover in taka, like 1000000.";
    if (kind === "Insurance" && termYears && !(Number.parseInt(termYears, 10) > 0)) found.months = "Enter the years, like 15, or leave it empty.";
    if (!account) found.payFromWalletId = "Add a wallet first.";
    if (!validDay(start)) found.startDate = "Choose the date.";
    setProblems(found);
    if (Object.keys(found).length > 0) return;

    const input: AddSavingInput = {
      kind,
      name: name.trim(),
      provider: provider.trim() || null,
      payFromWalletId: account,
      fromWalletId: held || kind === "Dps" || kind === "Insurance" ? null : account,
      alreadyHeld: held,
      amount: kind === "PrizeBond" ? null : principal,
      bondCount: kind === "PrizeBond" ? principal / 10_000 : null,
      ratePoints: ratePoints ?? 0,
      months,
      everyMonths: every,
      startDate: start,
      taxPoints: kind === "Insurance" ? null : taxPoints,
      chargesPerYear: kind === "Fdr" ? yearlyExcise : null,
      maturityAmount: kind === "Dps" && maturityText ? parseTaka(maturityText) : null,
      cover: kind === "Insurance" && cover ? parseTaka(cover) : null,
      policy: kind === "Insurance" ? policy : null,
      policyNumber: policyNumber.trim() || null,
      insured: insured.trim() || null,
      nominee: nominee.trim() || null,
      bondNumbers: kind === "PrizeBond" ? bondNumbers.split("\n").map((n) => n.trim()).filter(Boolean) : null,
      paidBefore: (held || kind === "Insurance") && paidBefore ? Number.parseInt(paidBefore, 10) || 0 : 0,
      autoRecord: auto,
      remind,
      renew: renew === "Renew",
    };
    const saved = await add.mutateAsync(input).catch(() => null);
    if (saved) navigate(`/savings/${saved.id}`, { replace: true });
  }

  const accountField = (label: string, hint?: string) => (
    <SelectField label={label} value={account} onChange={(e) => setAccountId(e.target.value)} error={errorFor("payFromWalletId") ?? errorFor("fromWalletId")} hint={hint}>
      <WalletOptions wallets={own} />
    </SelectField>
  );
  const taxField = (options: string[], hint: string) => (
    <div className="flex flex-col gap-2">
      <span className="text-small font-bold">Tax at source</span>
      <Chips label="Tax at source" options={[...options, "Other"]} value={taxChoice} onChange={setTaxChoice} />
      {taxChoice === "Other" ? <TextField label="Tax (%)" inputMode="decimal" value={otherTax} onChange={(e) => setOtherTax(e.target.value)} error={errorFor("taxPoints")} /> : null}
      <p className="m-0 text-small text-[var(--tl-muted)]">{hint}</p>
    </div>
  );

  return (
    <Modal title="Add savings" onClose={onClose} sheet>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div role="radiogroup" aria-label="What are you adding" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {KINDS.map((k) => {
            const look = kindLook(k.kind, k.kind === "Insurance" ? "Life" : null);
            const on = k.kind === kind;
            return (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => choose(k.kind)}
                className={`flex min-h-24 cursor-pointer flex-col items-start gap-2 rounded-[18px] p-3 text-left ${on ? "border-2 border-forest bg-[var(--tl-surface)] dark:border-sage" : "border border-[var(--tl-border)] bg-[var(--tl-surface)]/70"}`}
              >
                <IconTile icon={look.icon} tone={look.tone} size={36} />
                <span>
                  <span className="block text-sm font-extrabold">{k.label}</span>
                  <span className="block text-caption text-[var(--tl-muted)]">{k.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        <section className="glass flex flex-col gap-3.5 rounded-[20px] p-4" aria-label={`${KIND_LABEL[kind]} details`}>
          {kind === "Insurance" ? (
            <div className="flex flex-col gap-2">
              <span className="text-small font-bold">Kind of policy</span>
              <Chips
                label="Kind of policy"
                options={["Life", "Health", "Car", "Other"]}
                value={policy}
                onChange={(v) => {
                  const next = v as PolicyType;
                  if (!name || Object.values(POLICY_NAMES).includes(name)) setName(POLICY_NAMES[next]);
                  setPolicy(next);
                }}
              />
            </div>
          ) : null}
          {kind === "Certificate" ? (
            <div className="flex flex-col gap-2">
              <span className="text-small font-bold">Scheme</span>
              <Chips label="Scheme" options={Object.keys(SCHEMES)} value={scheme} onChange={applyScheme} />
            </div>
          ) : null}

          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errorFor("name")} placeholder={{ Fdr: "City Bank FDR", Dps: "BRAC Bank DPS", Certificate: "3-month profit Sanchayapatra", PrizeBond: "Prize bonds", Insurance: "Life policy" }[kind]} />
          {kind !== "PrizeBond" ? (
            <TextField
              label={kind === "Insurance" ? "Insurer" : kind === "Certificate" ? "Bought from (optional)" : "Bank"}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              error={errorFor("provider")}
              placeholder={kind === "Insurance" ? "Guardian Life" : kind === "Certificate" ? "Bank or post office" : "City Bank"}
            />
          ) : null}

          {kind === "PrizeBond" ? (
            <>
              <TextField label="How many ৳100 bonds" inputMode="numeric" value={bondCount} onChange={(e) => setBondCount(e.target.value)} error={errorFor("bondCount")} placeholder="30" />
              <label className="flex flex-col gap-1.5">
                <span className="text-small font-bold">Bond numbers (optional, one a line)</span>
                <textarea
                  value={bondNumbers}
                  onChange={(e) => setBondNumbers(e.target.value)}
                  rows={4}
                  placeholder={"কখ 0412301\nকখ 0412302"}
                  className="rounded-[16px] border border-[var(--tl-glass-border)] bg-[var(--tl-glass)] p-3.5 text-body tabular-nums outline-none focus:border-[var(--tl-primary)]"
                />
                <span className="text-small text-[var(--tl-muted)]">Keep them here to check each draw's result.</span>
              </label>
            </>
          ) : (
            <AmountField
              label={kind === "Dps" ? "Each month (৳)" : kind === "Insurance" ? "Premium (৳)" : "Amount (৳)"}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (kind === "Certificate" && taxChoice !== "Other") setTaxChoice(certificateTax(parseTaka(e.target.value) ?? 0));
              }}
              error={errorFor("amount")}
            />
          )}

          {kind === "Insurance" ? (
            <div className="flex flex-col gap-2">
              <span className="text-small font-bold">Paid</span>
              <Chips label="Premium paid" options={Object.keys(PREMIUM_EVERY)} value={premiumEvery} onChange={setPremiumEvery} />
            </div>
          ) : null}

          {kind === "Fdr" || kind === "Dps" || kind === "Certificate" ? (
            <TextField label="Profit rate (% a year)" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} error={errorFor("ratePoints")} placeholder="9.75" hint={kind === "Certificate" ? "As printed on your certificate; rates change every few months." : kind === "Fdr" ? "As written on your FDR receipt." : undefined} />
          ) : null}

          {kind === "Fdr" ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-small font-bold">Term</span>
                <Chips label="Term" options={FDR_TERMS} value={fdrTerm} onChange={setFdrTerm} />
              </div>
              <TextField label={held ? "Opened on" : "Opened on"} type="date" value={start} onChange={(e) => setStart(e.target.value)} error={errorFor("startDate")} />
              <div className="flex flex-col gap-2">
                <span className="text-small font-bold">Profit is paid</span>
                <Chips label="Profit is paid" options={Object.keys(PROFIT_EVERY)} value={profitEvery} onChange={setProfitEvery} />
              </div>
              {taxField(["10%", "15%"], "Usually 10% if you file a tax return, 15% if not. Your bank statement shows it.")}
              <AmountField label="Excise duty a year (optional, ৳)" value={exciseText} onChange={(e) => setExciseText(e.target.value)} error={errorFor("chargesPerYear")} hint="The bank's yearly charge on the balance, from your statement." />
            </>
          ) : null}

          {kind === "Dps" ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-small font-bold">Term</span>
                <Chips label="Term" options={DPS_TERMS} value={dpsTerm} onChange={setDpsTerm} />
              </div>
              <TextField label="First instalment" type="date" value={start} onChange={(e) => setStart(e.target.value)} error={errorFor("startDate")} />
              <AmountField label="Maturity amount from your DPS book (optional, ৳)" value={maturityText} onChange={(e) => setMaturityText(e.target.value)} error={errorFor("maturityAmount")} />
            </>
          ) : null}

          {kind === "Certificate" ? (
            <>
              <p className="m-0 text-small text-[var(--tl-muted)]">
                {termText(SCHEMES[scheme]!.months, true)}, profit {every === 0 ? "at maturity" : every === 1 ? "every month" : `every ${every} months`}.
              </p>
              <TextField label="Bought on" type="date" value={start} onChange={(e) => setStart(e.target.value)} error={errorFor("startDate")} />
              {taxField(["5%", "10%"], `5% while all your certificates come to ৳5,00,000 or less (you have ${formatBdt(heldCertificates).replace(/\.00$/, "")} now); 10% above.`)}
            </>
          ) : null}

          {kind === "PrizeBond" ? (
            <>
              <TextField label="Bought on" type="date" value={start} onChange={(e) => setStart(e.target.value)} error={errorFor("startDate")} />
              {taxField(["20%", "25%"], "Tax taken from a prize. You can change it on each win.")}
            </>
          ) : null}

          {kind === "Insurance" ? (
            <>
              <TextField label="First premium" type="date" value={start} onChange={(e) => setStart(e.target.value)} error={errorFor("startDate")} />
              <TextField label="Term in years (optional)" inputMode="numeric" value={termYears} onChange={(e) => setTermYears(e.target.value)} error={errorFor("months")} hint="Leave empty for a policy that renews, like health or car cover." placeholder="15" />
              <TextField label="Premiums already paid" inputMode="numeric" value={paidBefore} onChange={(e) => setPaidBefore(e.target.value)} error={errorFor("paidBefore")} placeholder="0" />
              <AmountField label={policy === "Life" ? "Sum assured (optional, ৳)" : "Cover (optional, ৳)"} value={cover} onChange={(e) => setCover(e.target.value)} error={errorFor("cover")} />
              <TextField label="Policy number (optional)" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} error={errorFor("policyNumber")} />
              <TextField label="Insured (optional)" value={insured} onChange={(e) => setInsured(e.target.value)} error={errorFor("insured")} />
              <TextField label="Nominee (optional)" value={nominee} onChange={(e) => setNominee(e.target.value)} error={errorFor("nominee")} />
            </>
          ) : null}

          <LiveCard kind={kind} principal={principal} ratePoints={ratePoints ?? 0} taxPoints={taxPoints ?? 0} months={months} every={every} start={start} yearlyExcise={yearlyExcise} maturity={maturityText ? parseTaka(maturityText) : null} />

          {kind === "Insurance" ? (
            <>
              {accountField("Pay from")}
              <SwitchRow label="Remind me 7 days before" detail="On the dashboard, with the amount" checked={remind} onChange={setRemind} />
            </>
          ) : kind === "Dps" ? (
            <>
              {accountField("Paid from")}
              <SwitchRow label="I'm already paying this" detail="Start from today: no need to enter old instalments" checked={held} onChange={setHeld} />
              {held ? <TextField label="Instalments already paid" inputMode="numeric" value={paidBefore} onChange={(e) => setPaidBefore(e.target.value)} error={errorFor("paidBefore")} placeholder="22" /> : null}
              <SwitchRow label="The bank takes it automatically" detail="Recorded on the day, like your EMIs" checked={auto} onChange={setAuto} />
            </>
          ) : (
            <>
              {accountField(held ? "Profit and money paid into" : kind === "PrizeBond" ? "Money came from" : "Money came from", held ? undefined : principal > 0 && validDay(start) ? `Moves ${formatBdt(principal)} on ${dueLabel(start)}.` : undefined)}
              <SwitchRow label={kind === "PrizeBond" ? "I bought these before" : "I opened this before"} detail="Start from today: no money moves now" checked={held} onChange={setHeld} />
              {held && kind === "Certificate" ? <TextField label="Profit payments already received" inputMode="numeric" value={paidBefore} onChange={(e) => setPaidBefore(e.target.value)} error={errorFor("paidBefore")} placeholder="0" /> : null}
              {kind === "Certificate" ? <SwitchRow label="Record each payment automatically" detail="On its date, into the account above" checked={auto} onChange={setAuto} /> : null}
              {kind === "Fdr" ? (
                <div className="flex flex-col gap-2">
                  <span className="text-small font-bold">When it matures</span>
                  <Segmented label="When it matures" value={renew} onChange={setRenew} options={[{ value: "Pay into my account", label: "Pay into my account" }, { value: "Renew", label: "Renew" }]} />
                  <p className="m-0 text-small text-[var(--tl-muted)]">Renew keeps the money and profit in a new FDR for the same term.</p>
                </div>
              ) : null}
            </>
          )}
        </section>

        <ErrorNote>{apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : null}</ErrorNote>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? "Saving…" : `Save ${kind === "Insurance" ? "policy" : kind === "PrizeBond" ? "bonds" : KIND_LABEL[kind]}`}
        </Button>
      </form>
    </Modal>
  );
}

/** What the saving will pay, worked out as the server does, while the form is filled in. */
function LiveCard({ kind, principal, ratePoints, taxPoints, months, every, start, yearlyExcise, maturity }: {
  kind: SavingKind; principal: number; ratePoints: number; taxPoints: number; months: number; every: number; start: string; yearlyExcise: number; maturity: number | null;
}) {
  if (principal <= 0 || kind === "Insurance" || !validDay(start)) return null;
  if (kind === "PrizeBond") {
    const draw = nextDraw(today());
    const waits = start > drawCutoff(draw);
    return (
      <div className="glass rounded-[18px] px-4 py-3.5" aria-live="polite">
        <p className="m-0 text-small font-bold text-[var(--tl-muted)]">Face value</p>
        <p className="m-0 mt-1 text-2xl font-extrabold tabular-nums">{formatBdt(principal)}</p>
        <p className="m-0 mt-1 text-small text-[var(--tl-muted)]">
          Next draw {dueLabel(draw)}. {waits ? "Bought this late, they wait for the draw after." : "They are in it."}
        </p>
      </div>
    );
  }
  if (kind === "Dps") {
    const total = principal * months;
    const at = maturity ?? dpsMaturity(principal, ratePoints, months);
    return (
      <div className="glass rounded-[18px] px-4 pb-1.5 pt-3.5" aria-live="polite">
        <p className="m-0 text-small font-bold text-[var(--tl-muted)]">At maturity, about · {dueLabel(addMonths(start, months - 1))}</p>
        <p className="m-0 mb-1.5 mt-1 text-[26px] font-extrabold tabular-nums">{formatBdt(at)}</p>
        <dl className="m-0">
          <Line label="You pay in" value={formatBdt(total)} />
          <Line label="Profit, before tax" value={formatBdt(Math.max(at - total, 0))} tone="income" />
        </dl>
      </div>
    );
  }
  const gross = profit(principal, ratePoints, every > 0 ? every : months);
  const tax = taxOf(gross, taxPoints);
  if (kind === "Certificate" && every > 0) {
    return (
      <div className="glass rounded-[18px] px-4 pb-1.5 pt-3.5" aria-live="polite">
        <p className="m-0 text-small font-bold text-[var(--tl-muted)]">Each profit payment</p>
        <dl className="m-0 mt-1">
          <Line label="Profit" value={formatBdt(gross)} tone="income" />
          <Line label={`Tax at source, ${taxPoints / 100}%`} value={minus(tax)} tone="expense" />
          <Line label="Into your account" value={formatBdt(gross - tax)} strong />
        </dl>
      </div>
    );
  }
  const duty = kind === "Fdr" ? excise(yearlyExcise, months) : 0;
  return (
    <div className="glass rounded-[18px] px-4 pb-1.5 pt-3.5" aria-live="polite">
      <p className="m-0 text-small font-bold text-[var(--tl-muted)]">At maturity · {dueLabel(addMonths(start, months))}</p>
      <p className="m-0 mb-1.5 mt-1 text-[26px] font-extrabold tabular-nums">{formatBdt(principal + gross - tax - duty)}</p>
      <dl className="m-0">
        <Line label={`Profit${every > 0 ? " (last payment)" : ""}, ${ratePoints / 100}% a year`} value={formatBdt(gross)} tone="income" />
        <Line label={`Tax at source, ${taxPoints / 100}%`} value={minus(tax)} tone="expense" />
        {duty > 0 ? <Line label="Excise duty (the bank's charge)" value={minus(duty)} tone="expense" /> : null}
      </dl>
    </div>
  );
}
