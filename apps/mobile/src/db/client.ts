import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { openDatabaseSync } from "expo-sqlite";
import migrations from "../../drizzle/migrations";
import * as schema from "./schema";

/** The one database file on the phone. The change listener lets screens update live. */
const sqlite = openDatabaseSync("takaleaf.db", { enableChangeListener: true });
sqlite.execSync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });

let migrated: Promise<void> | null = null;

/**
 * Brings the database up to the newest schema. Safe to call from the app and from a background
 * task (which can start without the app's screens); the work runs once per process.
 */
export function migrateOnce(): Promise<void> {
  migrated ??= migrate(db, migrations).catch((error: unknown) => {
    migrated = null;
    throw error;
  });
  return migrated;
}
