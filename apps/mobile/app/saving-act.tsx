import { formatBdt, parseRate, parseTaka, PRIZES, taxOf } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { addBonds, closeSaving, expected, periodProfit, PRIZE_NAMES, recordPayout, recordPrize, recordProfit, savingView, sellBonds } from "../src/data/savings";
import { ownWallets } from "../src/data/wallets";
import { db } from "../src/db/client";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Body, Button, Card, Chip, DateTimeField, ErrorText, Field, Picker, Screen } from "../src/ui/kit";
import { Fact } from "../src/ui/loanParts";

type Mode = "profit" | "close" | "early" | "prize" | "bonds" | "sell" | "claim" | "matured";
const TITLES: Record<Mode, string> = { profit: "Record profit", close: "Record maturity", early: "Close early", prize: "I won a prize", bonds: "Add bonds", sell: "Sell bonds back", claim: "Got a claim", matured: "Policy matured" };
const taka = (poisha: number | null) => (poisha === null ? "" : (poisha / 100).toFixed(2).replace(/\.00$/, ""));

export default function SavingAct() {
  const { changed } = useApp();
  const { id, mode = "profit" } = useLocalSearchParams<{ id: string; mode?: Mode }>();
  const s = useMemo(() => savingView(db, id), [id]);
  const wallets = useData(() => ownWallets(db, { includeArchived: false }));
  const start = useMemo(() => (s ? expected(s) : null), [s]);
  const gross0 = s ? periodProfit(s) : 0;
  const [walletId, setWalletId] = useState<string | null>(s?.payFromWalletId ?? null);
  const [when, setWhen] = useState(new Date().toISOString());
  const [amount, setAmount] = useState(mode === "profit" ? taka(gross0) : mode === "close" ? taka(start?.received ?? null) : mode === "matured" && s?.cover ? taka(s.cover) : mode === "sell" ? String(s?.bondCount ?? "") : mode === "prize" ? taka(PRIZES[4]) : "");
  const [tax, setTax] = useState(mode === "profit" && s ? taka(taxOf(gross0, s.taxPoints)) : mode === "close" ? taka(start?.tax ?? null) : mode === "prize" && s ? String(s.taxPoints / 100) : "");
  const [prizeIndex, setPrizeIndex] = useState(4);
  const [bond, setBond] = useState(s?.bondList[0] ?? "");
  const [numbers, setNumbers] = useState("");
  const { errors, run, setErrors } = useErrors();
  if (!s) {
    return (
      <Screen title={TITLES[mode]} back>
        <Body muted>This is no longer here.</Body>
      </Screen>
    );
  }
  const a = parseTaka(amount);
  const t = tax ? parseTaka(tax) : 0;
  const points = mode === "prize" ? parseRate(tax) : null;
  const count = Number.parseInt(amount, 10);

  function save() {
    const occurredAt = when;
    let ok = false;
    switch (mode) {
      case "profit":
        if (!a) return setErrors({ profit: "Enter the profit before tax, like 13800." });
        if (t === null) return setErrors({ tax: "Enter the tax in taka, like 690." });
        ok = run(() => recordProfit(db, s!.id, { walletId, profit: a, tax: t, occurredAt }));
        break;
      case "close":
      case "early":
        if (a === null) return setErrors({ received: "Enter what reached your account, like 500000." });
        if (t === null) return setErrors({ tax: "Enter the tax in taka, or leave it empty." });
        ok = run(() => closeSaving(db, s!.id, { walletId, received: a, tax: t, charges: mode === "close" ? (start?.charges ?? 0) : 0, occurredAt }));
        break;
      case "prize":
        if (!a) return setErrors({ prize: "Enter the prize, like 10000." });
        if (points === null) return setErrors({ taxPoints: "Enter the tax as a %, like 20." });
        ok = run(() => recordPrize(db, s!.id, { walletId, prize: a, taxPoints: points, bond, occurredAt }));
        break;
      case "bonds":
        if (!(count > 0)) return setErrors({ bondCount: "Enter how many ৳100 bonds, like 10." });
        ok = run(() => addBonds(db, s!.id, { walletId, bondCount: count, bondNumbers: numbers.split("\n"), occurredAt }));
        break;
      case "sell":
        if (!(count > 0)) return setErrors({ bondCount: `Enter 1 to ${s!.bondCount}.` });
        ok = run(() => sellBonds(db, s!.id, { walletId, bondCount: count, occurredAt }));
        break;
      case "claim":
      case "matured":
        if (!a) return setErrors({ amount: "Enter the amount paid to you, like 100000." });
        ok = run(() => recordPayout(db, s!.id, { walletId, amount: a, kind: mode === "claim" ? "Claim" : "Maturity", occurredAt }));
        break;
    }
    if (ok) {
      changed();
      router.back();
    }
  }

  const accounts = wallets.map((w) => ({ id: w.id, label: w.name, detail: formatBdt(w.balance) }));
  const difference = a !== null && t !== null ? a + t - s.balance : null;
  return (
    <Screen title={`${TITLES[mode]} · ${s.name}`} back footer={<Button label={TITLES[mode]} onPress={save} />}>
      {mode === "profit" ? (
        <>
          <Field label="Profit before tax (৳)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={errors.profit} />
          <Field label="Tax at source (৳)" value={tax} onChangeText={setTax} keyboardType="decimal-pad" error={errors.tax} />
          <Card>
            <Fact label="Into your account" value={a !== null && t !== null ? formatBdt(a - t) : "—"} />
          </Card>
        </>
      ) : null}
      {mode === "close" || mode === "early" ? (
        <>
          <Body muted>{mode === "early" ? "Enter what the bank paid you. Breaking it early usually pays a lower rate, or none." : "These are the expected amounts. Change them to what reached your account."}</Body>
          <Field label="Amount that reached your account (৳)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={errors.received} />
          <Field label="Tax taken at source (optional, ৳)" value={tax} onChangeText={setTax} keyboardType="decimal-pad" error={errors.tax} />
          <Card>
            <Fact label="Money in it" value={formatBdt(s.balance)} />
            {difference !== null ? <Fact label={difference >= 0 ? "Profit, before tax" : "Early encashment charge"} value={formatBdt(Math.abs(difference))} /> : null}
          </Card>
        </>
      ) : null}
      {mode === "prize" ? (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel="Prize" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PRIZE_NAMES.map((p, i) => (
              <Chip key={p} label={p} selected={prizeIndex === i} onPress={() => { setPrizeIndex(i); setAmount(taka(PRIZES[i]!)); }} />
            ))}
          </View>
          <Field label="Prize (৳)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={errors.prize} />
          {s.bondList.length ? (
            <Picker label="Winning bond" options={s.bondList.map((n) => ({ id: n, label: n }))} value={bond} onChange={(v) => setBond(v ?? "")} />
          ) : (
            <Field label="Winning bond (optional)" value={bond} onChangeText={setBond} placeholder="কখ 0412303" />
          )}
          <Field label="Tax at source (%)" value={tax} onChangeText={setTax} keyboardType="decimal-pad" error={errors.taxPoints} hint="Taken before the prize is paid." />
          <Card>
            <Fact label="Tax at source" value={a !== null && points !== null ? `−${formatBdt(taxOf(a, points))}` : "—"} />
            <Fact label="Into your account" value={a !== null && points !== null ? formatBdt(a - taxOf(a, points)) : "—"} />
          </Card>
        </>
      ) : null}
      {mode === "bonds" ? (
        <>
          <Field label="How many ৳100 bonds" value={amount} onChangeText={setAmount} keyboardType="number-pad" error={errors.bondCount} hint={count > 0 ? `${formatBdt(count * 10_000)} from your account.` : undefined} />
          <Field label="Bond numbers (optional, one a line)" value={numbers} onChangeText={setNumbers} multiline />
        </>
      ) : null}
      {mode === "sell" ? <Field label="How many" value={amount} onChangeText={setAmount} keyboardType="number-pad" error={errors.bondCount} hint={count > 0 ? `${formatBdt(count * 10_000)} back to your account.` : undefined} /> : null}
      {mode === "claim" || mode === "matured" ? (
        <>
          <Field label="Amount paid to you (৳)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={errors.amount} hint="Income under Insurance payouts." />
          {mode === "matured" ? <Body muted>This closes the policy.</Body> : null}
        </>
      ) : null}
      <Picker label={mode === "bonds" ? "Paid from" : "Into"} options={accounts} value={walletId} onChange={setWalletId} error={errors.walletId} />
      <DateTimeField label="When" value={when} onChange={setWhen} />
      {errors.saving || errors.form ? <ErrorText>{errors.saving ?? errors.form}</ErrorText> : null}
    </Screen>
  );
}
