import { formatBdt, parseTaka } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { deleteWallet, setWalletArchived, saveWallet, walletInUse } from "../src/data/wallets";
import { find } from "../src/data/write";
import type { WalletType } from "../src/db/schema";
import { db } from "../src/db/client";
import { useApp } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Body, Button, Chip, ConfirmButton, ErrorText, Field, Screen, Segmented, SwitchRow } from "../src/ui/kit";

const MFS = ["bKash", "Nagad", "Rocket", "Upay"];
const typed = (poisha: number) => (poisha / 100).toFixed(2).replace(/\.00$/, "");

export default function WalletForm() {
  const { changed } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => find(db, "wallets", id), [id]);
  const [type, setType] = useState<WalletType>(existing?.type ?? "Cash");
  const [name, setName] = useState(existing?.name ?? "");
  const card = type === "CreditCard";
  // Credit card debt is typed as a positive "amount owed".
  const [opening, setOpening] = useState(existing ? typed(card ? -existing.openingBalance : existing.openingBalance) : "");
  const [limit, setLimit] = useState(existing?.creditLimit ? typed(existing.creditLimit) : "");
  const [excluded, setExcluded] = useState(existing?.excludedFromTotal ?? false);
  const { errors, run, setErrors } = useErrors();
  const inUse = useMemo(() => (existing ? walletInUse(db, existing.id) : false), [existing]);

  if (existing && (existing.type === "Lent" || existing.type === "Borrowed")) {
    return (
      <Screen title={existing.name} back>
        <Body>Loan wallets change from People.</Body>
        <Button label="Open People" onPress={() => router.replace({ pathname: "/person", params: { id: existing.personId ?? "" } })} />
      </Screen>
    );
  }

  function save() {
    const amount = opening.trim() === "" ? 0 : parseTaka(opening.replace(/^[-−]/, ""));
    if (amount === null) return setErrors({ openingBalance: "Enter the balance, like 1250 or 1250.50." });
    const negative = /^[-−]/.test(opening.trim());
    const creditLimit = card && limit.trim() ? parseTaka(limit) : null;
    if (card && limit.trim() && creditLimit === null) return setErrors({ creditLimit: "Enter the limit, like 50000." });
    const ok = run(() =>
      saveWallet(db, { id: existing?.id, type, name, openingBalance: card ? -amount : negative ? -amount : amount, creditLimit, excludedFromTotal: excluded }),
    );
    if (ok) {
      changed();
      router.back();
    }
  }

  return (
    <Screen title={existing ? "Edit wallet" : "Add a wallet"} back footer={<Button label="Save wallet" onPress={save} />}>
      {!existing ? (
        <Segmented
          label="Type"
          value={type}
          onChange={setType}
          options={[
            { value: "Cash", label: "Cash" },
            { value: "Bank", label: "Bank" },
            { value: "Mfs", label: "Mobile" },
            { value: "CreditCard", label: "Card" },
          ]}
        />
      ) : null}
      <Field label="Name" value={name} onChangeText={setName} error={errors.name} />
      {type === "Mfs" && !existing ? (
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {MFS.map((m) => (
            <Chip key={m} label={m} selected={name === m} onPress={() => setName(m)} />
          ))}
        </ScrollView>
      ) : null}
      <Field
        label={card ? "Amount owed now" : "Balance now"}
        value={opening}
        onChangeText={setOpening}
        keyboardType="numbers-and-punctuation"
        placeholder="0"
        error={errors.openingBalance}
        hint={existing ? "The starting balance; transactions are added to it." : card ? "What you owe on the card today." : "What is in it today."}
      />
      {card ? <Field label="Credit limit" value={limit} onChangeText={setLimit} keyboardType="decimal-pad" error={errors.creditLimit} /> : null}
      <SwitchRow label="Leave out of net balance" detail="For savings you don't spend from, for example." value={excluded} onChange={setExcluded} />
      {errors.form || errors.wallet ? <ErrorText>{errors.form ?? errors.wallet}</ErrorText> : null}
      {existing ? (
        <>
          <Button kind="secondary" label="See its transactions" onPress={() => router.push({ pathname: "/history", params: { walletId: existing.id } })} />
          <Button
            kind="secondary"
            label={existing.archived ? "Unarchive" : "Archive"}
            onPress={() => {
              setWalletArchived(db, existing.id, !existing.archived);
              changed();
              router.back();
            }}
          />
          {inUse ? (
            <Body muted>This wallet has transactions, so it can be archived but not deleted.</Body>
          ) : (
            <ConfirmButton
              label="Delete wallet"
              confirmLabel="Yes, delete"
              onConfirm={() => {
                if (run(() => deleteWallet(db, existing.id))) {
                  changed();
                  router.back();
                }
              }}
            />
          )}
          {existing.creditLimit ? <Body muted>Limit {formatBdt(existing.creditLimit)}</Body> : null}
        </>
      ) : null}
    </Screen>
  );
}
