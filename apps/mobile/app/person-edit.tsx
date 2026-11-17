import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { deletePerson, savePerson } from "../src/data/people";
import { find } from "../src/data/write";
import { db } from "../src/db/client";
import { useApp } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Button, ConfirmButton, ErrorText, Field, Screen } from "../src/ui/kit";

export default function PersonForm() {
  const { changed } = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => find(db, "people", id), [id]);
  const [name, setName] = useState(existing?.name ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const { errors, run } = useErrors();

  function save() {
    let saved = "";
    if (run(() => (saved = savePerson(db, { id: existing?.id, name, note })))) {
      changed();
      if (existing) router.back();
      else router.replace({ pathname: "/person", params: { id: saved } });
    }
  }

  return (
    <Screen title={existing ? "Edit person" : "Add a person"} back footer={<Button label="Save" onPress={save} />}>
      <Field label="Name" value={name} onChangeText={setName} autoComplete="name" error={errors.name} />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Office, cousin…" error={errors.note} />
      {errors.form || errors.person ? <ErrorText>{errors.form ?? errors.person}</ErrorText> : null}
      {existing ? (
        <ConfirmButton
          label="Delete person"
          confirmLabel="Yes, delete"
          onConfirm={() => {
            if (run(() => deletePerson(db, existing.id))) {
              changed();
              router.dismissTo("/people");
            }
          }}
        />
      ) : null}
    </Screen>
  );
}
