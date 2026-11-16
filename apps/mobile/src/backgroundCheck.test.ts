import { runBackgroundCheck, SERVER_URL_KEY } from "./backgroundCheck";
import { listChecks, setSetting } from "./db/store";
import { openTestDb } from "./test/db";

describe("background task", () => {
  it("checks the saved server and writes the result as a background row", async () => {
    const { db } = await openTestDb();
    setSetting(db, SERVER_URL_KEY, "https://t.example");
    const check = jest.fn().mockResolvedValue({ ok: true, detail: "Server answered in 80 ms" });

    await runBackgroundCheck(db, check);

    expect(check).toHaveBeenCalledWith("https://t.example");
    expect(listChecks(db)[0]).toMatchObject({ source: "background", ok: true, detail: "Server answered in 80 ms" });
  });

  it("still leaves a trace when no server is set", async () => {
    const { db } = await openTestDb();
    const check = jest.fn();
    await runBackgroundCheck(db, check);
    expect(check).not.toHaveBeenCalled();
    expect(listChecks(db)[0]).toMatchObject({ source: "background", ok: false, detail: "Ran, but no server address is set" });
  });
});
