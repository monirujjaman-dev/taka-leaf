import { formatBdt, parseRate, parseTaka } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { loanView, payEmi, payExtra, settleLoan, settlementCharge } from "../src/data/loans";
import { ownWallets } from "../src/data/wallets";
import { db } from "../src/db/client";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Body, Button, Card, DateTimeField, ErrorText, Field, Picker, Screen, Segmented } from "../src/ui/kit";
import { Fact } from "../src/ui/loanParts";
import { useColors } from "../src/ui/theme";

type Mode = "emi" | "extra" | "settle";
const TITLES: Record<Mode, string> = { emi: "Record EMI", extra: "Pay extra", settle: "Settle the loan" };

export default function BankLoanPay() {
  const c = useColors();
  const { changed } = useApp();
  const { id, mode = "emi" } = useLocalSearchParams<{ id: string; mode?: Mode }>();
  const loan = useMemo(() => loanView(db, id), [id]);
  const wallets = useData(() => ownWallets(db, { includeArchived: false }));
  const [walletId, setWalletId] = useState<string | null>(loan?.payFromWalletId ?? null);
  const [amount, setAmount] = useState("");
  const [lateFee, setLateFee] = useState("");
  const [chargeBy, setChargeBy] = useState<"percent" | "amount">("percent");
  const [charge, setCharge] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString());
  const { errors, run, setErrors } = useErrors();
  if (!loan || !loan.next) {
    return (
      <Screen title={TITLES[mode]} back>
        <Body muted>This loan is paid off.</Body>
      </Screen>
    );
  }
  const card = loan.type === "CardEmi";
  const options = wallets.filter((w) => (card && mode === "settle" ? w.id === loan.payFromWalletId : w.type !== "Loan")).map((w) => ({ id: w.id, label: w.name, detail: formatBdt(w.balance) }));
  const points = chargeBy === "percent" && charge.trim() ? parseRate(charge) : 0;
  const chargePoisha = chargeBy === "percent" ? (points === null ? null : settlementCharge(loan.outstanding, points)) : charge.trim() ? parseTaka(charge) : 0;

  function save() {
    if (!walletId) return setErrors({ walletId: "Choose the wallet it was paid from." });
    let ok = false;
    if (mode === "emi") {
      const typed = amount.trim() ? parseTaka(amount) : null;
      if (amount.trim() && !typed) return setErrors({ amount: "Enter the amount paid, like 25202.23." });
      const fee = lateFee.trim() ? parseTaka(lateFee) : 0;
      if (fee === null) return setErrors({ lateFee: "Enter the fee in taka, like 500." });
      ok = run(() => payEmi(db, loan!.id, { walletId, amount: typed, lateFee: fee, occurredAt }));
    } else if (mode === "extra") {
      const typed = parseTaka(amount);
      if (!typed) return setErrors({ amount: "Enter the amount paid, like 50000." });
      ok = run(() => payExtra(db, loan!.id, { walletId, amount: typed, occurredAt }));
    } else {
      if (chargePoisha === null) return setErrors({ charge: chargeBy === "percent" ? "Enter the charge as a % of what is left, like 2." : "Enter the charge in taka, like 18000." });
      ok = run(() => settleLoan(db, loan!.id, { walletId, charge: chargePoisha, occurredAt }));
    }
    if (ok) {
      changed();
      router.back();
    }
  }

  return (
    <Screen title={`${TITLES[mode]} · ${loan.name}`} back footer={<Button label={mode === "settle" ? (card ? "Pay off the rest" : "Settle the loan") : mode === "extra" ? "Record extra payment" : "Record payment"} onPress={save} />}>
      {mode === "emi" ? (
        <Card>
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>{`EMI ${loan.next.number}`}</Text>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{formatBdt(loan.next.total)}</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Fact label="Principal" value={formatBdt(loan.next.principal)} />
            <Fact label="Interest" value={formatBdt(loan.next.interest)} />
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>{card ? "Still to be billed" : "Left to pay"}</Text>
          <Text style={{ color: c.text, fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{formatBdt(loan.outstanding)}</Text>
          {mode === "settle" ? (
            <Body muted>{card ? "Moves everything still to be billed onto the card now, and closes the EMI." : "Pays what is left, plus the bank's settlement charge, and marks the loan closed."}</Body>
          ) : (
            <Body muted>All of it goes to the principal, so later EMIs carry less interest.</Body>
          )}
        </Card>
      )}

      <Picker label={card && mode === "settle" ? "Credit card" : "Paid from"} options={options} value={walletId} onChange={setWalletId} error={errors.walletId} />
      {mode === "emi" ? (
        <>
          <Field label="Amount paid (optional, ৳)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={(loan.next.total / 100).toFixed(2)} error={errors.amount} hint="Leave empty if you paid the EMI as scheduled." />
          <Field label="Late fee or charges (optional, ৳)" value={lateFee} onChangeText={setLateFee} keyboardType="decimal-pad" placeholder="0" error={errors.lateFee} hint="Counted under Fees and charges." />
        </>
      ) : mode === "extra" ? (
        <Field label="Amount (৳)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" error={errors.amount} />
      ) : (
        <>
          <Segmented label="Early settlement charge" value={chargeBy} onChange={(v) => (setChargeBy(v), setCharge(""))} options={[{ value: "percent", label: "% of what is left" }, { value: "amount", label: "An amount" }]} />
          <Field
            label={chargeBy === "percent" ? "Charge (% of what is left)" : "Charge (৳)"}
            value={charge}
            onChangeText={setCharge}
            keyboardType="decimal-pad"
            placeholder={chargeBy === "percent" ? "2" : "0"}
            error={errors.charge}
            hint="Counted under Fees and charges."
          />
          <Card>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Fact label="What is left" value={formatBdt(loan.outstanding)} />
              <Fact label="Charge" value={chargePoisha === null ? "—" : formatBdt(chargePoisha)} />
            </View>
            <Fact label="Total to pay now" value={chargePoisha === null ? "—" : formatBdt(loan.outstanding + chargePoisha)} />
          </Card>
        </>
      )}
      <DateTimeField label="When" value={occurredAt} onChange={setOccurredAt} />
      {errors.form || errors.loan ? <ErrorText>{errors.form ?? errors.loan}</ErrorText> : null}
    </Screen>
  );
}
