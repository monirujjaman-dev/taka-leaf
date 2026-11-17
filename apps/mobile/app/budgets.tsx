import { formatBdt } from "@takaleaf/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { budgetsFor } from "../src/data/budgets";
import { daysInMonth, monthLabel, monthOf, shiftMonth, today } from "../src/data/calendar";
import { db } from "../src/db/client";
import { useData } from "../src/state/AppState";
import { Bar, Card, Empty, HeaderButton, Row, Screen } from "../src/ui/kit";
import { LeafWatermark } from "../src/ui/LeafMark";
import { useColors } from "../src/ui/theme";

export default function Budgets() {
  const c = useColors();
  const [month, setMonth] = useState(() => monthOf(today()));
  const budgets = useData(() => budgetsFor(db, month), [month]);
  const total = budgets.find((b) => b.categoryId === null);
  const current = monthOf(today());
  const [y, m] = month.split("-").map(Number) as [number, number];
  const daysLeft = month === current ? daysInMonth(y, m) - Number(today().slice(8)) : null;

  return (
    <Screen title="Budgets" back right={<HeaderButton icon="plus" label="Add a budget" onPress={() => router.push("/budget")} />}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <HeaderButton icon="chevron-left" label="Previous month" onPress={() => setMonth(shiftMonth(month, -1))} />
        <Text accessibilityRole="header" style={{ color: c.text, fontWeight: "800", fontSize: 16 }}>
          {monthLabel(month)}
        </Text>
        <HeaderButton icon="chevron-right" label="Next month" onPress={() => setMonth(shiftMonth(month, 1))} />
      </View>
      {total ? (
        <View style={{ borderRadius: 26, padding: 20, gap: 8, overflow: "hidden", backgroundColor: "#0F7A44" }}>
          <LeafWatermark />
          <Text style={{ color: "#D7EFE0", fontWeight: "700" }}>Spent this month</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "800" }}>
            {formatBdt(total.spent)} <Text style={{ fontSize: 15, color: "#D7EFE0" }}>of {formatBdt(total.amount)}</Text>
          </Text>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.25)" }}>
            <View style={{ height: 8, borderRadius: 4, width: `${Math.min(100, total.percent)}%`, backgroundColor: "#FFFFFF" }} />
          </View>
          <Text style={{ color: "#D7EFE0" }}>
            {total.remaining >= 0 ? `${formatBdt(total.remaining)} left` : `Over by ${formatBdt(-total.remaining)}`}
            {daysLeft !== null ? ` · ${daysLeft} days to go` : ""}
          </Text>
        </View>
      ) : null}
      {budgets.length === 0 ? <Empty title="No budgets yet" detail="Set a monthly limit for all spending or for a category." action={{ label: "Add a budget", onPress: () => router.push("/budget") }} /> : null}
      {budgets.length ? (
        <Card>
          {budgets.map((b) => (
            <View key={b.id} style={{ gap: 6 }}>
              <Row title={b.name} detail={`${formatBdt(b.spent)} of ${formatBdt(b.amount)}`} onPress={() => router.push({ pathname: "/budget", params: { id: b.id } })} />
              <Bar percent={b.percent} tone={b.status === "Over" ? "expense" : b.status === "Near" ? "neutral" : "income"} />
              <Text style={{ color: b.status === "Over" ? c.expense : c.muted, fontSize: 13 }}>
                {b.status === "Over" ? `Over by ${formatBdt(-b.remaining)} · ${b.percent}%` : `${formatBdt(b.remaining)} left · ${b.percent}%${b.status === "Near" ? " · Nearly used up" : ""}`}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
