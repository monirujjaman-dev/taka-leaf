import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

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
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const ThemeContext = createContext<[Theme, () => void]>(["light", () => {}]);

/** Theme follows the system until the person picks one; the choice is remembered on this device. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? systemTheme());

  useEffect(() => {
    const root = document.documentElement;
    const switching = root.dataset.theme !== undefined && root.dataset.theme !== theme;
    // A switch flips every colour at once: hold transitions off for that frame (index.css), or
    // buttons and fields would fade at their own speed while the rest of the page snaps.
    if (switching) root.setAttribute("data-theme-switching", "");
    root.dataset.theme = theme;
    if (switching) {
      void root.offsetHeight;
      requestAnimationFrame(() => root.removeAttribute("data-theme-switching"));
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(KEY, next);
      } catch {
        // Storage can be unavailable (private mode); the theme still changes for this visit.
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={[theme, toggle]}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
