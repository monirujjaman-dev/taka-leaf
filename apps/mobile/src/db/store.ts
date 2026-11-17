import { eq } from "drizzle-orm";
import { settings } from "./schema";
import type { AppDb } from "./types";

export function getSetting(db: AppDb, key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function setSetting(db: AppDb, key: string, value: string): void {
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}

export function deleteSetting(db: AppDb, key: string): void {
  db.delete(settings).where(eq(settings.key, key)).run();
}
