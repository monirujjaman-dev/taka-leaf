import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type * as schema from "./schema";

/**
 * Any synchronous Drizzle SQLite database with our schema: expo-sqlite on the phone,
 * better-sqlite3 in the unit tests. Store functions take this, so the same code is tested in Node.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDb = BaseSQLiteDatabase<"sync", any, typeof schema>;
