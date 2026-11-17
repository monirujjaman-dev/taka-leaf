import { AppLoader } from "./AppLoader";
import type { ReactNode } from "react";
import { useStartupLoading } from "./startup";
import { focusRing } from "./Button";

const errorTone = "rounded-[14px] bg-expense/10 px-3.5 py-3 text-sm font-semibold text-expense dark:bg-expense-dark/15 dark:text-expense-dark";

/** A plain-words error. With `onRetry` (for data that failed to load) it also offers "Try again". */
export function ErrorNote({ children, onRetry, retrying = false }: { children: ReactNode; onRetry?: () => void; retrying?: boolean }) {
  if (!children) return null;
  if (!onRetry) {
    return (
      <p role="alert" className={`m-0 ${errorTone}`}>
        {children}
      </p>
    );
  }
  return (
    <div role="alert" className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${errorTone}`}>
      <p className="m-0 min-w-0 flex-[1_1_200px]">{children}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className={`h-11 shrink-0 cursor-pointer rounded-[12px] border border-current px-3.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
      >
        {retrying ? "Trying…" : "Try again"}
      </button>
    </div>
  );
}

/** The error for a query that failed, with a retry that refetches it. */
export function LoadError({ query }: { query: { error: unknown; refetch: () => unknown; isFetching: boolean } }) {
  const message = messageOf(query.error);
  if (!message) return null;
  return (
    <ErrorNote onRetry={() => void query.refetch()} retrying={query.isFetching}>
      {message}
    </ErrorNote>
  );
}

export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="m-0 rounded-[14px] bg-[var(--tl-chip)] px-3.5 py-3 text-sm font-semibold text-[var(--tl-primary)]">
      {children}
    </p>
  );
}

/**
 * In-page loading: the small leaf with a short line under it, shown only after 350 ms. During
 * start-up it is instead the full-screen "Opening TakaLeaf…" loader, continued on the same clock,
 * so opening the app is one loader and then the finished page.
 */
export function Loading({ label = "Loading…" }: { label?: string }) {
  const startup = useStartupLoading();
  if (startup) {
    return (
      <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--tl-bg)]">
        <AppLoader label="Opening TakaLeaf…" bar />
      </div>
    );
  }
  return <AppLoader size={44} label={label} className="py-6" />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="m-0 text-base font-bold">{title}</p>
      {children}
    </div>
  );
}

export function messageOf(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
