import { parseTaka } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { deleteBudget, saveBudget } from "../src/data/budgets";
import { categoryTree } from "../src/data/categories";
import { find } from "../src/data/write";
import { db } from "../src/db/client";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Body, Button, ConfirmButton, ErrorText, Field, Picker, Screen } from "../src/ui/kit";

export default function BudgetForm() {
  const { changed } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => find(db, "budgets", id), [id]);
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [amount, setAmount] = useState(existing ? (existing.amount / 100).toString() : "");
  const { errors, run, setErrors } = useErrors();
  const options = useData(() => categoryTree(db, "Expense").flatMap((p) => [{ id: p.id, label: p.name, group: p.name }, ...p.children.map((ch) => ({ id: ch.id, label: ch.name, group: p.name }))]));

  function save() {
    const poisha = parseTaka(amount);
    if (!poisha) return setErrors({ amount: "Enter a monthly amount above zero." });
    if (run(() => saveBudget(db, { id: existing?.id, categoryId, amount: poisha }))) {
      changed();
      router.back();
    }
  }

  return (
    <Screen title={existing ? "Edit budget" : "Add a budget"} back footer={<Button label="Save budget" onPress={save} />}>
      <Picker label="For" options={options} value={categoryId} onChange={setCategoryId} allowNone="All spending" placeholder="All spending" error={errors.categoryId} />
      <Body muted>A main category's budget covers its sub-categories too. The same limit applies every month.</Body>
      <Field label="Monthly limit" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" error={errors.amount} />
      {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
      {existing ? (
        <ConfirmButton
          label="Delete budget"
          confirmLabel="Yes, delete"
          onConfirm={() => {
            deleteBudget(db, existing.id);
            changed();
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}
