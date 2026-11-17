import { and, asc, eq, getTableColumns, inArray } from "drizzle-orm";
import { outbox, settings, SYNCED_TABLES, syncRejects, type SyncedTableName } from "../db/schema";
import type { AppDb } from "../db/types";
import { getSetting, setSetting } from "../db/store";

/** The sync version this app speaks (SyncRules.Protocol on the server). */
export const PROTOCOL = 1;
export const BATCH = 200;
export const CURSOR_KEY = "sync.cursor";
export const LAST_SYNCED_KEY = "sync.lastSyncedAt";

export interface PushChange {
  mutationId: string;
  table: SyncedTableName;
  row: Record<string, unknown>;
}

export interface PushResult {
  mutationId: string;
  status: "accepted" | "superseded" | "rejected";
  reason: string | null;
  current: Record<string, unknown> | null;
}

/** A table missing from a page (an older server without loans, say) simply has no changes. */
export type PullPage = { cursor: number; hasMore: boolean } & Partial<Record<SyncedTableName, Record<string, unknown>[]>>;

export interface SyncApi {
  push(changes: PushChange[]): Promise<PushResult[]>;
  pull(cursor: number): Promise<PullPage>;
}

export interface SyncReport {
  pushed: number;
  rejected: number;
  pulled: number;
  at: string;
}

const TABLE_NAMES = Object.keys(SYNCED_TABLES) as SyncedTableName[];
const TIME_FIELDS = ["updatedAt", "deletedAt", "occurredAt"];

/** A server row in the phone's form: only known columns, times as "…Z" ISO strings so they sort as text. */
export function fromServer(table: SyncedTableName, row: Record<string, unknown>): Record<string, unknown> {
  const columns = Object.keys(getTableColumns(SYNCED_TABLES[table]));
  const result: Record<string, unknown> = {};
  for (const column of columns) {
    let value = row[column] ?? null;
    if (value !== null && TIME_FIELDS.includes(column)) value = new Date(String(value)).toISOString();
    result[column] = value;
  }
  return result;
}

function hasPending(db: AppDb, table: string, rowId: string): boolean {
  return Boolean(db.select({ id: outbox.id }).from(outbox).where(and(eq(outbox.tableName, table), eq(outbox.rowId, rowId))).get());
}

/** Stores the server's row, unless the phone has newer changes to it still waiting to be pushed. */
function storeServerRow(db: AppDb, table: SyncedTableName, row: Record<string, unknown>) {
  const target = SYNCED_TABLES[table];
  const values = fromServer(table, row);
  if (hasPending(db, table, String(values.id))) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db.insert(target as any).values(values).onConflictDoUpdate({ target: target.id, set: values }).run();
}

/** Applies one push answer: drop the entries, note rejections, and store what the server now has. */
export function applyPushResults(db: AppDb, sent: PushChange[], results: PushResult[], now: Date = new Date()): { rejected: number } {
  let rejected = 0;
  db.transaction((tx) => {
    const byId = new Map(sent.map((c) => [c.mutationId, c]));
    for (const result of results) {
      const change = byId.get(result.mutationId);
      if (!change) continue;
      tx.delete(outbox).where(eq(outbox.mutationId, result.mutationId)).run();
      if (result.status === "rejected") {
        rejected++;
        tx.insert(syncRejects)
          .values({ tableName: change.table, rowId: String(change.row.id), reason: result.reason ?? "The server did not accept this change.", payload: JSON.stringify(change.row), createdAt: now.toISOString() })
          .run();
      }
      if (hasPending(tx, change.table, String(change.row.id))) continue;
      if (result.current) storeServerRow(tx, change.table, result.current);
      else if (result.status !== "accepted" || change.row.deletedAt) {
        // The server has no such row: a refused new row, or a date it had already recorded.
        const target = SYNCED_TABLES[change.table];
        tx.delete(target).where(eq(target.id, String(change.row.id))).run();
      }
    }
  });
  return { rejected };
}

/** Sends the outbox, oldest first, in batches. */
export async function pushAll(db: AppDb, api: SyncApi, now: Date = new Date()): Promise<{ pushed: number; rejected: number }> {
  let pushed = 0;
  let rejected = 0;
  for (;;) {
    const entries = db.select().from(outbox).orderBy(asc(outbox.id)).limit(BATCH).all();
    if (entries.length === 0) break;
    const changes: PushChange[] = entries.map((e) => ({ mutationId: e.mutationId, table: e.tableName as SyncedTableName, row: JSON.parse(e.payload) }));
    db.update(outbox).set({ attempts: entries[0]!.attempts + 1 }).where(inArray(outbox.id, entries.map((e) => e.id))).run();
    const results = await api.push(changes);
    rejected += applyPushResults(db, changes, results, now).rejected;
    pushed += results.length;
    if (results.length === 0) break;
  }
  return { pushed, rejected };
}

/** Pulls every change after the saved cursor. Each page and its cursor are saved together (S-8). */
export async function pullAll(db: AppDb, api: SyncApi): Promise<number> {
  let pulled = 0;
  for (;;) {
    const cursor = Number(getSetting(db, CURSOR_KEY) ?? "0");
    const page = await api.pull(cursor);
    db.transaction((tx) => {
      for (const table of TABLE_NAMES) {
        for (const row of page[table] ?? []) {
          storeServerRow(tx, table, row);
          pulled++;
        }
      }
      setSetting(tx, CURSOR_KEY, String(page.cursor));
    });
    if (!page.hasMore) break;
  }
  return pulled;
}

/** Push, then pull: the phone's changes first, so the pull brings back the server's answer to them. */
export async function syncNow(db: AppDb, api: SyncApi, now: Date = new Date()): Promise<SyncReport> {
  const { pushed, rejected } = await pushAll(db, api, now);
  const pulled = await pullAll(db, api);
  const at = new Date().toISOString();
  setSetting(db, LAST_SYNCED_KEY, at);
  return { pushed, rejected, pulled, at };
}

export function pendingCount(db: AppDb): number {
  return db.select({ id: outbox.id }).from(outbox).all().length;
}

export function rejectedChanges(db: AppDb) {
  return db.select().from(syncRejects).orderBy(asc(syncRejects.id)).all();
}

export function clearRejected(db: AppDb): void {
  db.delete(syncRejects).run();
}

/** Signing out of a different account: forget the local copy (only when nothing is waiting). */
export function forgetLocalData(db: AppDb): void {
  db.transaction((tx) => {
    for (const table of TABLE_NAMES) tx.delete(SYNCED_TABLES[table]).run();
    tx.delete(outbox).run();
    tx.delete(syncRejects).run();
    tx.delete(settings).where(inArray(settings.key, [CURSOR_KEY, LAST_SYNCED_KEY])).run();
  });
}

/** The HTTP side, over an authorised API client. */
export function httpSyncApi(request: <T>(path: string, init?: RequestInit) => Promise<T>): SyncApi {
  return {
    async push(changes) {
      const response = await request<{ results: PushResult[] }>("/sync/push", { method: "POST", body: JSON.stringify({ protocol: PROTOCOL, changes }) });
      return response.results;
    },
    pull(cursor) {
      return request<PullPage>(`/sync/pull?cursor=${cursor}&protocol=${PROTOCOL}`);
    },
  };
}
