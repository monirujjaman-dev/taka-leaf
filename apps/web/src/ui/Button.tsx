import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-forest text-white hover:bg-[#0c6a3b] dark:bg-sage dark:text-ink dark:hover:bg-[#9adab4]",
  secondary: "glass hover:brightness-[0.98]",
  ghost: "hover:bg-[var(--tl-chip)]",
  danger: "bg-expense text-white hover:brightness-110 dark:bg-expense-dark dark:text-night",
};

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tl-primary)]";

export const buttonClass = (variant: Variant = "primary") =>
  `inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[14px] px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${VARIANTS[variant]}`;

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`${buttonClass(variant)} ${className}`}
      {...props}
    />
  );
}
