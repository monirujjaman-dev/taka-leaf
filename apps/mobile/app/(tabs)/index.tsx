import { formatBdt } from "@takaleaf/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { monthOf, shiftMonth, shortMonthLabel, today } from "../../src/data/calendar";
import { dashboard } from "../../src/data/dashboard";
import { dueEmis } from "../../src/data/loans";
import { dueSavings } from "../../src/data/savings";
import { kindIcon, nextDetail } from "../../src/ui/savingParts";
import { recordNext, scheduleLabel, skipNext } from "../../src/data/recurring";
import { db } from "../../src/db/client";
import { useApp, useData } from "../../src/state/AppState";
import { useErrors } from "../../src/ui/form";
import { Bar, Body, Button, Card, Empty, ErrorText, HeaderButton, Icon, Money, Row, Screen } from "../../src/ui/kit";
import { LeafMark, LeafWatermark } from "../../src/ui/LeafMark";
import { dueInWords } from "../../src/ui/loanParts";
import { SyncLine, TransactionRow } from "../../src/ui/rows";
import { useColors } from "../../src/ui/theme";

export default function Dashboard() {
  const c = useColors();
  const { user, syncNow, changed } = useApp();
  const [month, setMonth] = useState(() => monthOf(today()));
  const data = useData(() => dashboard(db, month), [month]);
  const emis = useData(() => dueEmis(db));
  const savingsDue = useData(() => dueSavings(db));
  const { errors, run } = useErrors();
  const current = monthOf(today());

  return (
    <Screen
      title={user?.name ? `Hi, ${user.name.split(" ")[0]}` : "TakaLeaf"}
      right={<HeaderButton icon="refresh" label="Sync now" onPress={() => void syncNow()} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <LeafMark size={26} />
        <View style={{ flex: 1 }}>
          <SyncLine />
        </View>
      </View>

      <View
        accessible
        accessibilityLabel={`Net balance ${formatBdt(data.summary.net)}. Assets ${formatBdt(data.summary.assets)}. Liabilities ${formatBdt(data.summary.liabilities)}.`}
        style={{ minHeight: 148, borderRadius: 26, padding: 20, justifyContent: "space-between", overflow: "hidden", backgroundColor: c.hero, elevation: 6 }}
      >
        <LeafWatermark />
        <View>
          <Text style={{ color: c.onHeroMuted, fontSize: 13, fontWeight: "600" }}>Net balance</Text>
          <Text style={{ color: c.onHero, fontSize: 34, fontWeight: "800", letterSpacing: -0.8, marginTop: 4, fontVariant: ["tabular-nums"] }} numberOfLines={1} adjustsFontSizeToFit>
            {formatBdt(data.summary.net)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 32, marginTop: 12 }}>
          <View>
            <Text style={{ color: c.onHeroMuted, fontSize: 12, fontWeight: "600" }}>Assets</Text>
            <Text style={{ color: c.onHero, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{formatBdt(data.summary.assets)}</Text>
          </View>
          <View>
            <Text style={{ color: c.onHeroMuted, fontSize: 12, fontWeight: "600" }}>Liabilities</Text>
            <Text style={{ color: c.onHero, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{formatBdt(data.summary.liabilities)}</Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <HeaderButton icon="chevron-left" label="Previous month" onPress={() => setMonth(shiftMonth(month, -1))} />
        <Text accessibilityRole="header" style={{ color: c.text, fontWeight: "800", fontSize: 16 }}>
          {shortMonthLabel(month)}
        </Text>
        <HeaderButton icon="chevron-right" label="Next month" disabled={month >= current} onPress={() => setMonth(shiftMonth(month, 1))} />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Tile label="Income" amount={data.income} tone="income" />
        <Tile label="Expense" amount={data.expense} tone="expense" />
        <Tile label="Owed to me" amount={data.summary.owedToMe} onPress={() => router.push("/people")} />
        <Tile label="I owe" amount={data.summary.iOwe} onPress={() => router.push("/people")} />
      </View>

      {data.wallets.length === 0 ? (
        <Empty title="Start by adding your wallets" detail="Cash, bKash, your bank: each with today's balance." action={{ label: "Add a wallet", onPress: () => router.push("/wallet") }} />
      ) : null}

      {data.due.length ? (
        <Card title="Due to record" action={{ label: "Recurring", onPress: () => router.push("/recurring") }}>
          {errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
          {data.due.map((rule) => (
            <View key={rule.id} style={{ gap: 8 }}>
              <Row
                icon="calendar-clock"
                title={rule.note ?? rule.type}
                detail={`${scheduleLabel(rule)} · due ${rule.nextDate}${rule.dueCount > 1 ? ` · ${rule.dueCount} dates` : ""}`}
                right={<Money amount={rule.amount} tone={rule.type === "Income" ? "income" : rule.type === "Expense" ? "expense" : "neutral"} />}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Record" onPress={() => run(() => (recordNext(db, rule.id), changed()))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button kind="secondary" label="Skip" onPress={() => run(() => (skipNext(db, rule.id), changed()))} />
                </View>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {emis.length ? (
        <Card title="EMIs due" action={{ label: "Loans", onPress: () => router.push("/bank-loans") }}>
          {emis.map((l) => (
            <Row
              key={l.id}
              icon="bank-outline"
              title={l.name}
              detail={`EMI ${l.next!.number} · ${dueInWords(l.next!.dueDate)}`}
              onPress={() => router.push({ pathname: "/bank-loan-pay", params: { id: l.id, mode: "emi" } })}
              accessibilityLabel={`Record ${l.name} EMI ${l.next!.number}, ${formatBdt(l.next!.total)}, ${dueInWords(l.next!.dueDate)}`}
              right={<Money amount={l.next!.total} tone={l.next!.overdue ? "expense" : "neutral"} />}
            />
          ))}
        </Card>
      ) : null}

      {savingsDue.length ? (
        <Card title="Savings and premiums due" action={{ label: "Savings", onPress: () => router.push("/savings") }}>
          {savingsDue.map((s) => (
            <Row
              key={s.id}
              icon={kindIcon(s.kind, s.policy)}
              title={`${s.name} · ${dueInWords(s.next!.date)}`}
              detail={nextDetail(s)}
              onPress={() => router.push({ pathname: "/saving", params: { id: s.id } })}
              right={s.next!.amount !== null ? <Money amount={s.next!.amount} tone={s.next!.overdue ? "expense" : "neutral"} /> : undefined}
            />
          ))}
        </Card>
      ) : null}

      {data.wallets.length ? (
        <Card title="Wallets" action={{ label: "All", onPress: () => router.push("/wallets") }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {data.wallets.map((w) => (
              <Pressable key={w.id} accessibilityRole="button" accessibilityLabel={`${w.name} ${formatBdt(w.balance)}`} onPress={() => router.push({ pathname: "/wallet", params: { id: w.id } })} android_ripple={{ color: c.ripple }} style={{ minWidth: 140, padding: 14, borderRadius: 18, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 4 }}>
                <Text numberOfLines={1} style={{ color: c.muted, fontWeight: "700" }}>
                  {w.name}
                </Text>
                <Money amount={w.balance} tone={w.balance < 0 ? "expense" : "neutral"} size={17} />
              </Pressable>
            ))}
          </ScrollView>
        </Card>
      ) : null}

      <Card title="Recent" action={{ label: "History", onPress: () => router.push("/history") }}>
        {data.recent.length ? data.recent.map((t) => <TransactionRow key={t.id} t={t} />) : <Body muted>Nothing recorded yet. Tap + to add your first expense.</Body>}
      </Card>

      {data.budgets.length ? (
        <Card title="Budgets" action={{ label: "All", onPress: () => router.push("/budgets") }}>
          {data.budgets.slice(0, 4).map((b) => (
            <View key={b.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text numberOfLines={1} style={{ color: c.text, fontWeight: "700", flex: 1 }}>
                  {b.name}
                </Text>
                <Text style={{ color: b.status === "Over" ? c.expense : c.muted }}>
                  {b.status === "Over" ? `Over by ${formatBdt(-b.remaining)}` : `${formatBdt(b.remaining)} left`} · {b.percent}%
                </Text>
              </View>
              <Bar percent={b.percent} tone={b.status === "Over" ? "expense" : b.status === "Near" ? "neutral" : "income"} />
            </View>
          ))}
        </Card>
      ) : null}

      {data.spending.length ? (
        <Card title="Spending by category" action={{ label: "Reports", onPress: () => router.push("/reports") }}>
          {data.spending.slice(0, 6).map((s) => (
            <View key={s.categoryId ?? "none"} style={{ gap: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <Text numberOfLines={1} style={{ color: c.text, fontWeight: "700", flex: 1 }}>
                  {s.name}
                </Text>
                <Money amount={s.amount} />
              </View>
              <Bar percent={data.expense ? (s.amount * 100) / data.expense : 0} tone="expense" />
            </View>
          ))}
        </Card>
      ) : null}
      <View style={{ alignItems: "center" }}>
        <Icon name="leaf" size={16} color={c.muted} />
      </View>
    </Screen>
  );
}

function Tile({ label, amount, tone = "neutral", onPress }: { label: string; amount: number; tone?: "income" | "expense" | "neutral"; onPress?: () => void }) {
  const c = useColors();
  // Two by two, or one per row once the phone's text is large (the web does the same under 320 px).
  const wide = useWindowDimensions().fontScale >= 1.3;
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label} ${formatBdt(amount)}`}
      onPress={onPress}
      android_ripple={onPress ? { color: c.ripple } : undefined}
      style={{ width: wide ? "100%" : "48.5%", padding: 14, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: c.border, backgroundColor: c.glass, gap: 4 }}
    >
      <Text style={{ color: c.muted, fontWeight: "700" }}>{label}</Text>
      <Money amount={amount} tone={tone} size={17} />
    </Pressable>
  );
}
