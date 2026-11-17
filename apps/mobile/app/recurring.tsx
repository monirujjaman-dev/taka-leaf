import { router } from "expo-router";
import { View } from "react-native";
import { dateLabel, today } from "../src/data/calendar";
import { dueCount, dueRules, ended, listRules, recordNext, scheduleLabel, skipNext } from "../src/data/recurring";
import { listWallets } from "../src/data/wallets";
import { db } from "../src/db/client";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Body, Button, Card, Empty, ErrorText, HeaderButton, Money, Row, Screen } from "../src/ui/kit";

export default function Recurring() {
  const { changed } = useApp();
  const rules = useData(() => listRules(db));
  const due = useData(() => dueRules(db));
  const names = useData(() => new Map(listWallets(db).map((w) => [w.id, w.name])));
  const { errors, run } = useErrors();
  const day = today();
  const tone = (type: string) => (type === "Income" ? "income" : type === "Expense" ? "expense" : "neutral") as "income" | "expense" | "neutral";

  return (
    <Screen title="Recurring" back right={<HeaderButton icon="plus" label="Add recurring" onPress={() => router.push("/rule")} />}>
      {due.length ? (
        <Card title="Waiting for you">
          {errors.form || errors.rule ? <ErrorText>{errors.form ?? errors.rule}</ErrorText> : null}
          {due.map((rule) => (
            <View key={rule.id} style={{ gap: 8 }}>
              <Row icon="calendar-clock" title={rule.note ?? rule.type} detail={`Due ${dateLabel(rule.nextDate)}${dueCount(rule, day) > 1 ? ` · ${dueCount(rule, day)} dates` : ""}`} right={<Money amount={rule.amount} tone={tone(rule.type)} />} />
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
      {rules.length === 0 ? <Empty title="Nothing repeats yet" detail="Rent, salary, subscriptions: add them once and TakaLeaf reminds you." action={{ label: "Add recurring", onPress: () => router.push("/rule") }} /> : null}
      {rules.length ? (
        <Card title="All">
          {rules.map((rule) => {
            const wallets = [rule.fromWalletId ? `From ${names.get(rule.fromWalletId) ?? "?"}` : null, rule.toWalletId ? `Into ${names.get(rule.toWalletId) ?? "?"}` : null].filter(Boolean).join(" · ");
            const state = rule.paused ? "Paused" : ended(rule) ? "Ended" : `Next ${dateLabel(rule.nextDate)}`;
            return (
              <Row
                key={rule.id}
                icon="calendar-sync-outline"
                dim={rule.paused || ended(rule)}
                title={rule.note ?? rule.type}
                detail={`${scheduleLabel(rule)} · ${state} · ${wallets} · ${rule.autoRecord ? "Automatic" : "Ask me"}`}
                onPress={() => router.push({ pathname: "/rule", params: { id: rule.id } })}
                right={<Money amount={rule.amount} tone={tone(rule.type)} />}
              />
            );
          })}
        </Card>
      ) : null}
      <Body muted>Automatic ones are recorded by your server on their date; the phone shows them after the next sync.</Body>
    </Screen>
  );
}
