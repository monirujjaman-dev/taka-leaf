import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Start-up is one wait, so it gets one loader. Until the first signed-in page has painted, a
 * page-level Loading (the page's code, then its data) continues the full-screen "Opening TakaLeaf…"
 * loader on the shared clock instead of showing the empty shell and a small loader. After that,
 * in-app loading is the small, delayed one.
 */
interface Startup {
  active: boolean;
  holders: number;
}

const StartupContext = createContext<{ current: Startup } | null>(null);

/** Wraps the signed-in shell. */
export function StartupProvider({ children }: { children: ReactNode }) {
  const state = useRef<Startup>({ active: true, holders: 0 });
  useEffect(() => {
    // The first page rendered without waiting for anything: start-up is over.
    const timer = setTimeout(() => {
      if (state.current.holders === 0) state.current.active = false;
    }, 50);
    return () => clearTimeout(timer);
  }, []);
  return <StartupContext.Provider value={state}>{children}</StartupContext.Provider>;
}

/**
 * True when this loader is part of start-up. Read once, when the loader first renders: the page's
 * own loader renders before the code loader it replaces has gone, so it inherits start-up.
 */
export function useStartupLoading(): boolean {
  const state = useContext(StartupContext);
  const [startup] = useState(() => state?.current.active ?? false);
  useEffect(() => {
    if (!startup || !state) return;
    state.current.holders++;
    return () => {
      state.current.holders--;
      // Hand-offs happen within a frame; only end start-up once nothing has taken over.
      setTimeout(() => {
        if (state.current.holders === 0) state.current.active = false;
      }, 50);
    };
  }, [startup, state]);
  return startup;
}
