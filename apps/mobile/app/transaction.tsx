import { formatBdt, parseTaka } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { categoryTree } from "../src/data/categories";
import { deleteTransaction, feeOf, saveTransaction } from "../src/data/transactions";
import { ownWallets } from "../src/data/wallets";
import { find } from "../src/data/write";
import type { TransactionType } from "../src/db/schema";
import { db } from "../src/db/client";
import { getSetting, setSetting } from "../src/db/store";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Button, Chip, ConfirmButton, DateTimeField, ErrorText, Field, groupTyped, Notice, NumberPad, Picker, Screen, Segmented } from "../src/ui/kit";
import { useColors } from "../src/ui/theme";

const LAST_WALLET = "form.lastWallet";
const typed = (poisha: number | null | undefined) => (poisha ? (poisha / 100).toFixed(2).replace(/\.00$/, "") : "");

/** Add or change an income, expense or transfer. Opens on Expense with now as the time. */
export default function TransactionForm() {
  const c = useColors();
  const { changed } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => find(db, "transactions", id), [id]);
  const existingFee = useMemo(() => (existing ? feeOf(db, existing.id) : undefined), [existing]);
  const wallets = useData(() => ownWallets(db, { includeArchived: false }));
  const last = getSetting(db, LAST_WALLET);
  const defaultWallet = wallets.find((w) => w.id === last)?.id ?? wallets[0]?.id ?? null;

  const [type, setType] = useState<TransactionType>(existing?.type ?? "Expense");
  const [amount, setAmount] = useState(typed(existing?.amount));
  const [from, setFrom] = useState<string | null>(existing?.fromWalletId ?? defaultWallet);
  const [to, setTo] = useState<string | null>(existing?.toWalletId ?? (existing ? null : type === "Income" ? defaultWallet : null));
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [occurredAt, setOccurredAt] = useState(existing?.occurredAt ?? new Date().toISOString());
  const [note, setNote] = useState(existing?.note ?? "");
  const [fee, setFee] = useState(typed(existingFee?.amount));
  const [moreCategories, setMoreCategories] = useState(false);
  const { errors, run, setErrors } = useErrors();

  const tree = useData(() => (type === "Transfer" ? [] : categoryTree(db, type)), [type]);
  const options = tree.flatMap((p) => [{ id: p.id, label: p.name, group: p.name }, ...p.children.map((ch) => ({ id: ch.id, label: ch.name, group: p.name }))]);
  const quick = tree.slice(0, 8);
  const walletOptions = wallets.map((w) => ({ id: w.id, label: w.name, detail: formatBdt(w.balance) }));

  if (existing && (existing.feeOfId || existing.personId)) {
    return (
      <Screen title="Transaction" back>
        <Notice>{existing.feeOfId ? "This is a transfer fee. Change it on its transfer." : "Loans and repayments are changed from People."}</Notice>
      </Screen>
    );
  }

  function changeType(next: TransactionType) {
    setType(next);
    setCategoryId(null);
    if (next === "Income") {
      setTo(to ?? from ?? defaultWallet);
    } else if (next === "Expense") {
      setFrom(from ?? to ?? defaultWallet);
    }
  }

  function save() {
    const poisha = parseTaka(amount);
    if (!poisha) return setErrors({ amount: "Enter an amount above zero, like 1250 or 1250.50." });
    const feePoisha = fee ? parseTaka(fee) : 0;
    if (feePoisha === null) return setErrors({ fee: "Enter the fee in taka, like 18.50." });
    const ok = run(() =>
      saveTransaction(db, {
        id: existing?.id,
        type,
        amount: poisha,
        fromWalletId: type === "Income" ? null : from,
        toWalletId: type === "Expense" ? null : to,
        categoryId: type === "Transfer" ? null : categoryId,
        occurredAt,
        note,
        fee: type === "Transfer" ? feePoisha : 0,
      }),
    );
    if (!ok) return;
    const used = type === "Income" ? to : from;
    if (used) setSetting(db, LAST_WALLET, used);
    changed();
    router.back();
  }

  if (wallets.length === 0) {
    return (
      <Screen title="Add transaction" back>
        <Notice>Add a wallet first: where the money is, like Cash or bKash.</Notice>
        <Button label="Add a wallet" onPress={() => router.replace("/wallet")} />
      </Screen>
    );
  }

  const label = { Expense: "expense", Income: "income", Transfer: "transfer" }[type];
  return (
    <Screen title={existing ? `Edit ${label}` : "Add transaction"} back footer={<Button label={`Save ${label}`} onPress={save} />}>
      <Segmented
        label="Type"
        value={type}
        onChange={changeType}
        options={[
          { value: "Expense", label: "Expense" },
          { value: "Income", label: "Income" },
          { value: "Transfer", label: "Transfer" },
        ]}
      />
      <View style={{ alignItems: "center", gap: 6 }} accessibilityLabel={`Amount ${amount || "0"} taka`} accessibilityLiveRegion="polite">
        <Text style={{ color: type === "Income" ? c.income : type === "Expense" ? c.expense : c.text, fontSize: 40, fontWeight: "800", fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit>
          ৳{groupTyped(amount)}
        </Text>
        <TextInput
          accessibilityLabel="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Add a note"
          placeholderTextColor={c.muted}
          style={{ color: c.text, fontSize: 15, minHeight: 48, textAlign: "center", minWidth: 200 }}
        />
        {errors.amount ? <ErrorText>{errors.amount}</ErrorText> : null}
        {errors.note ? <ErrorText>{errors.note}</ErrorText> : null}
      </View>
      <NumberPad value={amount} onChange={setAmount} />

      {type !== "Transfer" ? (
        <View style={{ gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Category">
            {quick.map((cat) => (
              <Chip key={cat.id} label={cat.name} selected={categoryId === cat.id || cat.children.some((ch) => ch.id === categoryId)} onPress={() => setCategoryId(categoryId === cat.id ? null : cat.id)} />
            ))}
            <Chip label="More…" selected={moreCategories} onPress={() => setMoreCategories(!moreCategories)} />
          </ScrollView>
          {moreCategories || (categoryId && !quick.some((q) => q.id === categoryId)) ? (
            <Picker label="Category" options={options} value={categoryId} onChange={setCategoryId} allowNone="No category" error={errors.categoryId} />
          ) : errors.categoryId ? (
            <ErrorText>{errors.categoryId}</ErrorText>
          ) : null}
        </View>
      ) : null}

      {type !== "Income" ? <Picker label={type === "Transfer" ? "From" : "Paid from"} options={walletOptions} value={from} onChange={setFrom} error={errors.fromWalletId} /> : null}
      {type !== "Expense" ? <Picker label={type === "Transfer" ? "To" : "Received in"} options={walletOptions} value={to} onChange={setTo} error={errors.toWalletId} /> : null}
      {type === "Transfer" ? <Field label="Fee (optional)" value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="0" error={errors.fee} hint="Like a bKash cash-out charge. Counted under Fees and charges." /> : null}
      <DateTimeField label="When" value={occurredAt} onChange={setOccurredAt} />
      {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
      {existing ? (
        <ConfirmButton
          label="Delete"
          confirmLabel="Yes, delete"
          onConfirm={() => {
            deleteTransaction(db, existing.id);
            changed();
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}
