import { count, desc, eq, lt, sql } from "drizzle-orm";
import { healthChecks, probeNotes, settings } from "./schema";
import type { AppDb } from "./types";

/** How many server checks are kept; older ones are removed when a new one is written. */
export const KEEP_CHECKS = 50;

export function getSetting(db: AppDb, key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function setSetting(db: AppDb, key: string, value: string): void {
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

export function addNote(db: AppDb, text: string, now: Date = new Date()): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  db.insert(probeNotes).values({ text: trimmed, createdAt: now.toISOString() }).run();
}

export function listNotes(db: AppDb) {
  return db.select().from(probeNotes).orderBy(desc(probeNotes.id)).all();
}

export function noteCount(db: AppDb): number {
  return db.select({ n: count() }).from(probeNotes).get()?.n ?? 0;
}

export interface CheckResult {
  ok: boolean;
  detail: string;
}

export function recordCheck(db: AppDb, source: "app" | "background", result: CheckResult, now: Date = new Date()): void {
  db.transaction((tx) => {
    tx.insert(healthChecks).values({ source, ok: result.ok, detail: result.detail, checkedAt: now.toISOString() }).run();
    const newest = tx.select({ id: healthChecks.id }).from(healthChecks).orderBy(desc(healthChecks.id)).limit(1).offset(KEEP_CHECKS - 1).get();
    if (newest) tx.delete(healthChecks).where(lt(healthChecks.id, newest.id)).run();
  });
}

export function listChecks(db: AppDb, limit = 10) {
  return db.select().from(healthChecks).orderBy(desc(healthChecks.id)).limit(limit).all();
}

/** SQLite's own version, shown on the setup screen. */
export function sqliteVersion(db: AppDb): string {
  return db.get<{ v: string }>(sql`select sqlite_version() as v`).v;
}
