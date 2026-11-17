import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { listPeople } from "../src/data/people";
import { db } from "../src/db/client";
import { useData } from "../src/state/AppState";
import { Body, Card, Empty, HeaderButton, Money, Row, Screen, Segmented } from "../src/ui/kit";
import { useColors } from "../src/ui/theme";

export default function People() {
  const c = useColors();
  const [show, setShow] = useState<"All" | "OwesMe" | "IOwe">("All");
  const people = useData(() => listPeople(db));
  const owedToMe = people.reduce((s, p) => s + p.owesMe, 0);
  const iOwe = people.reduce((s, p) => s + p.iOwe, 0);
  const shown = people.filter((p) => (show === "OwesMe" ? p.owesMe > 0 : show === "IOwe" ? p.iOwe > 0 : true));

  return (
    <Screen title="People and loans" back right={<HeaderButton icon="account-plus-outline" label="Add a person" onPress={() => router.push("/person-edit")} />}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1 }}>
          <Body muted>Owed to me</Body>
          <Money amount={owedToMe} tone="income" size={17} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Body muted>I owe</Body>
          <Money amount={iOwe} tone="expense" size={17} />
        </Card>
      </View>
      <Segmented label="Show" value={show} onChange={setShow} options={[{ value: "All", label: "All" }, { value: "OwesMe", label: "Owed to me" }, { value: "IOwe", label: "I owe" }]} />
      {people.length === 0 ? <Empty title="Nobody here yet" detail="Add someone you lend money to or borrow from." action={{ label: "Add a person", onPress: () => router.push("/person-edit") }} /> : null}
      {shown.length ? (
        <Card>
          {shown.map((p) => (
            <Row
              key={p.id}
              title={p.name}
              detail={[p.net > 0 ? "Owes you" : p.net < 0 ? "You owe" : "All settled", p.note].filter(Boolean).join(" · ")}
              onPress={() => router.push({ pathname: "/person", params: { id: p.id } })}
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Money amount={p.net} tone={p.net > 0 ? "income" : p.net < 0 ? "expense" : "neutral"} />
                </View>
              }
            />
          ))}
        </Card>
      ) : people.length ? (
        <Text style={{ color: c.muted }}>Nobody in this list.</Text>
      ) : null}
    </Screen>
  );
}
