import type { ReactNode } from "react";
import { focusRing } from "./Button";
import { Icon, type IconName } from "./Icon";

/** The 40 px (or 36 px) rounded square that holds a row's or tile's icon. Gold and blue mark certificates, bonds and policies. */
export function IconTile({ icon, tone = "primary", size = 40 }: { icon: IconName; tone?: "primary" | "expense" | "gold" | "blue" | "muted"; size?: 36 | 38 | 40 }) {
  const color = {
    primary: "bg-[var(--tl-chip)] text-[var(--tl-primary)]",
    expense: "bg-[var(--tl-chip)] text-expense dark:text-expense-dark",
    gold: "bg-[#FBF0D9] text-[#7A4F00] dark:bg-[#3A2E12] dark:text-[#F2C46D]",
    blue: "bg-[#E4EEF7] text-[#2C5F8A] dark:bg-[#18283A] dark:text-[#8DB8E2]",
    muted: "bg-[var(--tl-track)] text-[var(--tl-muted)]",
  }[tone];
  const radius = size === 36 ? "rounded-[12px]" : "rounded-[14px]";
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center ${radius} ${color}`}
    >
      <Icon name={icon} size={size === 36 ? 18 : 19} />
    </span>
  );
}

/** A glass tile with an icon, a small label and a value: Income, Expense, Owed to me, I owe. */
export function StatTile({ icon, tone, label, value }: { icon: IconName; tone?: "primary" | "expense" | "gold" | "blue"; label: string; value: ReactNode }) {
  return (
    <div className="glass flex min-w-0 items-center gap-2 rounded-[18px] px-3 py-3 sm:gap-2.5 sm:px-3.5">
      <IconTile icon={icon} tone={tone} size={36} />
      <div className="min-w-0">
        <p className="m-0 text-caption font-semibold leading-snug text-[var(--tl-muted)]">{label}</p>
        {/* Never cut off: a large amount wraps rather than losing digits behind an ellipsis. */}
        <p className="m-0 text-body font-extrabold leading-snug tracking-tight [overflow-wrap:anywhere] sm:text-base">{value}</p>
      </div>
    </div>
  );
}

/**
 * Stat tiles two by two, or one per row where two would squeeze the amounts: 320 px phones and
 * larger browser text (20rem grows with the text size, the space does not).
 */
export function StatGrid({ children, label, className = "" }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <section aria-label={label} className={`@container ${className}`}>
      <div className="grid grid-cols-1 gap-2.5 @[20rem]:grid-cols-2 lg:gap-3">{children}</div>
    </section>
  );
}

/** A glass card holding a list of rows (padding 4/14, radius 20). */
export function ListCard({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={`glass rounded-[20px] px-3.5 py-1 ${className}`}>
      {children}
    </section>
  );
}

/** A small muted section heading with an optional link or total on the right. */
export function SectionHeading({ id, title, children }: { id?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mt-1 flex min-h-5 items-center justify-between gap-3">
      <h2 id={id} className="m-0 text-small font-extrabold text-[var(--tl-muted)]">
        {title}
      </h2>
      {children ? <span className="text-small font-bold text-[var(--tl-muted)]">{children}</span> : null}
    </div>
  );
}

export function Chevron() {
  return (
    <span aria-hidden="true" className="flex shrink-0 text-[var(--tl-muted)]">
      <Icon name="right" size={18} />
    </span>
  );
}

/**
 * The segmented control from the design: a glass track with the chosen option in solid forest.
 * Options are radios, so screen readers hear one choice out of several.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const count = options.length;
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  return (
    <div role="radiogroup" aria-label={label} className={`glass relative flex h-11 shrink-0 gap-1 rounded-[14px] p-[3px] ${className}`}>
      {/* The forest pill slides to the chosen option (options are equal widths, 4 px apart), so the
          change reads as one choice moving, in the direction of the tap. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-[3px] top-[3px] h-9 rounded-[11px] bg-forest transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{ width: `calc((100% - 6px - ${(count - 1) * 4}px) / ${count})`, transform: `translateX(calc(${index} * (100% + 4px)))` }}
      />
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={`tap-area h-9 min-w-0 flex-1 cursor-pointer rounded-[11px] px-2 text-sm font-bold transition-colors duration-200 ${focusRing} ${
              on ? "text-white" : "text-[var(--tl-muted)] hover:text-[var(--tl-text)]"
            }`}
          >
            <span className="block truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A 44 px square glass button holding one icon, for back, add and refresh in page headers. */
export const iconButtonClass = `press glass grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[14px] text-[var(--tl-text)] ${focusRing}`;

/** The leaf watermark on forest cards (balance, budget total). */
export function LeafWatermark({ size = 140, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={`pointer-events-none absolute -right-[18px] -top-[14px] opacity-[0.16] ${className}`}
    >
      <g transform="translate(-11.28 -10.58) scale(0.176)" fill="#fff">
        <path fillOpacity="0.8" d="M95 305 C98 215 180 112 285 110 C335 109 375 118 405 128 C370 158 345 208 318 250 C290 290 235 303 95 305Z" />
        <path fillOpacity="0.7" d="M448 305 C385 345 366 410 362 480 C358 560 366 650 378 720 C420 650 446 560 448 470Z" />
        <path fillOpacity="0.7" d="M715 82 C650 200 540 262 448 305 C520 310 600 305 650 270 C700 230 715 150 715 82Z" />
        <path d="M715 82 C640 95 560 100 500 115 C420 135 340 215 300 310 C265 400 268 520 300 610 C320 665 350 700 378 720 C366 650 358 560 362 480 C366 410 385 345 448 305 C540 262 650 200 715 82Z" />
      </g>
    </svg>
  );
}

/** A thin progress bar: 8 px, soft track, leaf fill (rust when over). */
export function Bar({ share, over = false }: { share: number; over?: boolean }) {
  return (
    <div className="h-2 overflow-hidden rounded-[4px] bg-[var(--tl-track)]" aria-hidden="true">
      <div
        className={`h-full rounded-[4px] ${over ? "bg-expense dark:bg-expense-dark" : "bg-leaf"}`}
        style={{ width: `${Math.min(100, Math.max(share * 100, 2))}%` }}
      />
    </div>
  );
}

const WALLET_ICON: Record<string, IconName> = { Cash: "cash", Mfs: "phone", Bank: "bank", CreditCard: "card", Lent: "moneyOut", Borrowed: "moneyIn", Loan: "loan", Savings: "coins" };

/** The user's own wallets: not a person's Lent or Borrowed wallet, not a loan's or a saving's. */
export const isOwnWallet = (wallet: { personId: string | null; type: string }) =>
  wallet.personId === null && wallet.type !== "Loan" && wallet.type !== "Savings";
export const walletIcon = (type: string): IconName => WALLET_ICON[type] ?? "wallet";
