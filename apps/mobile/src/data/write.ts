import { and, eq, isNull } from "drizzle-orm";
import { outbox, SYNCED_TABLES, type SyncedTableName } from "../db/schema";
import type { AppDb } from "../db/types";
import { newId } from "./ids";

export type RowOf<T extends SyncedTableName> = (typeof SYNCED_TABLES)[T]["$inferSelect"];

/**
 * Writes the whole row to SQLite and queues it for the server. Call it inside the action's
 * `db.transaction`, so the row and its outbox entry are saved together or not at all.
 */
export function put<T extends SyncedTableName>(db: AppDb, table: T, row: RowOf<T>, now: Date): RowOf<T> {
  const stamped = { ...row, updatedAt: now.toISOString() } as RowOf<T>;
  const target = SYNCED_TABLES[table];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.insert(target as any).values(stamped).onConflictDoUpdate({ target: target.id, set: stamped }).run();
  db.insert(outbox)
    .values({ mutationId: newId(now), tableName: table, rowId: row.id, payload: JSON.stringify(stamped), createdAt: now.toISOString() })
    .run();
  return stamped;
}

/** Marks the row deleted (rows are never removed) and queues the delete. */
export function remove<T extends SyncedTableName>(db: AppDb, table: T, row: RowOf<T>, now: Date): RowOf<T> {
  return put(db, table, { ...row, deletedAt: now.toISOString() }, now);
}

/** A live (not deleted) row by id. */
export function find<T extends SyncedTableName>(db: AppDb, table: T, id: string | null | undefined): RowOf<T> | undefined {
  if (!id) return undefined;
  const target = SYNCED_TABLES[table];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.select().from(target as any).where(and(eq(target.id, id), isNull(target.deletedAt))).get() as RowOf<T> | undefined) ?? undefined;
}

/** A mistake the person can fix, named after the field it belongs to (as the server's field errors). */
export class FieldError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

export const MAX_AMOUNT = 100_000_000_000_000;
export const NOTE_MAX = 500;
export const NAME_MAX = 80;

export function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
