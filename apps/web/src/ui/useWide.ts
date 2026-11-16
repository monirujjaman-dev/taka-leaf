import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** True at the `lg` breakpoint and up, for the few places where phones and desktops show different markup. */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(QUERY).matches : false),
    () => false,
  );
}
