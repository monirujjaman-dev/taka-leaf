import { formatBdt, parseTaka } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { deleteLoan, loans, personView, saveLoan, type LoanKind } from "../src/data/people";
import { ownWallets } from "../src/data/wallets";
import { db } from "../src/db/client";
import { getSetting } from "../src/db/store";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Button, ConfirmButton, DateTimeField, ErrorText, Field, Picker, Screen, Segmented } from "../src/ui/kit";

const TITLES: Record<LoanKind, string> = { Lend: "Lend", GotBack: "Got paid back", Borrow: "Borrow", PaidBack: "Pay back" };

export default function LoanForm() {
  const { changed } = useApp();
  const params = useLocalSearchParams<{ personId: string; id?: string; kind?: LoanKind }>();
  const person = useMemo(() => personView(db, params.personId), [params.personId]);
  const existing = useMemo(() => (params.id ? loans(db, params.personId).find((l) => l.id === params.id) : undefined), [params.id, params.personId]);
  const wallets = useData(() => ownWallets(db, { includeArchived: false }).map((w) => ({ id: w.id, label: w.name, detail: formatBdt(w.balance) })));
  const [kind, setKind] = useState<LoanKind>(existing?.kind ?? params.kind ?? "Lend");
  const [amount, setAmount] = useState(existing ? (existing.amount / 100).toString() : "");
  const [walletId, setWalletId] = useState<string | null>(existing?.walletId ?? getSetting(db, "form.lastWallet") ?? wallets[0]?.id ?? null);
  const [occurredAt, setOccurredAt] = useState(existing?.occurredAt ?? new Date().toISOString());
  const [note, setNote] = useState(existing?.note ?? "");
  const { errors, run, setErrors } = useErrors();
  const owed = kind === "GotBack" ? (person?.owesMe ?? 0) : kind === "PaidBack" ? (person?.iOwe ?? 0) : 0;

  function save() {
    const poisha = parseTaka(amount);
    if (!poisha) return setErrors({ amount: "Enter an amount above zero, like 1250 or 1250.50." });
    if (!walletId) return setErrors({ walletId: "Choose one of your own wallets, like Cash or bKash." });
    if (run(() => saveLoan(db, { id: existing?.id, personId: params.personId, kind, amount: poisha, walletId, occurredAt, note }))) {
      changed();
      router.back();
    }
  }

  return (
    <Screen title={`${TITLES[kind]}${person ? ` · ${person.name}` : ""}`} back footer={<Button label="Save" onPress={save} />}>
      <Segmented
        label="What happened"
        value={kind}
        onChange={setKind}
        options={[
          { value: "Lend", label: "Lend" },
          { value: "GotBack", label: "Got back" },
          { value: "Borrow", label: "Borrow" },
          { value: "PaidBack", label: "Pay back" },
        ]}
      />
      <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" error={errors.amount} hint={owed ? `${formatBdt(owed)} is owed now.` : undefined} />
      {owed > 0 && !existing ? <Button kind="secondary" label="All of it" onPress={() => setAmount((owed / 100).toString())} /> : null}
      <Picker label={kind === "Lend" || kind === "PaidBack" ? "Paid from" : "Received in"} options={wallets} value={walletId} onChange={setWalletId} error={errors.walletId} />
      <DateTimeField label="When" value={occurredAt} onChange={setOccurredAt} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} error={errors.note} />
      {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
      {existing ? (
        <ConfirmButton
          label="Delete"
          confirmLabel="Yes, delete"
          onConfirm={() => {
            deleteLoan(db, existing.id);
            changed();
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}
