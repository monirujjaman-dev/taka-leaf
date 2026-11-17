import { formatBdt, parseTaka } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { today } from "../src/data/calendar";
import { categoryTree } from "../src/data/categories";
import { deleteRule, saveRule, setRulePaused } from "../src/data/recurring";
import { ownWallets } from "../src/data/wallets";
import { find } from "../src/data/write";
import type { Frequency, TransactionType } from "../src/db/schema";
import { db } from "../src/db/client";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Button, ConfirmButton, DateField, ErrorText, Field, Picker, Screen, Segmented, SwitchRow } from "../src/ui/kit";

export default function RuleForm() {
  const { changed } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => find(db, "recurringRules", id), [id]);
  const wallets = useData(() => ownWallets(db, { includeArchived: false }).map((w) => ({ id: w.id, label: w.name, detail: formatBdt(w.balance) })));
  const [type, setType] = useState<TransactionType>(existing?.type ?? "Expense");
  const [amount, setAmount] = useState(existing ? (existing.amount / 100).toString() : "");
  const [from, setFrom] = useState<string | null>(existing?.fromWalletId ?? wallets[0]?.id ?? null);
  const [to, setTo] = useState<string | null>(existing?.toWalletId ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? "Monthly");
  const [interval, setInterval] = useState(String(existing?.interval ?? 1));
  const [startDate, setStartDate] = useState<string | null>(existing?.startDate ?? today());
  const [endDate, setEndDate] = useState<string | null>(existing?.endDate ?? null);
  const [autoRecord, setAutoRecord] = useState(existing?.autoRecord ?? false);
  const { errors, run, setErrors } = useErrors();
  const categories = useData(
    () => (type === "Transfer" ? [] : categoryTree(db, type).flatMap((p) => [{ id: p.id, label: p.name, group: p.name }, ...p.children.map((ch) => ({ id: ch.id, label: ch.name, group: p.name }))])),
    [type],
  );
  const done = () => (changed(), router.back());

  function save() {
    const poisha = parseTaka(amount);
    if (!poisha) return setErrors({ amount: "Enter an amount above zero, like 1250 or 1250.50." });
    if (!startDate) return setErrors({ startDate: "Choose the first date." });
    if (run(() => saveRule(db, { id: existing?.id, type, amount: poisha, fromWalletId: from, toWalletId: to, categoryId, note, frequency, interval: Number(interval), startDate, endDate, autoRecord }))) done();
  }

  return (
    <Screen title={existing ? "Edit recurring" : "Add recurring"} back footer={<Button label="Save" onPress={save} />}>
      <Segmented label="Type" value={type} onChange={(t) => (setType(t), setCategoryId(null))} options={[{ value: "Expense", label: "Expense" }, { value: "Income", label: "Income" }, { value: "Transfer", label: "Transfer" }]} />
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" error={errors.amount} hint="The usual amount; you can change it when recording." />
      <Field label="Name" value={note} onChangeText={setNote} placeholder="House rent, salary…" error={errors.note} />
      {type !== "Income" ? <Picker label={type === "Transfer" ? "From" : "Paid from"} options={wallets} value={from} onChange={setFrom} error={errors.fromWalletId} /> : null}
      {type !== "Expense" ? <Picker label={type === "Transfer" ? "To" : "Received in"} options={wallets} value={to} onChange={setTo} error={errors.toWalletId} /> : null}
      {type !== "Transfer" ? <Picker label="Category" options={categories} value={categoryId} onChange={setCategoryId} allowNone="No category" error={errors.categoryId} /> : null}
      <Segmented label="Repeats" value={frequency} onChange={setFrequency} options={[{ value: "Daily", label: "Day" }, { value: "Weekly", label: "Week" }, { value: "Monthly", label: "Month" }, { value: "Yearly", label: "Year" }]} />
      <Field label="Every" value={interval} onChangeText={setInterval} keyboardType="number-pad" error={errors.interval} hint={`Every ${interval || "1"} ${frequency === "Daily" ? "day" : frequency === "Weekly" ? "week" : frequency === "Monthly" ? "month" : "year"}(s)`} />
      <DateField label="First date" value={startDate} onChange={setStartDate} />
      {errors.startDate ? <ErrorText>{errors.startDate}</ErrorText> : null}
      <DateField label="Last date" value={endDate} onChange={setEndDate} optional="No end" />
      {errors.endDate ? <ErrorText>{errors.endDate}</ErrorText> : null}
      <SwitchRow label="Record automatically" detail="Your server records it on the date. Off: it waits for you to record or skip." value={autoRecord} onChange={setAutoRecord} />
      {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
      {existing ? (
        <>
          <Button kind="secondary" label={existing.paused ? "Resume" : "Pause"} onPress={() => (setRulePaused(db, existing.id, !existing.paused), done())} />
          <ConfirmButton label="Delete" confirmLabel="Yes, delete" onConfirm={() => (deleteRule(db, existing.id), done())} />
        </>
      ) : null}
    </Screen>
  );
}
