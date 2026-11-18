import { dpsMaturity, drawCutoff, excise, formatBdt, nextDraw, parseRate, parseTaka, percent, profit, taxOf } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { addMonths, dateLabel, today } from "../src/data/calendar";
import { addSaving, certificateTax, deleteSaving, savingView, updateSaving } from "../src/data/savings";
import { ownWallets } from "../src/data/wallets";
import type { PolicyType, SavingKind } from "../src/db/schema";
import { db } from "../src/db/client";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Body, Button, Card, Chip, ConfirmButton, DateField, ErrorText, Field, Picker, Screen, Segmented, SwitchRow } from "../src/ui/kit";
import { Fact } from "../src/ui/loanParts";
import { KIND_LABEL } from "../src/ui/savingParts";
import { useColors } from "../src/ui/theme";

const FDR_TERMS = [1, 3, 6, 12, 24, 36];
const DPS_YEARS = [1, 2, 3, 5, 10];
const PROFIT_EVERY: [string, number][] = [["At maturity", 0], ["Every month", 1], ["Every 3 months", 3], ["Every year", 12]];
const PREMIUM_EVERY: [string, number][] = [["Monthly", 1], ["Every 3 months", 3], ["Every 6 months", 6], ["Yearly", 12]];
const SCHEMES: [string, number, number][] = [["5-year Bangladesh", 60, 0], ["3-month profit", 36, 3], ["Family (Paribar)", 60, 1], ["Pensioner", 60, 3]];
const POLICY_NAMES: Record<PolicyType, string> = { Life: "Life policy", Health: "Health cover", Car: "Car insurance", Other: "Insurance" };
const KINDS: { kind: SavingKind; sub: string }[] = [
  { kind: "Fdr", sub: "Fixed deposit" },
  { kind: "Dps", sub: "Monthly deposit" },
  { kind: "Certificate", sub: "Savings certificate" },
  { kind: "PrizeBond", sub: "৳100 bonds, draws" },
  { kind: "Insurance", sub: "Life, health, car…" },
];

export default function SavingEdit() {
  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: SavingKind }>();
  return id ? <EditSaving id={id} /> : <AddSaving initial={kind ?? "Fdr"} />;
}

