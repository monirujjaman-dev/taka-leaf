import { focusRing } from "./Button";
import { Icon } from "./Icon";
import { localMonth, monthLabel, shiftMonth } from "./format";

/** The design's "November 2026 ▾" button: a glass select of the last three years of months. */
export function MonthPicker({
  month,
  onChange,
  short = false,
  label = "Month",
}: {
  month: string;
  onChange: (month: string) => void;
  /** "Nov 2026" for the phone dashboard header. */
  short?: boolean;
  label?: string;
}) {
  const current = localMonth();
  const months = Array.from({ length: 36 }, (_, i) => shiftMonth(current, -i));
  if (!months.includes(month)) months.push(month);
  const text = (m: string) => (short ? monthLabel(m).replace(/^(\w{3})\w*/, "$1") : monthLabel(m));
  return (
    <span className="glass relative inline-flex h-11 shrink-0 items-center rounded-[14px]">
      <select
        aria-label={label}
        value={month}
        onChange={(e) => onChange(e.target.value)}
        className={`h-full cursor-pointer appearance-none rounded-[14px] bg-transparent pl-3.5 pr-9 text-sm font-bold text-[var(--tl-text)] ${focusRing}`}
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {text(m)}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-3 flex">
        <Icon name="down" size={16} />
      </span>
    </span>
  );
}
