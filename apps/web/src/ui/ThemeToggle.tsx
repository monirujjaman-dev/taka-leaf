import { useTheme } from "../app/theme";
import { focusRing } from "./Button";

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [theme, toggle] = useTheme();
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      className={`glass inline-flex h-11 cursor-pointer items-center gap-2 rounded-[14px] px-3.5 text-sm font-bold ${focusRing}`}
    >
      <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span>
      {withLabel ? `${next === "dark" ? "Dark" : "Light"} theme` : null}
    </button>
  );
}