function Row2({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{children}</View>;
}

function Label({ text }: { text: string }) {
  const c = useColors();
  return <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>{text}</Text>;
}

function AddSaving({ initial }: { initial: SavingKind }) {
  const c = useColors();
  const { changed } = useApp();
  const wallets = useData(() => ownWallets(db, { includeArchived: false }));
  const accounts = wallets.map((w) => ({ id: w.id, label: w.name, detail: formatBdt(w.balance) }));
  const [kind, setKind] = useState<SavingKind>(initial);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [term, setTerm] = useState(12);
  const [years, setYears] = useState(5);
  const [every, setEvery] = useState(0);
  const [scheme, setScheme] = useState(1);
  const [start, setStart] = useState<string | null>(today());
  const [tax, setTax] = useState<string>("10");
  const [exciseText, setExciseText] = useState("");
  const [held, setHeld] = useState(false);
  const [paidBefore, setPaidBefore] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [renew, setRenew] = useState<"Pay" | "Renew">("Renew");
  const [auto, setAuto] = useState(true);
  const [maturityText, setMaturityText] = useState("");
  const [bondCount, setBondCount] = useState("");
  const [bondNumbers, setBondNumbers] = useState("");
  const [policy, setPolicy] = useState<PolicyType>("Life");
  const [premiumEvery, setPremiumEvery] = useState(12);
  const [termYears, setTermYears] = useState("");
  const [cover, setCover] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [insured, setInsured] = useState("");
  const [nominee, setNominee] = useState("");
  const [remind, setRemind] = useState(true);
  const { errors, run, setErrors } = useErrors();
  const accountId = account ?? accounts[0]?.id ?? null;

  function choose(next: SavingKind) {
    setKind(next);
    setErrors({});
    setAuto(next !== "Dps");
    setTax(next === "PrizeBond" ? "20" : next === "Certificate" ? String(certificateTax(db, parseTaka(amount) ?? 0) / 100) : "10");
  }

  const principal = kind === "PrizeBond" ? (Number.parseInt(bondCount, 10) || 0) * 10_000 : (parseTaka(amount) ?? 0);
  const ratePoints = rate.trim() === "" ? 0 : parseRate(rate);
  const taxPoints = parseRate(tax);
  const months = kind === "Fdr" ? term : kind === "Dps" ? years * 12 : kind === "Certificate" ? SCHEMES[scheme]![1] : kind === "Insurance" ? (Number.parseInt(termYears, 10) || 0) * 12 : 0;
  const everyMonths = kind === "Fdr" ? every : kind === "Certificate" ? SCHEMES[scheme]![2] : kind === "Insurance" ? premiumEvery : kind === "Dps" ? 1 : 0;
  const duty = exciseText ? (parseTaka(exciseText) ?? 0) : 0;

  const live = useMemo(() => {
    if (principal <= 0 || !start || ratePoints === null || kind === "Insurance") return null;
    if (kind === "PrizeBond") {
      const draw = nextDraw(today());
      return { title: "Face value", big: principal, lines: [] as [string, string][], note: `Next draw ${dateLabel(draw)}. ${start > drawCutoff(draw) ? "Bought this late, they wait for the draw after." : "They are in it."}` };
    }
    if (kind === "Dps") {
      const at = maturityText ? (parseTaka(maturityText) ?? 0) : dpsMaturity(principal, ratePoints, months);
      return { title: `At maturity, about · ${dateLabel(addMonths(start, months - 1))}`, big: at, lines: [["You pay in", formatBdt(principal * months)], ["Profit, before tax", formatBdt(Math.max(at - principal * months, 0))]] as [string, string][], note: null };
    }
    const gross = profit(principal, ratePoints, everyMonths > 0 ? everyMonths : months);
    const t = taxOf(gross, taxPoints ?? 0);
    if (kind === "Certificate" && everyMonths > 0) {
      return { title: "Each profit payment", big: gross - t, lines: [["Profit", formatBdt(gross)], [`Tax at source, ${percent(taxPoints ?? 0)}`, `−${formatBdt(t)}`]] as [string, string][], note: null };
    }
    const d = kind === "Fdr" ? excise(duty, months) : 0;
    const lines: [string, string][] = [[`Profit, ${percent(ratePoints)} a year`, formatBdt(gross)], [`Tax at source, ${percent(taxPoints ?? 0)}`, `−${formatBdt(t)}`]];
    if (d > 0) lines.push(["Excise duty (the bank's charge)", `−${formatBdt(d)}`]);
    return { title: `At maturity · ${dateLabel(addMonths(start, months))}`, big: principal + gross - t - d, lines, note: null };
  }, [principal, start, ratePoints, kind, maturityText, months, everyMonths, taxPoints, duty]);

  function save() {
    if (kind !== "PrizeBond" && !parseTaka(amount)) return setErrors({ amount: kind === "Dps" ? "Enter the monthly instalment, like 5000." : kind === "Insurance" ? "Enter the premium, like 48500." : "Enter the amount, like 500000." });
    if (ratePoints === null) return setErrors({ ratePoints: "Enter the rate a year, like 9.75." });
    if (kind !== "Insurance" && taxPoints === null) return setErrors({ taxPoints: "Enter the tax as a %, like 10." });
    if (!start) return setErrors({ startDate: "Choose the date." });
    let newId = "";
    const ok = run(() => {
      newId = addSaving(db, {
        kind, name, provider: provider || null, payFromWalletId: accountId, alreadyHeld: held, amount: principal, bondCount: Number.parseInt(bondCount, 10) || 0,
        ratePoints, months, everyMonths, startDate: start, taxPoints: kind === "Insurance" ? null : taxPoints, chargesPerYear: duty,
        maturityAmount: maturityText ? parseTaka(maturityText) : null, cover: cover ? parseTaka(cover) : null, policy: kind === "Insurance" ? policy : null,
        policyNumber, insured, nominee, bondNumbers: bondNumbers.split("\n"), paidBefore: (held || kind === "Insurance") ? Number.parseInt(paidBefore, 10) || 0 : 0,
        autoRecord: auto, remind, renew: renew === "Renew",
      });
    });
    if (ok) {
      changed();
      router.replace({ pathname: "/saving", params: { id: newId } });
    }
  }

  return (
    <Screen title="Add savings" back footer={<Button label={`Save ${kind === "Insurance" ? "policy" : kind === "PrizeBond" ? "bonds" : KIND_LABEL[kind]}`} onPress={save} />}>
      <View accessibilityRole="radiogroup" accessibilityLabel="What are you adding" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {KINDS.map((k) => (
          <Chip key={k.kind} label={`${KIND_LABEL[k.kind]} · ${k.sub}`} selected={kind === k.kind} onPress={() => choose(k.kind)} />
        ))}
      </View>
      {kind === "Insurance" ? (
        <>
          <Label text="Kind of policy" />
          <Row2>
            {(["Life", "Health", "Car", "Other"] as PolicyType[]).map((p) => (
              <Chip key={p} label={p} selected={policy === p} onPress={() => {
                if (!name || Object.values(POLICY_NAMES).includes(name)) setName(POLICY_NAMES[p]);
                setPolicy(p);
              }} />
            ))}
          </Row2>
        </>
      ) : null}
      {kind === "Certificate" ? (
        <>
          <Label text="Scheme" />
          <Row2>
            {SCHEMES.map(([label], i) => (
              <Chip key={label} label={label} selected={scheme === i} onPress={() => {
                if (!name || SCHEMES.some(([l]) => name === `${l} Sanchayapatra`)) setName(`${label} Sanchayapatra`);
                setScheme(i);
              }} />
            ))}
          </Row2>
        </>
      ) : null}

      <Field label="Name" value={name} onChangeText={setName} placeholder={{ Fdr: "City Bank FDR", Dps: "BRAC Bank DPS", Certificate: "3-month profit Sanchayapatra", PrizeBond: "Prize bonds", Insurance: "Life policy" }[kind]} error={errors.name} />
      {kind !== "PrizeBond" ? <Field label={kind === "Insurance" ? "Insurer" : kind === "Certificate" ? "Bought from (optional)" : "Bank"} value={provider} onChangeText={setProvider} placeholder={kind === "Insurance" ? "Guardian Life" : kind === "Certificate" ? "Bank or post office" : "City Bank"} error={errors.provider} /> : null}

      {kind === "PrizeBond" ? (
        <>
          <Field label="How many ৳100 bonds" value={bondCount} onChangeText={setBondCount} keyboardType="number-pad" placeholder="30" error={errors.bondCount} />
          <Field label="Bond numbers (optional, one a line)" value={bondNumbers} onChangeText={setBondNumbers} multiline placeholder={"কখ 0412301\nকখ 0412302"} hint="Keep them here to check each draw's result." />
        </>
      ) : (
        <Field
          label={kind === "Dps" ? "Each month (৳)" : kind === "Insurance" ? "Premium (৳)" : "Amount (৳)"}
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            if (kind === "Certificate") setTax(String(certificateTax(db, parseTaka(v) ?? 0) / 100));
          }}
          keyboardType="decimal-pad"
          placeholder="0"
          error={errors.amount}
        />
      )}

      {kind === "Insurance" ? (
        <>
          <Label text="Paid" />
          <Row2>
            {PREMIUM_EVERY.map(([label, m]) => (
              <Chip key={label} label={label} selected={premiumEvery === m} onPress={() => setPremiumEvery(m)} />
            ))}
          </Row2>
        </>
      ) : null}

      {kind === "Fdr" || kind === "Dps" || kind === "Certificate" ? <Field label="Profit rate (% a year)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="9.75" error={errors.ratePoints} hint={kind === "Certificate" ? "As printed on your certificate; rates change every few months." : kind === "Fdr" ? "As written on your FDR receipt." : undefined} /> : null}

      {kind === "Fdr" ? (
        <>
          <Label text="Term" />
          <Row2>
            {FDR_TERMS.map((m) => (
              <Chip key={m} label={`${m} ${m === 1 ? "month" : "months"}`} selected={term === m} onPress={() => setTerm(m)} />
            ))}
          </Row2>
          <DateField label="Opened on" value={start} onChange={setStart} />
          <Label text="Profit is paid" />
          <Row2>
            {PROFIT_EVERY.map(([label, m]) => (
              <Chip key={label} label={label} selected={every === m} onPress={() => setEvery(m)} />
            ))}
          </Row2>
        </>
      ) : null}
      {kind === "Dps" ? (
        <>
          <Label text="Term" />
          <Row2>
            {DPS_YEARS.map((y) => (
              <Chip key={y} label={`${y} ${y === 1 ? "year" : "years"}`} selected={years === y} onPress={() => setYears(y)} />
            ))}
          </Row2>
          <DateField label="First instalment" value={start} onChange={setStart} />
          <Field label="Maturity amount from your DPS book (optional, ৳)" value={maturityText} onChangeText={setMaturityText} keyboardType="decimal-pad" error={errors.maturityAmount} />
        </>
      ) : null}
      {kind === "Certificate" ? <DateField label="Bought on" value={start} onChange={setStart} /> : null}
      {kind === "PrizeBond" ? <DateField label="Bought on" value={start} onChange={setStart} /> : null}
      {kind === "Insurance" ? (
        <>
          <DateField label="First premium" value={start} onChange={setStart} />
          <Field label="Term in years (optional)" value={termYears} onChangeText={setTermYears} keyboardType="number-pad" placeholder="15" hint="Leave empty for a policy that renews, like health or car cover." error={errors.months} />
          <Field label="Premiums already paid" value={paidBefore} onChangeText={setPaidBefore} keyboardType="number-pad" placeholder="0" error={errors.paidBefore} />
          <Field label={policy === "Life" ? "Sum assured (optional, ৳)" : "Cover (optional, ৳)"} value={cover} onChangeText={setCover} keyboardType="decimal-pad" error={errors.cover} />
          <Field label="Policy number (optional)" value={policyNumber} onChangeText={setPolicyNumber} error={errors.policyNumber} />
          <Field label="Insured (optional)" value={insured} onChangeText={setInsured} error={errors.insured} />
          <Field label="Nominee (optional)" value={nominee} onChangeText={setNominee} error={errors.nominee} />
        </>
      ) : null}
      {errors.startDate ? <ErrorText>{errors.startDate}</ErrorText> : null}

      {kind !== "Insurance" ? (
        <Field
          label={kind === "PrizeBond" ? "Tax on prizes (%)" : "Tax at source (%)"}
          value={tax}
          onChangeText={setTax}
          keyboardType="decimal-pad"
          error={errors.taxPoints}
          hint={kind === "Fdr" || kind === "Dps" ? "Usually 10% if you file a tax return, 15% if not. Your bank statement shows it." : kind === "Certificate" ? "5% while all your certificates come to ৳5,00,000 or less; 10% above." : "Taken from a prize. You can change it on each win."}
        />
      ) : null}
      {kind === "Fdr" ? <Field label="Excise duty a year (optional, ৳)" value={exciseText} onChangeText={setExciseText} keyboardType="decimal-pad" error={errors.chargesPerYear} hint="The bank's yearly charge on the balance, from your statement." /> : null}

      {live ? (
        <Card>
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: "700" }}>{live.title}</Text>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{formatBdt(live.big)}</Text>
          {live.lines.map(([label, value]) => (
            <Fact key={label} label={label} value={value} />
          ))}
          {live.note ? <Body muted>{live.note}</Body> : null}
        </Card>
      ) : null}

      <Picker label={kind === "Insurance" || kind === "Dps" ? "Pay from" : held ? "Profit and money paid into" : "Money came from"} options={accounts} value={accountId} onChange={setAccount} error={errors.payFromWalletId} />
      {kind === "Insurance" ? <SwitchRow label="Remind me 7 days before" detail="On Home, with the amount" value={remind} onChange={setRemind} /> : null}
      {kind === "Dps" ? (
        <>
          <SwitchRow label="I'm already paying this" detail="Start from today: no need to enter old instalments" value={held} onChange={setHeld} />
          {held ? <Field label="Instalments already paid" value={paidBefore} onChangeText={setPaidBefore} keyboardType="number-pad" placeholder="22" error={errors.paidBefore} /> : null}
          <SwitchRow label="The bank takes it automatically" detail="Recorded on the day, like your EMIs" value={auto} onChange={setAuto} />
        </>
      ) : null}
      {kind === "Fdr" || kind === "Certificate" || kind === "PrizeBond" ? (
        <>
          <SwitchRow label={kind === "PrizeBond" ? "I bought these before" : "I opened this before"} detail="Start from today: no money moves now" value={held} onChange={setHeld} />
          {held && kind === "Certificate" ? <Field label="Profit payments already received" value={paidBefore} onChangeText={setPaidBefore} keyboardType="number-pad" placeholder="0" error={errors.paidBefore} /> : null}
        </>
      ) : null}
      {kind === "Certificate" ? <SwitchRow label="Record each payment automatically" detail="On its date, into the account above" value={auto} onChange={setAuto} /> : null}
      {kind === "Fdr" ? (
        <>
          <Segmented label="When it matures" value={renew} onChange={setRenew} options={[{ value: "Pay", label: "Pay into my account" }, { value: "Renew", label: "Renew" }]} />
          <Body muted>Renew keeps the money and profit in a new FDR for the same term.</Body>
        </>
      ) : null}
      {errors.form || errors.everyMonths || errors.policy || errors.saving ? <ErrorText>{errors.form ?? errors.everyMonths ?? errors.policy ?? errors.saving}</ErrorText> : null}
    </Screen>
  );
}

