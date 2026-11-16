import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { useArchiveCategory, useCategories, useDeleteCategory, useMergeCategory, useSaveCategory } from "../../api/queries";
import type { Category, CategoryKind } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { Button, focusRing } from "../../ui/Button";
import { ErrorNote, Loading, messageOf } from "../../ui/Feedback";
import { SelectField, TextField } from "../../ui/Field";
import { Modal } from "../../ui/Modal";

type Editing = { category: Category | null; kind: CategoryKind; parentId: string | null };

/**
 * Merge moves every transaction (and recurring rule) into another category of the same kind, then
 * removes this one; delete works only for a category nothing uses. Both need no sub-categories.
 */
function MergeOrDelete({ category, all, onDone }: { category: Category; all: Category[]; onDone: () => void }) {
  const merge = useMergeCategory();
  const remove = useDeleteCategory();
  const [into, setInto] = useState("");
  const [confirm, setConfirm] = useState<"merge" | "delete" | null>(null);

  if (category.children.length > 0) {
    return (
      <p className="m-0 text-[13px] text-[var(--tl-muted)]">
        To merge or delete {category.name}, first merge or delete its sub-categories.
      </p>
    );
  }

  const targets = all.flatMap((parent) => [
    { id: parent.id, label: parent.name },
    ...parent.children.map((child) => ({ id: child.id, label: `${parent.name} › ${child.name}` })),
  ]).filter((option) => option.id !== category.id);
  const error = messageOf(merge.error ?? remove.error);

  return (
    <section aria-label="Merge or delete" className="flex flex-col gap-3 border-t border-[var(--tl-glass-border)] pt-4">
      <SelectField
        label={`Merge ${category.name} into`}
        value={into}
        onChange={(e) => {
          setInto(e.target.value);
          setConfirm(null);
        }}
        hint="Its transactions move there, so totals stay the same. Then this category is removed."
      >
        <option value="">Choose a category</option>
        {targets.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-wrap gap-2">
        {confirm === "merge" ? (
          <Button disabled={merge.isPending} onClick={() => merge.mutateAsync({ id: category.id, intoCategoryId: into }).then(onDone, () => {})}>
            Yes, merge
          </Button>
        ) : (
          <Button variant="secondary" disabled={!into} onClick={() => setConfirm("merge")}>
            Merge
          </Button>
        )}
        {confirm === "delete" ? (
          <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutateAsync(category.id).then(onDone, () => {})}>
            Yes, delete
          </Button>
        ) : (
          <Button variant="ghost" className="text-expense dark:text-expense-dark" onClick={() => setConfirm("delete")}>
            Delete
          </Button>
        )}
      </div>
    </section>
  );
}

function CategoryForm({ editing, all, onClose }: { editing: Editing; all: Category[]; onClose: () => void }) {
  const save = useSaveCategory();
  const archive = useArchiveCategory();
  const [name, setName] = useState(editing.category?.name ?? "");
  const apiError = save.error instanceof ApiError ? save.error : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    await save
      .mutateAsync({ id: editing.category?.id ?? null, kind: editing.kind, name: name.trim(), parentId: editing.parentId })
      .then(onClose, () => {});
  }

  const category = editing.category;
  const title = category ? `Edit ${category.name}` : editing.parentId ? "Add a sub-category" : `Add an ${editing.kind.toLowerCase()} category`;

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} error={apiError?.field("name")} />
        <ErrorNote>{apiError && !apiError.field("name") ? apiError.message : messageOf(archive.error)}</ErrorNote>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {category ? (
            <Button
              variant="ghost"
              disabled={archive.isPending}
              onClick={() => archive.mutateAsync({ id: category.id, archived: !category.archived }).then(onClose, () => {})}
            >
              {category.archived ? "Bring back" : "Archive"}
            </Button>
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
        {category && !category.archived ? (
          <p className="m-0 text-[13px] text-[var(--tl-muted)]">Archiving hides it from new entries; past transactions keep it.</p>
        ) : null}
      </form>
      {category ? (
        <div className="mt-4">
          <MergeOrDelete category={category} all={all} onDone={onClose} />
        </div>
      ) : null}
    </Modal>
  );
}

const chip = `inline-flex h-11 cursor-pointer items-center rounded-full px-3.5 text-[13px] font-bold ${focusRing}`;

export function CategoriesPage() {
  const [kind, setKind] = useState<CategoryKind>("Expense");
  const categories = useCategories(kind, true);
  const [editing, setEditing] = useState<Editing | null>(null);

  return (
    <>
      <PageHeader title="Categories">
        <Button onClick={() => setEditing({ category: null, kind, parentId: null })}>Add a category</Button>
      </PageHeader>

      <div role="tablist" aria-label="Kind" className="mb-4 inline-flex gap-1 rounded-[16px] bg-[var(--tl-chip)] p-1">
        {(["Expense", "Income"] as const).map((option) => (
          <button
            key={option}
            role="tab"
            type="button"
            aria-selected={kind === option}
            onClick={() => setKind(option)}
            className={`h-10 cursor-pointer rounded-[12px] px-5 text-sm font-bold ${focusRing} ${
              kind === option ? "bg-[var(--tl-surface)] text-[var(--tl-primary)] shadow-sm" : "text-[var(--tl-muted)]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {categories.isPending ? <Loading /> : null}
      {categories.error ? <ErrorNote>{messageOf(categories.error)}</ErrorNote> : null}

      <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
        {(categories.data ?? []).map((parent) => (
          <li key={parent.id} className={`glass rounded-[20px] p-4 ${parent.archived ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setEditing({ category: parent, kind, parentId: null })}
                className={`cursor-pointer rounded-[8px] text-left text-base font-extrabold hover:underline ${focusRing}`}
              >
                {parent.name}
                {parent.archived ? <span className="ml-2 text-[12px] font-bold text-[var(--tl-muted)]">Archived</span> : null}
              </button>
              {!parent.archived ? (
                <button
                  type="button"
                  aria-label={`Add a sub-category to ${parent.name}`}
                  onClick={() => setEditing({ category: null, kind, parentId: parent.id })}
                  className={`${chip} text-[var(--tl-primary)] hover:bg-[var(--tl-chip)]`}
                >
                  + Sub-category
                </button>
              ) : null}
            </div>
            {parent.children.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {parent.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => setEditing({ category: child, kind, parentId: parent.id })}
                    className={`${chip} bg-[var(--tl-chip)] ${child.archived ? "line-through opacity-60" : ""}`}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {editing ? <CategoryForm editing={editing} all={categories.data ?? []} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
