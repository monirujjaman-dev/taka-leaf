import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { addDays, dateLabel, today } from "../src/data/calendar";
import { comingUp, listSavings, summarizeSavings, type SavingView } from "../src/data/savings";
import type { SavingKind } from "../src/db/schema";
import { db } from "../src/db/client";
import { useData } from "../src/state/AppState";
import { Bar, Body, Card, Chip, Empty, HeaderButton, Money, Row, Screen } from "../src/ui/kit";
import { Fact, Pill } from "../src/ui/loanParts";
import { kindIcon, nextDetail, progress, subtitle, wholeBdt } from "../src/ui/savingParts";
import { useColors } from "../src/ui/theme";

type Show = "All" | SavingKind;
const FILTERS: { value: Show; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Fdr", label: "FDR" },
  { value: "Dps", label: "DPS" },
  { value: "Certificate", label: "Sanchayapatra" },
  { value: "PrizeBond", label: "Prize bonds" },
  { value: "Insurance", label: "Insurance" },
];

const openSaving = (s: SavingView) => router.push({ pathname: "/saving", params: { id: s.id } });

export default function Savings() {
  const c = useColors();
  const [show, setShow] = useState<Show>("All");
  const all = useData(() => listSavings(db));
  const summary = summarizeSavings(all);
  const next = comingUp(all).slice(0, 4);
  const kept = all.filter((s) => s.kind !== "Insurance" && (show === "All" || show === s.kind));
  const policies = all.filter((s) => s.kind === "Insurance" && (show === "All" || show === "Insurance"));
  const add = () => router.push("/saving-edit");

  return (
    <Screen title="Savings and insurance" back right={<HeaderButton icon="plus" label="Add savings or a policy" onPress={add} />}>
      {all.length === 0 ? (
        <Empty title="Nothing saved here yet" detail="Add an FDR, a DPS, a Sanchayapatra, prize bonds or an insurance policy to see what you have, what comes next and the tax taken." action={{ label: "Add savings or a policy", onPress: add }} />
      ) : (
        <>
          <Card>
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>Saved and invested</Text>
            <Money amount={summary.saved} size={28} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Fact label="Deposits (FDR, DPS)" value={wholeBdt(summary.deposits)} />
              <Fact label="Sanchayapatra" value={wholeBdt(summary.certificates)} />
              <Fact label="Prize bonds" value={wholeBdt(summary.prizeBonds)} />
            </View>
          </Card>

          {next.length ? (
            <Card title="Coming up">
              {next.map((s) => (
                <Row
                  key={s.id}
                  icon={kindIcon(s.kind, s.policy)}
                  title={`${dateLabel(s.next!.date)} · ${s.kind === "PrizeBond" ? "Prize bond draw" : s.name}`}
                  detail={`${s.next!.overdue ? "Late · " : ""}${nextDetail(s)}`}
                  onPress={() => openSaving(s)}
                  right={s.next!.amount !== null ? <Money amount={s.next!.amount} /> : <Pill label="Draw" tone="muted" />}
                />
              ))}
            </Card>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel="Show">
            {FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} selected={show === f.value} onPress={() => setShow(f.value)} />
            ))}
          </ScrollView>

          {show !== "Insurance" ? (
            <Card title={`Savings · ${kept.length}`}>
              {kept.length === 0 ? <Body muted>None of this kind.</Body> : null}
              {kept.map((s) => (
                <SavingItem key={s.id} saving={s} />
              ))}
            </Card>
          ) : null}
          {show === "All" || show === "Insurance" ? (
            <Card title={`Insurance · ${wholeBdt(summary.cover)} cover`}>
              {policies.length === 0 ? <Body muted>No policies yet.</Body> : null}
              {policies.map((s) => (
                <Row
                  key={s.id}
                  dim={s.closed}
                  icon={kindIcon(s.kind, s.policy)}
                  title={s.name}
                  detail={[s.provider, s.next ? `${s.policy === "Life" ? "next" : "renews"} ${dateLabel(s.next.date)}` : s.closed ? "Closed" : null].filter(Boolean).join(" · ")}
                  onPress={() => openSaving(s)}
                  right={
                    s.next && s.next.date <= addDays(today(), 30) ? (
                      <Pill label={s.next.overdue ? "Late" : "Due soon"} tone={s.next.overdue ? "expense" : "muted"} />
                    ) : s.cover ? (
                      <Money amount={s.cover} />
                    ) : undefined
                  }
                />
              ))}
            </Card>
          ) : null}
          <Body muted>Savings count as assets in your net balance. Profit is income; tax taken at source is an expense under Tax at source. Premiums are an expense under Insurance.</Body>
        </>
      )}
    </Screen>
  );
}

function SavingItem({ saving }: { saving: SavingView }) {
  const c = useColors();
  const p = progress(saving);
  return (
    <View style={{ gap: 8, opacity: saving.closed ? 0.7 : 1 }}>
      <Row icon={kindIcon(saving.kind, saving.policy)} title={saving.name} detail={subtitle(saving)} onPress={() => openSaving(saving)} right={<Money amount={saving.balance} />} />
      {p.percent !== null ? <Bar percent={p.percent} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: c.muted, fontSize: 13, flex: 1 }}>{p.words}</Text>
        {p.pill ? <Pill label={p.pill} tone={saving.next?.overdue ? "expense" : saving.closed ? "income" : "muted"} /> : null}
      </View>
    </View>
  );
}
