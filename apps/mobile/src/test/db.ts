import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import path from "node:path";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import * as schema from "../db/schema";
import type { AppDb } from "../db/types";

let engine: Promise<SqlJsStatic> | null = null;

/**
 * Opens a SQLite database in Node (sql.js, SQLite compiled to WebAssembly) with the same
 * migrations the phone runs, so store code is tested against real SQL. Pass the bytes from an
 * earlier `save()` to test that data survives closing and reopening.
 */
export async function openTestDb(bytes?: Uint8Array): Promise<{ db: AppDb; save: () => Uint8Array; close: () => void }> {
  engine ??= initSqlJs();
  const SQL = await engine;
  const sqlite = new SQL.Database(bytes);
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, "../../drizzle") });
  return { db, save: () => sqlite.export(), close: () => sqlite.close() };
}
