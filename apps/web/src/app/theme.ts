import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "takaleaf.theme";

function readStored(): Theme | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Theme follows the system until the user picks one; the choice is remembered on this device. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = () => {
    setTheme((current) => {
      const next: Theme = current === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        // Storage can be unavailable (private mode); the theme still changes for this visit.
      }
      return next;
    });
  };

  return [theme, toggle];
}
