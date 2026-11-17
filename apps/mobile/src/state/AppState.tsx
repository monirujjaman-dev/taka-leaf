import NetInfo from "@react-native-community/netinfo";
import { addDatabaseChangeListener } from "expo-sqlite";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { OfflineError, SignedOutError, type AuthUser } from "../api/client";
import { db } from "../db/client";
import { getSetting } from "../db/store";
import { forgetLocalData, httpSyncApi, LAST_SYNCED_KEY, pendingCount, rejectedChanges, syncNow } from "../sync/engine";
import { apiClient, storedUser, storeUser } from "./account";

export interface SyncStatus {
  running: boolean;
  lastSyncedAt: string | null;
  pending: number;
  rejected: number;
  /** The last failure in plain words, cleared by a good sync. */
  error: string | null;
}

interface AppContextValue {
  user: AuthUser | null;
  signedOut: boolean;
  /** Bumps on every database change, so screens re-read SQLite. */
  version: number;
  sync: SyncStatus;
  syncNow: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  /** Call after a save: syncs a few seconds later so quick edits travel together. */
  changed: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const SOON_MS = 3_000;
const STALE_MS = 2 * 60_000;
const RETRY_MS = [30_000, 60_000, 2 * 60_000, 5 * 60_000, 15 * 60_000];

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => storedUser());
  const [signedOut, setSignedOut] = useState(() => storedUser() === null);
  const [version, setVersion] = useState(0);
  const [sync, setSync] = useState<SyncStatus>(() => ({ running: false, lastSyncedAt: getSetting(db, LAST_SYNCED_KEY), pending: pendingCount(db), rejected: rejectedChanges(db).length, error: null }));
  const running = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);

  useEffect(() => {
    let queued = false;
    const subscription = addDatabaseChangeListener(() => {
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        setVersion((v) => v + 1);
        setSync((s) => ({ ...s, pending: pendingCount(db), rejected: rejectedChanges(db).length }));
      }, 50);
    });
    return () => subscription.remove();
  }, []);

  const schedule = useCallback((ms: number, run: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, ms);
  }, []);

  const runSync = useCallback(async () => {
    if (signedOut) return;
    if (running.current) return running.current;
    running.current = (async () => {
      setSync((s) => ({ ...s, running: true }));
      try {
        const client = apiClient();
        const report = await syncNow(db, httpSyncApi((path, init) => client.request(path, init)));
        failures.current = 0;
        setSync({ running: false, lastSyncedAt: report.at, pending: pendingCount(db), rejected: rejectedChanges(db).length, error: null });
      } catch (error) {
        if (error instanceof SignedOutError) setSignedOut(true);
        const message = error instanceof Error ? error.message : "Sync failed.";
        setSync((s) => ({ ...s, running: false, pending: pendingCount(db), error: message }));
        if (!(error instanceof SignedOutError)) {
          const wait = RETRY_MS[Math.min(failures.current, RETRY_MS.length - 1)]!;
          failures.current++;
          schedule(wait, () => void runSync());
        }
        if (!(error instanceof OfflineError) && !(error instanceof SignedOutError)) console.warn("Sync failed", error);
      } finally {
        running.current = null;
      }
    })();
    return running.current;
  }, [signedOut, schedule]);

  // Sync when the app comes to the front (if the last one is a while ago) and when the internet returns.
  useEffect(() => {
    if (signedOut) return;
    void runSync();
    const appState = AppState.addEventListener("change", (state) => {
      const last = getSetting(db, LAST_SYNCED_KEY);
      if (state === "active" && (!last || Date.now() - Date.parse(last) > STALE_MS || pendingCount(db) > 0)) void runSync();
    });
    let wasConnected: boolean | null = null;
    const net = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected);
      if (connected && wasConnected === false) void runSync();
      wasConnected = connected;
    });
    return () => {
      appState.remove();
      net();
    };
  }, [signedOut, runSync]);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      signedOut,
      version,
      sync,
      syncNow: runSync,
      changed: () => schedule(SOON_MS, () => void runSync()),
      setUser: (next) => {
        storeUser(next);
        setUserState(next);
      },
      async signIn(email, password) {
        const client = apiClient();
        const next = await client.signIn(email, password);
        const previous = storedUser();
        if (previous && previous.id !== next.id) {
          if (pendingCount(db) > 0) {
            await client.signOut();
            throw new Error(`Changes from ${previous.email} are still waiting to sync. Sign in as that account first.`);
          }
          forgetLocalData(db);
        }
        storeUser(next);
        setUserState(next);
        setSignedOut(false);
      },
      async signOut() {
        await apiClient().signOut();
        setSignedOut(true);
      },
    }),
    [user, signedOut, version, sync, runSync, schedule],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}

/** Re-reads SQLite whenever the data changes. */
export function useData<T>(read: () => T, deps: unknown[] = []): T {
  const { version } = useApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(read, [version, ...deps]);
}
