import { TAGLINE, formatBdt } from "@takaleaf/shared";
import { GlassCard } from "../shared/GlassCard";
import { Logo } from "../shared/Logo";
import { useTheme } from "./theme";
import { useBackendHealth, type Health } from "./useBackendHealth";

const HEALTH_TEXT: Record<Health, string> = {
  checking: "Checking the backend…",
  connected: "Backend connected",
  unreachable: "Backend not reachable",
};

/**
 * M0 placeholder screen: proves the theme, the glass surface, the shared money
 * formatter and the connection to the backend. Real screens start in M2.
 */
export function App() {
  const [theme, toggleTheme] = useTheme();
  const health = useBackendHealth();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 top-40 h-80 w-80 rounded-full blur-[80px]"
        style={{ background: "var(--tl-blob-a)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 top-96 h-80 w-80 rounded-full blur-[80px]"
        style={{ background: "var(--tl-blob-b)" }}
      />

      <main className="relative mx-auto flex max-w-xl flex-col gap-5 px-5 py-8">
        <header className="flex items-center justify-between">
          <Logo theme={theme} />
          <button
            type="button"
            onClick={toggleTheme}
            className="glass h-11 rounded-[14px] px-4 text-sm font-bold"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? "Dark" : "Light"} theme
          </button>
        </header>

        <section
          aria-label="Net balance sample"
          className="rounded-[26px] bg-forest p-5 text-white shadow-[0_12px_28px_rgb(11_59_36/0.22)]"
        >
          <p className="m-0 text-[13px] font-semibold text-[#D5EBDD]">Net balance (sample)</p>
          <p className="m-0 mt-1 text-[34px] font-extrabold tracking-tight">{formatBdt(18425000)}</p>
        </section>

        <GlassCard>
          <h1 className="m-0 text-xl font-extrabold tracking-tight">TakaLeaf is set up</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--tl-muted)]">{TAGLINE}</p>
          <p role="status" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${
                health === "connected" ? "bg-leaf" : health === "checking" ? "bg-sage" : "bg-expense dark:bg-expense-dark"
              }`}
            />
            {HEALTH_TEXT[health]}
          </p>
        </GlassCard>
      </main>
    </div>
  );
}
