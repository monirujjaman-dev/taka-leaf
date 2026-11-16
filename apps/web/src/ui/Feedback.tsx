import type { ReactNode } from "react";

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="m-0 rounded-[14px] bg-expense/10 px-3.5 py-3 text-sm font-semibold text-expense dark:bg-expense-dark/15 dark:text-expense-dark">
      {children}
    </p>
  );
}

export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="m-0 rounded-[14px] bg-[var(--tl-chip)] px-3.5 py-3 text-sm font-semibold text-[var(--tl-primary)]">
      {children}
    </p>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" className="m-0 py-6 text-center text-sm text-[var(--tl-muted)]">
      {label}
    </p>
  );
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