function EditSaving({ id }: { id: string }) {
  const { changed } = useApp();
  const s = useMemo(() => savingView(db, id), [id]);
  const wallets = useData(() => ownWallets(db, { includeArchived: false }));
  const [name, setName] = useState(s?.name ?? "");
  const [provider, setProvider] = useState(s?.provider ?? "");
  const [payFrom, setPayFrom] = useState<string | null>(s?.payFromWalletId ?? null);
  const [rate, setRate] = useState(s ? String(s.ratePoints / 100) : "");
  const [tax, setTax] = useState(s ? String(s.taxPoints / 100) : "");
  const [amount, setAmount] = useState(s ? (s.amount / 100).toFixed(2).replace(/\.00$/, "") : "");
  const [duty, setDuty] = useState(s?.chargesPerYear ? String(s.chargesPerYear / 100) : "");
  const [maturity, setMaturity] = useState(s?.maturityAmount ? String(s.maturityAmount / 100) : "");
  const [cover, setCover] = useState(s?.cover ? String(s.cover / 100) : "");
  const [policyNumber, setPolicyNumber] = useState(s?.policyNumber ?? "");
  const [insured, setInsured] = useState(s?.insured ?? "");
  const [nominee, setNominee] = useState(s?.nominee ?? "");
  const [bonds, setBonds] = useState(s?.bondList.join("\n") ?? "");
  const { errors, run, setErrors } = useErrors();
  if (!s) {
    return (
      <Screen title="Edit" back>
        <Body muted>This is no longer here.</Body>
      </Screen>
    );
  }
  const k = s.kind;
  const hasRate = k === "Fdr" || k === "Dps" || k === "Certificate";
  const accounts = wallets.map((w) => ({ id: w.id, label: w.name, detail: formatBdt(w.balance) }));

  function save() {
    const ratePoints = parseRate(rate);
    const taxPoints = parseRate(tax);
    if (hasRate && ratePoints === null) return setErrors({ ratePoints: "Enter the rate a year, like 9.75." });
    if (k !== "Insurance" && taxPoints === null) return setErrors({ taxPoints: "Enter the tax as a %, like 10." });
    if (run(() => updateSaving(db, s!.id, {
      name, provider: provider || null, payFromWalletId: payFrom ?? "", amount: k === "Dps" || k === "Insurance" ? parseTaka(amount) : null,
      ratePoints: hasRate ? ratePoints : null, taxPoints: k !== "Insurance" ? taxPoints : null, chargesPerYear: k === "Fdr" ? (duty ? parseTaka(duty) : 0) : null,
      maturityAmount: maturity ? parseTaka(maturity) : null, cover: cover ? parseTaka(cover) : null, policy: s!.policy, policyNumber, insured, nominee,
      bondNumbers: k === "PrizeBond" ? bonds.split("\n") : null, autoRecord: null, remind: null, renew: null,
    }))) {
      changed();
      router.back();
    }
  }

  return (
    <Screen title={`Edit ${s.name}`} back footer={<Button label="Save" onPress={save} />}>
      <Field label="Name" value={name} onChangeText={setName} error={errors.name} />
      {k !== "PrizeBond" ? <Field label={k === "Insurance" ? "Insurer" : "Bank"} value={provider} onChangeText={setProvider} error={errors.provider} /> : null}
      <Picker label={k === "Insurance" || k === "Dps" ? "Pay from" : "Profit and money paid into"} options={accounts} value={payFrom} onChange={setPayFrom} error={errors.payFromWalletId} />
      {hasRate ? <Field label="Profit rate (% a year)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" error={errors.ratePoints} hint="A new rate applies from the next payment." /> : null}
      {k !== "Insurance" ? <Field label={k === "PrizeBond" ? "Tax on prizes (%)" : "Tax at source (%)"} value={tax} onChangeText={setTax} keyboardType="decimal-pad" error={errors.taxPoints} /> : null}
      {k === "Dps" || k === "Insurance" ? <Field label={k === "Dps" ? "Each month (৳)" : "Premium (৳)"} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={errors.amount} /> : null}
      {k === "Fdr" ? <Field label="Excise duty a year (৳)" value={duty} onChangeText={setDuty} keyboardType="decimal-pad" /> : null}
      {k === "Dps" ? <Field label="Maturity amount from your DPS book (optional, ৳)" value={maturity} onChangeText={setMaturity} keyboardType="decimal-pad" /> : null}
      {k === "Insurance" ? (
        <>
          <Field label={s.policy === "Life" ? "Sum assured (৳)" : "Cover (৳)"} value={cover} onChangeText={setCover} keyboardType="decimal-pad" />
          <Field label="Policy number" value={policyNumber} onChangeText={setPolicyNumber} />
          <Field label="Insured" value={insured} onChangeText={setInsured} />
          <Field label="Nominee" value={nominee} onChangeText={setNominee} />
        </>
      ) : null}
      {k === "PrizeBond" ? <Field label="Bond numbers (one a line)" value={bonds} onChangeText={setBonds} multiline /> : null}
      {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
      <ConfirmButton
        label="Delete"
        confirmLabel="Yes, delete it and everything recorded for it"
        onConfirm={() => {
          deleteSaving(db, s.id);
          changed();
          router.dismissTo("/savings");
        }}
      />
    </Screen>
  );
}
