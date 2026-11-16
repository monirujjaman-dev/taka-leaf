import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * A1 tables: enough to prove that SQLite keeps data across restarts, that migrations run on the
 * phone, and that a background task can write. The money tables (wallets, transactions, outbox,
 * sync_state) arrive in A2.
 */

/** Small key/value settings kept on the phone, e.g. the server address. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Notes typed on the setup screen; they must survive closing the app. */
export const probeNotes = sqliteTable("probe_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Each server check, from the screen or from the background task. */
export const healthChecks = sqliteTable("health_checks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source", { enum: ["app", "background"] }).notNull(),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  detail: text("detail").notNull(),
  checkedAt: text("checked_at").notNull(),
});
