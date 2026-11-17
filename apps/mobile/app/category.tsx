import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { categoryTree, deleteCategory, mergeCategory, saveCategory, setCategoryArchived } from "../src/data/categories";
import { find } from "../src/data/write";
import type { CategoryKind } from "../src/db/schema";
import { db } from "../src/db/client";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Body, Button, Card, ConfirmButton, ErrorText, Field, Picker, Screen } from "../src/ui/kit";

export default function CategoryForm() {
  const { changed } = useApp();
  const params = useLocalSearchParams<{ id?: string; kind?: CategoryKind; parentId?: string }>();
  const existing = useMemo(() => find(db, "categories", params.id), [params.id]);
  const kind: CategoryKind = existing?.kind ?? params.kind ?? "Expense";
  const [name, setName] = useState(existing?.name ?? "");
  const [parentId, setParentId] = useState<string | null>(existing ? existing.parentId : (params.parentId ?? null));
  const [into, setInto] = useState<string | null>(null);
  const { errors, run } = useErrors();
  const tree = useData(() => categoryTree(db, kind), [kind]);
  const parents = tree.filter((p) => p.id !== existing?.id).map((p) => ({ id: p.id, label: p.name }));
  const targets = tree.flatMap((p) => [{ id: p.id, label: p.name, group: p.name }, ...p.children.map((ch) => ({ id: ch.id, label: ch.name, group: p.name }))]).filter((o) => o.id !== existing?.id);
  const done = () => (changed(), router.back());

  return (
    <Screen
      title={existing ? "Edit category" : parentId ? "Add a sub-category" : `Add ${kind.toLowerCase()} category`}
      back
      footer={<Button label="Save category" onPress={() => run(() => saveCategory(db, { id: existing?.id, kind, name, parentId })) && done()} />}
    >
      <Field label="Name" value={name} onChangeText={setName} error={errors.name} />
      <Picker label="Inside" options={parents} value={parentId} onChange={setParentId} allowNone="Nothing (a main category)" placeholder="Nothing (a main category)" error={errors.parentId} />
      {errors.form || errors.category ? <ErrorText>{errors.form ?? errors.category}</ErrorText> : null}
      {existing ? (
        <>
          <Button kind="secondary" label={existing.archived ? "Unarchive" : "Archive"} onPress={() => (setCategoryArchived(db, existing.id, !existing.archived), done())} />
          <Card title="Merge into another">
            <Body muted>Its transactions, recurring entries and budget move to the category you choose, and this one goes.</Body>
            <Picker label="Merge into" options={targets} value={into} onChange={setInto} error={errors.intoCategoryId} />
            {into ? <ConfirmButton label="Merge" confirmLabel="Yes, merge" onConfirm={() => run(() => mergeCategory(db, existing.id, into)) && done()} /> : null}
          </Card>
          <ConfirmButton label="Delete category" confirmLabel="Yes, delete" onConfirm={() => run(() => deleteCategory(db, existing.id)) && done()} />
        </>
      ) : null}
    </Screen>
  );
}
