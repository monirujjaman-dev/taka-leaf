import { useTheme } from "../app/theme";
import { focusRing } from "./Button";
import { Icon } from "./Icon";

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [theme, toggle] = useTheme();
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      className={`glass inline-flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-[14px] px-3 text-sm font-bold ${focusRing}`}
    >
      <Icon name={theme === "light" ? "moon" : "sun"} size={19} />
      {withLabel ? `${next === "dark" ? "Dark" : "Light"} theme` : null}
    </button>
  );
}
