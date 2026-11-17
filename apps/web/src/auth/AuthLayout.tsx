import type { ReactNode } from "react";
import markOnDark from "../assets/takaleaf-mark-on-dark.svg";
import { Backdrop } from "../ui/Backdrop";
import { LeafWatermark } from "../ui/Parts";
import { ThemeToggle } from "../ui/ThemeToggle";

/**
 * Signed-out screens: a forest brand panel beside a glass form card on wide screens; on phones the
 * panel shrinks to a short band above the card.
 */
export function AuthLayout({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <div className="flex min-h-screen flex-col gap-5 p-5 lg:flex-row">
        <aside className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-[28px] bg-forest p-7 text-white lg:min-w-0 lg:flex-1 lg:gap-8 lg:p-12">
          <LeafWatermark size={120} className="lg:hidden" />
          <LeafWatermark size={380} className="!-bottom-[70px] !-right-[60px] !top-auto hidden !opacity-[0.14] lg:block" />
          <span className="relative flex items-center gap-2.5">
            <img src={markOnDark} width={44} height={44} alt="" />
            <span className="text-headline font-extrabold">
              Taka<span className="text-sage-soft">Leaf</span>
            </span>
          </span>
          <div className="relative">
            <p className="m-0 text-headline font-extrabold leading-[1.15] lg:text-display">
              Your Money.
              <br />
              Your Control.
            </p>
            <p className="mb-0 mt-3.5 hidden max-w-[360px] text-base leading-normal text-mint lg:block">
              Every wallet, every loan and every taka in one calm place. Works offline on your phone and stays in sync.
            </p>
          </div>
        </aside>
        <main className="relative flex flex-col items-center justify-center lg:min-w-0 lg:flex-1 lg:p-6">
          <div className="mb-3 self-end lg:absolute lg:right-0 lg:top-0 lg:mb-0">
            <ThemeToggle />
          </div>
          <section className="glass w-full max-w-[440px] rounded-[26px] p-6 sm:p-9">
            <h1 className="m-0 text-display-sm font-extrabold">{title}</h1>
            {intro ? <p className="mb-0 mt-2 text-body leading-[1.45] text-[var(--tl-muted)]">{intro}</p> : null}
            <div className="mt-6">{children}</div>
          </section>
        </main>
      </div>
    </div>
  );
}

export const linkClass = "tap-area font-bold text-[var(--tl-primary)] underline-offset-4 hover:underline";
