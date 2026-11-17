import { outbox, wallets } from "../db/schema";
import type { AppDb } from "../db/types";
import { getSetting } from "../db/store";
import { listWallets, saveWallet } from "../data/wallets";
import { saveTransaction } from "../data/transactions";
import { openTestDb } from "../test/db";
import { CURSOR_KEY, pendingCount, pullAll, pushAll, rejectedChanges, syncNow, type PullPage, type PushChange, type SyncApi } from "./engine";

let db: AppDb;
let close: () => void;
const now = new Date("2026-11-17T06:00:00.000Z");
const empty = { wallets: [], categories: [], people: [], transactions: [], budgets: [], recurringRules: [] };

beforeEach(async () => {
  ({ db, close } = await openTestDb());
});
afterEach(() => close());

/** A server that accepts everything and serves pages from a list. */
function fakeServer(pages: PullPage[] = [], reject: (c: PushChange) => string | null = () => null) {
  const received: PushChange[] = [];
  const api: SyncApi & { received: PushChange[] } = {
    received,
    async push(changes) {
      received.push(...changes);
      return changes.map((c) => {
        const reason = reject(c);
        return reason
          ? { mutationId: c.mutationId, status: "rejected" as const, reason, current: null }
          : { mutationId: c.mutationId, status: "accepted" as const, reason: null, current: { ...c.row, updatedAt: "2026-11-17T06:00:01.123456+00:00", serverSeq: 9 } };
      });
    },
    async pull(cursor) {
      const page = pages.find((p) => p.cursor > cursor);
      return page ?? { cursor, hasMore: false, ...empty };
    },
  };
  return api;
}

const wallet = (id: string, name: string, extra: object = {}) => ({
  id, type: "Cash", name, openingBalance: 0, creditLimit: null, personId: null, icon: null, color: null, archived: false,
  excludedFromTotal: false, sortOrder: 0, updatedAt: "2026-11-17T05:00:00+00:00", deletedAt: null, serverSeq: 1, ...extra,
});

describe("sync engine", () => {
  it("pushes the outbox oldest first and empties it (S-1)", async () => {
    const id = saveWallet(db, { type: "Cash", name: "Cash", openingBalance: 1000, creditLimit: null, excludedFromTotal: false }, now);
    saveTransaction(db, { type: "Expense", amount: 100, fromWalletId: id, toWalletId: null, categoryId: null, occurredAt: now.toISOString(), note: null }, now);
    const server = fakeServer();

    const report = await syncNow(db, server, now);

    expect(server.received.map((c) => c.table)).toEqual(["wallets", "transactions"]);
    expect(report).toMatchObject({ pushed: 2, rejected: 0 });
    expect(pendingCount(db)).toBe(0);
    expect(db.select().from(wallets).get()!.updatedAt).toBe("2026-11-17T06:00:01.123Z");
  });

  it("sends 500 changes in batches of 200 (S-10)", async () => {
    const id = saveWallet(db, { type: "Cash", name: "Cash", openingBalance: 0, creditLimit: null, excludedFromTotal: false }, now);
    for (let i = 0; i < 499; i++) saveTransaction(db, { type: "Income", amount: 1, fromWalletId: null, toWalletId: id, categoryId: null, occurredAt: now.toISOString(), note: null }, now);
    const server = fakeServer();
    const calls: number[] = [];
    const push = server.push.bind(server);
    server.push = async (changes) => (calls.push(changes.length), push(changes));

    await pushAll(db, server, now);

    expect(calls).toEqual([200, 200, 100]);
    expect(pendingCount(db)).toBe(0);
  });

  it("keeps a refused new row's reason and removes the row (S-9)", async () => {
    saveWallet(db, { type: "Cash", name: "Cash", openingBalance: 0, creditLimit: null, excludedFromTotal: false }, now);
    const server = fakeServer([], () => "You already have a wallet with this name.");

    const result = await pushAll(db, server, now);

    expect(result.rejected).toBe(1);
    expect(rejectedChanges(db)[0]!.reason).toBe("You already have a wallet with this name.");
    expect(listWallets(db)).toHaveLength(0);
  });

  it("keeps the outbox when the network fails, and sends it later", async () => {
    saveWallet(db, { type: "Cash", name: "Cash", openingBalance: 0, creditLimit: null, excludedFromTotal: false }, now);
    const failing: SyncApi = { push: () => Promise.reject(new Error("offline")), pull: () => Promise.reject(new Error("offline")) };

    await expect(syncNow(db, failing, now)).rejects.toThrow("offline");
    expect(pendingCount(db)).toBe(1);
    await syncNow(db, fakeServer(), now);
    expect(pendingCount(db)).toBe(0);
  });

  it("pulls pages and saves the cursor with each page (S-7, S-8)", async () => {
    const pages: PullPage[] = [
      { cursor: 10, hasMore: true, ...empty, wallets: [wallet("w1", "Cash")] },
      { cursor: 20, hasMore: false, ...empty, wallets: [wallet("w2", "Bank", { deletedAt: "2026-11-17T05:30:00+00:00" })] },
    ];
    let calls = 0;
    const flaky: SyncApi = {
      push: async () => [],
      pull: async (cursor) => {
        calls++;
        if (calls === 2) throw new Error("connection lost");
        return pages.find((p) => p.cursor > cursor)!;
      },
    };

    await expect(pullAll(db, flaky)).rejects.toThrow("connection lost");
    expect(getSetting(db, CURSOR_KEY)).toBe("10");
    expect(listWallets(db).map((w) => w.name)).toEqual(["Cash"]);

    await pullAll(db, flaky);
    expect(getSetting(db, CURSOR_KEY)).toBe("20");
    expect(listWallets(db).map((w) => w.name)).toEqual(["Cash"]);
    expect(db.select().from(wallets).all()).toHaveLength(2);
  });

  it("does not let a pull overwrite a change still waiting to be pushed", async () => {
    const id = saveWallet(db, { type: "Cash", name: "Pocket", openingBalance: 0, creditLimit: null, excludedFromTotal: false }, now);

    await pullAll(db, fakeServer([{ cursor: 5, hasMore: false, ...empty, wallets: [wallet(id, "Old name")] }]));

    expect(listWallets(db)[0]!.name).toBe("Pocket");
    expect(db.select().from(outbox).all()).toHaveLength(1);
  });
});
