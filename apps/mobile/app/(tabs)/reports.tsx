import { formatBdt } from "@takaleaf/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { budgetsFor } from "../../src/data/budgets";
import { monthLabel, monthOf, shiftMonth, shortMonthLabel, today } from "../../src/data/calendar";
import { report, type CategoryTotal } from "../../src/data/reports";
import { db } from "../../src/db/client";
import { useData } from "../../src/state/AppState";
import { Bar, Body, Card, HeaderButton, Money, Screen, Segmented } from "../../src/ui/kit";
import { useColors } from "../../src/ui/theme";

export default function Reports() {
  const c = useColors();
  const [period, setPeriod] = useState<"Month" | "Year">("Month");
  const [month, setMonth] = useState(() => monthOf(today()));
  const [year, setYear] = useState(() => Number(today().slice(0, 4)));
  const data = useData(() => report(db, period === "Month" ? { month } : { year }), [period, month, year]);
  const budgets = useData(() => (period === "Month" ? budgetsFor(db, month) : []), [period, month]);
  const maxTrend = Math.max(1, ...data.trend.map((p) => Math.max(p.expense, p.income)));
  const highlight = period === "Month" ? month : null;

  return (
    <Screen title="Reports">
      <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: "Month", label: "Month" }, { value: "Year", label: "Year" }]} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <HeaderButton icon="chevron-left" label="Earlier" onPress={() => (period === "Month" ? setMonth(shiftMonth(month, -1)) : setYear(year - 1))} />
        <Text accessibilityRole="header" style={{ color: c.text, fontWeight: "800", fontSize: 16 }}>
          {period === "Month" ? monthLabel(month) : year}
        </Text>
        <HeaderButton icon="chevron-right" label="Later" onPress={() => (period === "Month" ? setMonth(shiftMonth(month, 1)) : setYear(year + 1))} />
      </View>

      <Card title="Income and expense">
        <View style={{ gap: 8 }}>
          <Body muted>Income</Body>
          <Money amount={data.income} tone="income" size={18} />
          <Bar percent={(data.income * 100) / Math.max(data.income, data.expense, 1)} />
          <Body muted>Expense</Body>
          <Money amount={data.expense} tone="expense" size={18} />
          <Bar percent={(data.expense * 100) / Math.max(data.income, data.expense, 1)} tone="expense" />
        </View>
        <Body>
          {data.saved >= 0 ? `Saved ${formatBdt(data.saved)}` : `Spent ${formatBdt(-data.saved)} more than came in`}
          {data.savedPercent !== null && data.saved >= 0 ? ` · ${data.savedPercent}% of income` : ""}
        </Body>
      </Card>

      <Card title={period === "Month" ? "Expense, last 6 months" : "Expense by month"}>
        <View accessible style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 140 }} accessibilityLabel={data.trend.map((p) => `${shortMonthLabel(p.month)} ${formatBdt(p.expense)}`).join(", ")}>
          {data.trend.map((p) => (
            <View key={p.month} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              {/* Muted bars still stand out from the card (3:1), and the chosen month is rust. */}
              <View style={{ width: "70%", height: Math.max(2, (p.expense * 110) / maxTrend), borderRadius: 6, backgroundColor: p.month === highlight ? c.expense : c.muted }} />
              <Text style={{ color: c.muted, fontSize: 11 }}>{shortMonthLabel(p.month).slice(0, 3)}</Text>
            </View>
          ))}
        </View>
      </Card>

      <CategoryCard title="Spending by category" totals={data.spending} whole={data.expense} tone="expense" month={period === "Month" ? month : null} />
      <CategoryCard title="Income by category" totals={data.earning} whole={data.income} tone="income" month={period === "Month" ? month : null} />

      {budgets.length ? (
        <Card title="Budgets" action={{ label: "All", onPress: () => router.push("/budgets") }}>
          {budgets.map((b) => (
            <View key={b.id} style={{ gap: 6 }}>
              <Text style={{ color: c.text, fontWeight: "700" }}>
                {b.name} · {formatBdt(b.spent)} of {formatBdt(b.amount)}
              </Text>
              <Bar percent={b.percent} tone={b.status === "Over" ? "expense" : b.status === "Near" ? "neutral" : "income"} />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function CategoryCard({ title, totals, whole, tone, month }: { title: string; totals: CategoryTotal[]; whole: number; tone: "income" | "expense"; month: string | null }) {
  const c = useColors();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card title={title}>
      {totals.length === 0 ? <Body muted>Nothing recorded.</Body> : null}
      {totals.map((t) => {
        const key = t.categoryId ?? "none";
        return (
          <View key={key} style={{ gap: 6 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === key }} onPress={() => setOpen(open === key ? null : key)} android_ripple={{ color: c.ripple }} style={{ flexDirection: "row", gap: 8, minHeight: 48, alignItems: "center", marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 12, overflow: "hidden" }}>
              <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontWeight: "700" }}>
                {t.name} · {whole ? Math.round((t.amount * 100) / whole) : 0}%
              </Text>
              <Money amount={t.amount} tone={tone} />
            </Pressable>
            <Bar percent={whole ? (t.amount * 100) / whole : 0} tone={tone === "expense" ? "expense" : "income"} />
            {open === key ? (
              <View style={{ paddingLeft: 12, gap: 4 }}>
                {t.children.map((ch) => (
                  <View key={ch.categoryId} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: c.muted }}>{ch.name}</Text>
                    <Money amount={ch.amount} />
                  </View>
                ))}
                {t.categoryId && month ? (
                  <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/history", params: { categoryId: t.categoryId!, month } })} style={{ minHeight: 48, justifyContent: "center" }}>
                    <Text style={{ color: c.primary, fontWeight: "700" }}>See these transactions</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}
