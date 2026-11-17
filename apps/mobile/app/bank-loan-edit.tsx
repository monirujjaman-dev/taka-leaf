import { emiFor, formatBdt, formatRate, parseRate, parseTaka, schedule } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { addMonths, dateLabel, today } from "../src/data/calendar";
import { categoryTree } from "../src/data/categories";
import { addLoan, deleteLoan, loanView, updateLoan } from "../src/data/loans";
import { ownWallets } from "../src/data/wallets";
import type { LoanType } from "../src/db/schema";
import { db } from "../src/db/client";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Body, Button, Card, Chip, ConfirmButton, DateField, ErrorText, Field, Notice, Picker, Screen, Segmented, SwitchRow } from "../src/ui/kit";
import { Fact } from "../src/ui/loanParts";
import { useColors } from "../src/ui/theme";

const TERMS = [12, 24, 36, 48, 60];
const taka = (poisha: number) => (poisha / 100).toFixed(2).replace(/\.00$/, "");

export default function BankLoanEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return id ? <EditLoan id={id} /> : <AddLoan />;
}

function AddLoan() {
  const c = useColors();
  const { changed } = useApp();
  const wallets = useData(() => ownWallets(db, { includeArchived: false }));
  const tree = useData(() => categoryTree(db, "Expense"));
  const [type, setType] = useState<LoanType>("Bank");
  const card = type === "CardEmi";
  const [name, setName] = useState("");
  const [lender, setLender] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [months, setMonths] = useState("");
  const [bankEmi, setBankEmi] = useState("");
  const [firstDue, setFirstDue] = useState<string | null>(addMonths(today(), 1));
  const [running, setRunning] = useState(false);
  const [paidBefore, setPaidBefore] = useState("");
  const [payFrom, setPayFrom] = useState<string | null>(null);
  const [receivedIn, setReceivedIn] = useState<string | null>(null);
  const [fee, setFee] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const { errors, run, setErrors } = useErrors();

  const cards = wallets.filter((w) => w.type === "CreditCard").map((w) => ({ id: w.id, label: w.name, detail: w.availableCredit != null ? `${formatBdt(w.availableCredit)} free` : formatBdt(w.balance) }));
  const payers = wallets.filter((w) => w.type !== "CreditCard").map((w) => ({ id: w.id, label: w.name, detail: formatBdt(w.balance) }));
  const categoryOptions = tree.flatMap((p) => [{ id: p.id, label: p.name, group: p.name }, ...p.children.map((ch) => ({ id: ch.id, label: ch.name, group: p.name }))]);

  const p = parseTaka(principal) ?? 0;
  const points = rate.trim() === "" ? 0 : parseRate(rate);
  const n = Number(months);
  const typedEmi = bankEmi.trim() ? parseTaka(bankEmi) : null;
  const preview = useMemo(() => {
    if (!p || points === null || !Number.isInteger(n) || n < 1 || n > 600) return null;
    const emi = typedEmi ?? emiFor(p, points, n);
    const rows = schedule(p, points, emi);
    if (!rows.length) return null;
    const interest = rows.reduce((s, r) => s + r.interest, 0);
    return { emi, interest, total: p + interest, last: firstDue ? addMonths(firstDue, rows.length - 1) : null };
  }, [p, points, n, typedEmi, firstDue]);

  function save() {
    if (!p) return setErrors({ principal: card ? "Enter the price, like 119400." : "Enter the loan amount, like 1200000." });
    if (points === null) return setErrors({ ratePoints: "Enter the rate a year, like 9.5." });
    if (!n) return setErrors({ months: "Enter the months, like 60." });
    if (bankEmi.trim() && !typedEmi) return setErrors({ emi: "Enter the bank's EMI, like 25202.23." });
    if (!firstDue) return setErrors({ firstDueDate: card ? "Choose the first statement date." : "Choose the date of the first EMI." });
    const feePoisha = fee.trim() ? parseTaka(fee) : 0;
    if (feePoisha === null) return setErrors({ processingFee: "Enter the fee in taka, like 6000." });
    let newId = "";
    const ok = run(() => {
      newId = addLoan(db, {
        type, name, lender: card ? null : lender, payFromWalletId: payFrom, principal: p, ratePoints: points, months: n, emi: typedEmi, firstDueDate: firstDue,
        paidBefore: running ? Number(paidBefore) || 0 : 0, autoRecord: card || auto, receivedInWalletId: card || running ? null : receivedIn, processingFee: card || running ? 0 : feePoisha, purchaseCategoryId: card ? categoryId : null,
      });
    });
    if (ok) {
      changed();
      router.replace({ pathname: "/bank-loan", params: { id: newId } });
    }
  }

  return (
    <Screen title="Add a loan" back footer={<Button label="Save loan" onPress={save} />}>
      <Segmented label="Kind of loan" value={type} onChange={setType} options={[{ value: "Bank", label: "Bank loan" }, { value: "CardEmi", label: "Credit card EMI" }]} />
      <Field label="Name" value={name} onChangeText={setName} placeholder={card ? "Laptop EMI" : "Home loan"} error={errors.name} />
      {card ? (
        cards.length ? (
          <Picker label="Credit card" options={cards} value={payFrom} onChange={setPayFrom} error={errors.payFromWalletId} />
        ) : (
          <Notice>Add your credit card in Wallets first.</Notice>
        )
      ) : (
        <Field label="Bank name" value={lender} onChangeText={setLender} placeholder="City Bank" error={errors.lender} />
      )}
      <Field label={card ? "Price (৳)" : "Loan amount (৳)"} value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" placeholder="0" error={errors.principal} hint={card ? "The full price put on EMI." : "The principal the bank gave you."} />
      <Field label="Interest rate (% a year)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder={card ? "0" : "9.5"} error={errors.ratePoints} />
      <Field label="Months" value={months} onChangeText={setMonths} keyboardType="number-pad" placeholder="60" error={errors.months} />
      <View accessibilityLabel="Common terms in months" style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {TERMS.map((t) => (
          <Chip key={t} label={`${t}`} selected={months === `${t}`} onPress={() => setMonths(`${t}`)} />
        ))}
      </View>
      <Field label="EMI from your bank (optional, ৳)" value={bankEmi} onChangeText={setBankEmi} keyboardType="decimal-pad" placeholder={preview ? taka(preview.emi) : ""} error={errors.emi} hint="Leave empty to work it out." />
      <DateField label={card ? "First statement date" : "First EMI date"} value={firstDue} onChange={setFirstDue} />
      {errors.firstDueDate ? <ErrorText>{errors.firstDueDate}</ErrorText> : null}

      {preview ? (
        <Card>
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>Your EMI</Text>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{formatBdt(preview.emi)}</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Fact label="Total interest" value={formatBdt(preview.interest)} />
            <Fact label="Total to pay" value={formatBdt(preview.total)} />
          </View>
          {preview.last ? <Body muted>{`${card ? "Last bill" : "Last EMI"} ${dateLabel(preview.last)}`}</Body> : null}
        </Card>
      ) : null}

      <SwitchRow label={card ? "Some instalments are already billed" : "I'm already paying this loan"} detail="Start from today: no need to enter old EMIs" value={running} onChange={setRunning} />
      {running ? <Field label={card ? "Instalments already billed" : "EMIs already paid"} value={paidBefore} onChangeText={setPaidBefore} keyboardType="number-pad" placeholder="0" error={errors.paidBefore} /> : null}

      {!card ? (
        <>
          <Picker label="EMIs paid from" options={payers} value={payFrom} onChange={setPayFrom} error={errors.payFromWalletId} />
          {!running ? (
            <>
              <Picker label="Money received in" options={payers} value={receivedIn} onChange={setReceivedIn} allowNone="Paid to the seller" error={errors.receivedInWalletId} />
              <Field label="Processing fee (optional, ৳)" value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="0" error={errors.processingFee} hint="Recorded once, under Fees and charges." />
            </>
          ) : null}
          <SwitchRow label="The bank takes it automatically" detail="Record each EMI on its date without asking" value={auto} onChange={setAuto} />
        </>
      ) : !running ? (
        <Picker label="What it was for (optional)" options={categoryOptions} value={categoryId} onChange={setCategoryId} allowNone="No category" />
      ) : null}
      {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
    </Screen>
  );
}

function EditLoan({ id }: { id: string }) {
  const { changed } = useApp();
  const loan = useMemo(() => loanView(db, id), [id]);
  const wallets = useData(() => ownWallets(db, { includeArchived: false }));
  const [name, setName] = useState(loan?.name ?? "");
  const [lender, setLender] = useState(loan?.lender ?? "");
  const [payFrom, setPayFrom] = useState<string | null>(loan?.payFromWalletId ?? null);
  const [rate, setRate] = useState(loan ? (loan.ratePoints / 100).toString() : "");
  const [emi, setEmi] = useState(loan ? taka(loan.emi) : "");
  const [auto, setAuto] = useState(loan?.autoRecord ?? false);
  const { errors, run, setErrors } = useErrors();
  if (!loan) {
    return (
      <Screen title="Edit loan" back>
        <Body muted>This loan is no longer here.</Body>
      </Screen>
    );
  }
  const card = loan.type === "CardEmi";
  const options = wallets.filter((w) => (card ? w.type === "CreditCard" : w.type !== "CreditCard") || w.id === loan.payFromWalletId).map((w) => ({ id: w.id, label: w.name, detail: formatBdt(w.balance) }));
  const points = parseRate(rate);
  // Keeps the end date: the EMI that pays what is left over the EMIs left at the new rate.
  const keepEnd = points !== null && loan.left > 0 && points !== loan.ratePoints ? emiFor(loan.outstanding, points, loan.left) : null;

  function save() {
    if (points === null) return setErrors({ ratePoints: "Enter the rate a year, like 9.5." });
    const poisha = parseTaka(emi);
    if (!poisha) return setErrors({ emi: "Enter the EMI, like 25202.23." });
    if (run(() => updateLoan(db, loan!.id, { name, lender, payFromWalletId: payFrom ?? "", ratePoints: points, emi: poisha, autoRecord: auto }))) {
      changed();
      router.back();
    }
  }

  return (
    <Screen title="Edit loan" back footer={<Button label="Save" onPress={save} />}>
      <Field label="Name" value={name} onChangeText={setName} error={errors.name} />
      {!card ? <Field label="Bank name" value={lender} onChangeText={setLender} error={errors.lender} /> : null}
      <Picker label={card ? "Credit card" : "EMIs paid from"} options={options} value={payFrom} onChange={setPayFrom} error={errors.payFromWalletId} />
      <Field label="Interest rate (% a year)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" error={errors.ratePoints} hint={`Now ${formatRate(loan.ratePoints)}. A new rate applies from the next EMI.`} />
      <Field label={card ? "Each month (৳)" : "EMI (৳)"} value={emi} onChangeText={setEmi} keyboardType="decimal-pad" error={errors.emi} />
      {keepEnd ? <Button kind="secondary" label={`Keep the end date: ${formatBdt(keepEnd)}`} onPress={() => setEmi(taka(keepEnd))} /> : null}
      {!card ? <SwitchRow label="The bank takes it automatically" detail="Record each EMI on its date without asking" value={auto} onChange={setAuto} /> : null}
      {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
      <ConfirmButton
        label="Delete loan"
        confirmLabel="Yes, delete it and its payments"
        onConfirm={() => {
          deleteLoan(db, loan.id);
          changed();
          router.dismissTo("/bank-loans");
        }}
      />
    </Screen>
  );
}
