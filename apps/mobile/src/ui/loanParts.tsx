import { formatBdt } from "@takaleaf/shared";
import { Text, View } from "react-native";
import { addDays, dateLabel, today } from "../data/calendar";
import type { LoanView } from "../data/loans";
import { Bar } from "./kit";
import { useColors } from "./theme";

/** "Due in 3 days", "Due today", "2 days late": the same words as the web's Loans page. */
export function dueInWords(date: string, day: string = today()): string {
  if (date === day) return "Due today";
  let n = 0;
  if (date > day) {
    while (addDays(day, n) < date && n < 400) n++;
    return n === 1 ? "Due tomorrow" : n <= 14 ? `Due in ${n} days` : `Due ${dateLabel(date)}`;
  }
  while (addDays(date, n) < day && n < 400) n++;
  return n === 1 ? "1 day late" : `${n} days late`;
}

export const repaidPercent = (l: Pick<LoanView, "principal" | "outstanding">) => (l.principal > 0 ? Math.min(100, Math.max(0, Math.round(((l.principal - l.outstanding) / l.principal) * 100))) : 0);

/** "18 of 60 EMIs paid": billed for card EMIs. */
export const progressWords = (l: Pick<LoanView, "type" | "paid" | "left">) => `${l.paid} of ${l.paid + l.left} ${l.type === "CardEmi" ? "instalments billed" : "EMIs paid"}`;

/** A small coloured label: Late, Due soon, Automatic, Closed. */
export function Pill({ label, tone }: { label: string; tone: "expense" | "income" | "muted" }) {
  const c = useColors();
  const color = tone === "expense" ? c.expense : tone === "income" ? c.income : c.muted;
  return (
    <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: color, alignSelf: "flex-start" }}>
      <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

/** The repaid bar with its words underneath. */
export function Progress({ loan }: { loan: LoanView }) {
  const c = useColors();
  const percent = repaidPercent(loan);
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`${percent}% repaid. ${progressWords(loan)}`}>
      <Bar percent={percent} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: c.muted, fontSize: 13 }}>{progressWords(loan)}</Text>
        <Text style={{ color: c.muted, fontSize: 13, fontVariant: ["tabular-nums"] }}>{percent}% repaid</Text>
      </View>
    </View>
  );
}

/** Label over an amount, for the two-up facts. */
export function Fact({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export const nextWords = (l: LoanView) => (l.next ? `${l.type === "CardEmi" ? "Next bill" : "Next EMI"} ${formatBdt(l.next.total)} · ${dateLabel(l.next.dueDate)}` : "Paid off");
