import { TAGLINE } from "@takaleaf/shared";
import type { ReactNode } from "react";
import { useTheme } from "../app/theme";
import { Logo } from "../shared/Logo";
import { Backdrop } from "../ui/Backdrop";
import { ThemeToggle } from "../ui/ThemeToggle";

export function AuthLayout({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  const [theme] = useTheme();
  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-5 py-10">
        <div className="flex items-center justify-between">
          <Logo theme={theme} />
          <ThemeToggle />
        </div>
        <section className="glass rounded-[26px] p-6">
          <h1 className="m-0 text-2xl font-extrabold tracking-tight">{title}</h1>
          {intro ? <p className="mb-0 mt-2 text-[15px] leading-relaxed text-[var(--tl-muted)]">{intro}</p> : null}
          <div className="mt-5">{children}</div>
        </section>
        <p className="m-0 text-center text-[13px] text-[var(--tl-muted)]">{TAGLINE}</p>
      </main>
    </div>
  );
}

export const linkClass = "font-bold text-[var(--tl-primary)] underline-offset-4 hover:underline";
