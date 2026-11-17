import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { budgets, categories, recurringRules, transactions, type CategoryKind, type CategoryRow } from "../db/schema";
import type { AppDb } from "../db/types";
import { newId } from "./ids";
import { cleanText, FieldError, find, NAME_MAX, put, remove } from "./write";

export const FEES_CATEGORY = "Fees and charges";

export interface CategoryNode extends CategoryRow {
  children: CategoryRow[];
}

/** Two levels, in their order. Archived ones only when asked. */
export function categoryTree(db: AppDb, kind: CategoryKind, { includeArchived = false } = {}): CategoryNode[] {
  const rows = db
    .select()
    .from(categories)
    .where(and(isNull(categories.deletedAt), eq(categories.kind, kind), includeArchived ? undefined : eq(categories.archived, false)))
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();
  return rows.filter((c) => !c.parentId).map((parent) => ({ ...parent, children: rows.filter((c) => c.parentId === parent.id) }));
}

/** Every live category by id, for showing names (deleted ones included: old entries keep their names). */
export function categoryNames(db: AppDb): Map<string, CategoryRow> {
  return new Map(db.select().from(categories).all().map((c) => [c.id, c]));
}

/** "Daily bazaar" or, for a parent used directly, its own name. */
export function categoryLabel(names: Map<string, CategoryRow>, id: string | null): string | null {
  return id ? (names.get(id)?.name ?? null) : null;
}

export function feesCategoryId(db: AppDb): string | null {
  return (
    db
      .select({ id: categories.id })
      .from(categories)
      .where(and(isNull(categories.deletedAt), eq(categories.kind, "Expense"), isNull(categories.parentId), eq(categories.archived, false), eq(categories.name, FEES_CATEGORY)))
      .get()?.id ?? null
  );
}

export interface CategoryInput {
  id?: string;
  kind: CategoryKind;
  name: string;
  parentId: string | null;
}

export function saveCategory(db: AppDb, input: CategoryInput, now: Date = new Date()): string {
  const name = cleanText(input.name);
  if (!name || name.length > NAME_MAX) throw new FieldError("name", `Give the category a name of up to ${NAME_MAX} characters.`);
  const id = input.id ?? newId(now);
  if (input.parentId) {
    const parent = find(db, "categories", input.parentId);
    if (!parent || parent.parentId || parent.kind !== input.kind || parent.id === id) throw new FieldError("parentId", "Choose a main category of the same kind.");
    if (input.id && db.select({ id: categories.id }).from(categories).where(and(isNull(categories.deletedAt), eq(categories.parentId, input.id))).get()) {
      throw new FieldError("parentId", "This category has sub-categories, so it can't go inside another.");
    }
  }
  const taken = db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        isNull(categories.deletedAt),
        ne(categories.id, id),
        eq(categories.kind, input.kind),
        input.parentId ? eq(categories.parentId, input.parentId) : isNull(categories.parentId),
        sql`lower(${categories.name}) = ${name.toLowerCase()}`,
      ),
    )
    .get();
  if (taken) throw new FieldError("name", "A category with this name is already there.");

  db.transaction((tx) => {
    const existing = find(tx, "categories", input.id);
    const sortOrder = existing?.sortOrder ?? Number(tx.select({ n: sql<number>`coalesce(max(${categories.sortOrder}), -1) + 1` }).from(categories).get()?.n ?? 0);
    put(tx, "categories", {
      id,
      kind: existing?.kind ?? input.kind,
      name,
      parentId: input.parentId,
      icon: existing?.icon ?? null,
      color: existing?.color ?? null,
      archived: existing?.archived ?? false,
      sortOrder,
      updatedAt: "",
      deletedAt: null,
    }, now);
  });
  return id;
}

export function setCategoryArchived(db: AppDb, id: string, archived: boolean, now: Date = new Date()): void {
  db.transaction((tx) => {
    const category = find(tx, "categories", id);
    if (category) put(tx, "categories", { ...category, archived }, now);
  });
}

function hasChildren(db: AppDb, id: string): boolean {
  return Boolean(db.select({ id: categories.id }).from(categories).where(and(isNull(categories.deletedAt), eq(categories.parentId, id))).get());
}

export function deleteCategory(db: AppDb, id: string, now: Date = new Date()): void {
  if (hasChildren(db, id)) throw new FieldError("category", "This category has sub-categories. Delete or move them first.");
  if (db.select({ id: transactions.id }).from(transactions).where(and(isNull(transactions.deletedAt), eq(transactions.categoryId, id))).get()) {
    throw new FieldError("category", "Transactions use this category. Archive it, or merge it into another.");
  }
  if (db.select({ id: recurringRules.id }).from(recurringRules).where(and(isNull(recurringRules.deletedAt), eq(recurringRules.categoryId, id))).get()) {
    throw new FieldError("category", "A recurring transaction uses this category. Change or delete it first.");
  }
  db.transaction((tx) => {
    const budget = tx.select().from(budgets).where(and(isNull(budgets.deletedAt), eq(budgets.categoryId, id))).get();
    if (budget) remove(tx, "budgets", budget, now);
    const category = find(tx, "categories", id);
    if (category) remove(tx, "categories", category, now);
  });
}

/** Moves everything from one category into another of the same kind, then deletes the first (as the server's merge). */
export function mergeCategory(db: AppDb, sourceId: string, targetId: string, now: Date = new Date()): number {
  const source = find(db, "categories", sourceId);
  const target = find(db, "categories", targetId);
  if (!source || !target || source.id === target.id) throw new FieldError("intoCategoryId", "Choose another category to merge into.");
  if (source.kind !== target.kind) throw new FieldError("intoCategoryId", "Merge into a category of the same kind.");
  if (hasChildren(db, source.id)) throw new FieldError("intoCategoryId", "This category has sub-categories. Merge or move them first.");
  let moved = 0;
  db.transaction((tx) => {
    for (const t of tx.select().from(transactions).where(and(isNull(transactions.deletedAt), eq(transactions.categoryId, source.id))).all()) {
      put(tx, "transactions", { ...t, categoryId: target.id }, now);
      moved++;
    }
    for (const r of tx.select().from(recurringRules).where(and(isNull(recurringRules.deletedAt), eq(recurringRules.categoryId, source.id))).all()) {
      put(tx, "recurringRules", { ...r, categoryId: target.id }, now);
    }
    const budget = tx.select().from(budgets).where(and(isNull(budgets.deletedAt), eq(budgets.categoryId, source.id))).get();
    if (budget) {
      const targetHasOne = tx.select({ id: budgets.id }).from(budgets).where(and(isNull(budgets.deletedAt), eq(budgets.categoryId, target.id))).get();
      if (targetHasOne) remove(tx, "budgets", budget, now);
      else put(tx, "budgets", { ...budget, categoryId: target.id }, now);
    }
    remove(tx, "categories", source, now);
  });
  return moved;
}
