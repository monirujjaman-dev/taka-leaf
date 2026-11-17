import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "../../api/client";
import { useDeletePerson, useSavePerson } from "../../api/queries";
import type { Person } from "../../api/types";
import { Button } from "../../ui/Button";
import { ErrorNote, messageOf } from "../../ui/Feedback";
import { TextField } from "../../ui/Field";
import { Modal } from "../../ui/Modal";

export function PersonForm({ person, onClose, onCreated }: { person: Person | null; onClose: () => void; onCreated?: (person: Person) => void }) {
  const save = useSavePerson();
  const remove = useDeletePerson();
  const navigate = useNavigate();
  const [name, setName] = useState(person?.name ?? "");
  const [note, setNote] = useState(person?.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const apiError = save.error instanceof ApiError ? save.error : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    await save.mutateAsync({ id: person?.id ?? null, name: name.trim(), note: note.trim() || null }).then((saved) => {
      onClose();
      if (!person) onCreated?.(saved);
    }, () => {});
  }

  return (
    <Modal title={person ? `Edit ${person.name}` : "Add a person"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} error={apiError?.field("name")} />
        <TextField
          label="Note (optional)"
          value={note}
          maxLength={500}
          placeholder="Phone number, how you know them…"
          onChange={(e) => setNote(e.target.value)}
          error={apiError?.field("note")}
        />
        <ErrorNote>{apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : messageOf(remove.error)}</ErrorNote>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {person ? (
            confirmDelete ? (
              <Button
                variant="danger"
                disabled={remove.isPending}
                onClick={() => remove.mutateAsync(person.id).then(() => navigate("/people", { replace: true }), () => {})}
              >
                Yes, delete
              </Button>
            ) : (
              <Button variant="ghost" className="text-expense dark:text-expense-dark" onClick={() => setConfirmDelete(true)}>
                Delete person
              </Button>
            )
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !name.trim()}>
              Save
            </Button>
          </span>
        </div>
        {person && confirmDelete ? (
          <p className="m-0 text-[13px] text-[var(--tl-muted)]">
            This works only while no loans are recorded with {person.name}, so no history is lost.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
