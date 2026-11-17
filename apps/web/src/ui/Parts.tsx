import type { ReactNode } from "react";
import { focusRing } from "./Button";
import { Icon, type IconName } from "./Icon";

/** The 40 px (or 36 px) rounded square that holds a row's or tile's icon. */
export function IconTile({ icon, tone = "primary", size = 40 }: { icon: IconName; tone?: "primary" | "expense"; size?: 36 | 38 | 40 }) {
  const color = tone === "expense" ? "text-expense dark:text-expense-dark" : "text-[var(--tl-primary)]";
  const radius = size === 36 ? "rounded-[12px]" : "rounded-[14px]";
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center bg-[var(--tl-chip)] ${radius} ${color}`}
    >
      <Icon name={icon} size={size === 36 ? 18 : 19} />
    </span>
  );
}

/** A glass tile with an icon, a small label and a value: Income, Expense, Owed to me, I owe. */
export function StatTile({ icon, tone, label, value }: { icon: IconName; tone?: "primary" | "expense"; label: string; value: ReactNode }) {
  return (
    <div className="glass flex min-w-0 items-center gap-2 rounded-[18px] px-3 py-3 sm:gap-2.5 sm:px-3.5">
      <IconTile icon={icon} tone={tone} size={36} />
      <div className="min-w-0">
        <p className="m-0 text-[12px] font-semibold leading-snug text-[var(--tl-muted)]">{label}</p>
        {/* Never cut off: a large amount wraps rather than losing digits behind an ellipsis. */}
        <p className="m-0 text-[15px] font-extrabold leading-snug tracking-tight [overflow-wrap:anywhere] sm:text-base">{value}</p>
      </div>
    </div>
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
      <h2 id={id} className="m-0 text-[13px] font-extrabold text-[var(--tl-muted)]">
        {title}
      </h2>
      {children ? <span className="text-[13px] font-bold text-[var(--tl-muted)]">{children}</span> : null}
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
  return (
    <div role="radiogroup" aria-label={label} className={`glass flex h-11 shrink-0 gap-1 rounded-[14px] p-[3px] ${className}`}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={`h-9 min-w-0 flex-1 cursor-pointer truncate rounded-[11px] px-2 text-sm font-bold ${focusRing} ${
              on ? "bg-forest text-white" : "text-[var(--tl-muted)] hover:text-[var(--tl-text)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A 44 px square glass button holding one icon, for back, add and refresh in page headers. */
export const iconButtonClass = `glass grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[14px] text-[var(--tl-text)] ${focusRing}`;

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

const WALLET_ICON: Record<string, IconName> = { Cash: "cash", Mfs: "phone", Bank: "bank", CreditCard: "card", Lent: "moneyOut", Borrowed: "moneyIn" };
export const walletIcon = (type: string): IconName => WALLET_ICON[type] ?? "wallet";
