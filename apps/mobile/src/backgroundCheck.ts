import { checkHealth } from "./api/health";
import { getSetting, recordCheck, type CheckResult } from "./db/store";
import type { AppDb } from "./db/types";

export const SERVER_URL_KEY = "server_url";

/** What the background task does each time Android runs it: one server check, written to SQLite. */
export async function runBackgroundCheck(db: AppDb, check: (url: string) => Promise<CheckResult> = checkHealth): Promise<CheckResult> {
  const url = getSetting(db, SERVER_URL_KEY);
  const result: CheckResult = url ? await check(url) : { ok: false, detail: "Ran, but no server address is set" };
  recordCheck(db, "background", result);
  return result;
}
