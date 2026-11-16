import { openTestDb } from "../test/db";
import { addNote, getSetting, KEEP_CHECKS, listChecks, listNotes, noteCount, recordCheck, setSetting, sqliteVersion } from "./store";

describe("phone database", () => {
  it("keeps notes after the database is closed and opened again", async () => {
    const first = await openTestDb();
    addNote(first.db, "  first test  ");
    addNote(first.db, "   ");
    const file = first.save();
    first.close();

    // Opening runs the migrations again; they must be a no-op on an up-to-date file.
    const second = await openTestDb(file);
    expect(noteCount(second.db)).toBe(1);
    expect(listNotes(second.db)[0]?.text).toBe("first test");
    second.close();
  });

  it("stores and replaces settings", async () => {
    const { db } = await openTestDb();
    expect(getSetting(db, "server_url")).toBeNull();
    setSetting(db, "server_url", "https://a.example");
    setSetting(db, "server_url", "https://b.example");
    expect(getSetting(db, "server_url")).toBe("https://b.example");
  });

  it(`keeps only the newest ${KEEP_CHECKS} server checks`, async () => {
    const { db } = await openTestDb();
    for (let i = 1; i <= KEEP_CHECKS + 5; i++) recordCheck(db, i % 2 ? "app" : "background", { ok: true, detail: `check ${i}` });
    const all = listChecks(db, 1000);
    expect(all).toHaveLength(KEEP_CHECKS);
    expect(all[0]?.detail).toBe(`check ${KEEP_CHECKS + 5}`);
    expect(all.at(-1)?.detail).toBe("check 6");
    expect(typeof all[0]?.ok).toBe("boolean");
  });

  it("reports the SQLite version", async () => {
    const { db } = await openTestDb();
    expect(sqliteVersion(db)).toMatch(/^3\.\d+/);
  });
});
