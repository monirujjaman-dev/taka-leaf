import { formatBdt } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { dateLabel, localDate } from "../src/data/calendar";
import { loans, personView, type LoanKind } from "../src/data/people";
import { db } from "../src/db/client";
import { useData } from "../src/state/AppState";
import { Body, Button, Card, HeaderButton, Money, Row, Screen } from "../src/ui/kit";
import { useColors } from "../src/ui/theme";

const LABELS: Record<LoanKind, string> = { Lend: "Lent", GotBack: "Got paid back", Borrow: "Borrowed", PaidBack: "Paid back" };

export default function Person() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const person = useData(() => personView(db, id), [id]);
  const history = useData(() => (person ? loans(db, id) : []), [id, person]);
  if (!person) {
    return (
      <Screen title="Person" back>
        <Body muted>This person is no longer here.</Body>
      </Screen>
    );
  }
  const loan = (kind: LoanKind) => router.push({ pathname: "/loan", params: { personId: person.id, kind } });
  const standing = person.net > 0 ? `Owes you ${formatBdt(person.net)}` : person.net < 0 ? `You owe ${formatBdt(-person.net)}` : "All settled";

  return (
    <Screen title={person.name} back right={<HeaderButton icon="pencil-outline" label="Edit person" onPress={() => router.push({ pathname: "/person-edit", params: { id: person.id } })} />}>
      <Card>
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "800", color: person.net > 0 ? c.income : person.net < 0 ? c.expense : c.text }}>
          {standing}
        </Text>
        {person.note ? <Body muted>{person.note}</Body> : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button label="Lend" onPress={() => loan("Lend")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="secondary" label="Got paid back" disabled={person.owesMe <= 0} onPress={() => loan("GotBack")} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button label="Borrow" onPress={() => loan("Borrow")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button kind="secondary" label="Pay back" disabled={person.iOwe <= 0} onPress={() => loan("PaidBack")} />
          </View>
        </View>
      </Card>
      <Card title="History">
        {history.length === 0 ? <Body muted>No loans with {person.name} yet.</Body> : null}
        {history.map((l) => (
          <Row
            key={l.id}
            icon={l.kind === "Lend" || l.kind === "PaidBack" ? "arrow-up-bold-circle-outline" : "arrow-down-bold-circle-outline"}
            title={LABELS[l.kind]}
            detail={[dateLabel(localDate(l.occurredAt)), l.walletName, l.note].filter(Boolean).join(" · ")}
            onPress={() => router.push({ pathname: "/loan", params: { personId: person.id, id: l.id, kind: l.kind } })}
            right={<Money amount={l.amount} tone={l.kind === "Lend" || l.kind === "PaidBack" ? "expense" : "income"} />}
          />
        ))}
      </Card>
    </Screen>
  );
}
