import { APP_NAME } from "@takaleaf/shared";
import markOnDark from "../assets/takaleaf-mark-on-dark.svg";
import markColor from "../assets/takaleaf-mark-color.svg";
import type { Theme } from "../app/theme";

export function Logo({ theme, size = 36 }: { theme: Theme; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img src={theme === "dark" ? markOnDark : markColor} width={size} height={size} alt="" />
      <span className="text-wordmark font-extrabold tracking-tight">
        Taka<span className="text-[var(--tl-primary)]">Leaf</span>
        <span className="sr-only"> ({APP_NAME})</span>
      </span>
    </span>
  );
}
