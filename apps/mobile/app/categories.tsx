import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { categoryTree } from "../src/data/categories";
import type { CategoryKind } from "../src/db/schema";
import { db } from "../src/db/client";
import { useData } from "../src/state/AppState";
import { Card, Chip, HeaderButton, Screen, Segmented, SwitchRow } from "../src/ui/kit";
import { useColors } from "../src/ui/theme";

export default function Categories() {
  const c = useColors();
  const [kind, setKind] = useState<CategoryKind>("Expense");
  const [archived, setArchived] = useState(false);
  const tree = useData(() => categoryTree(db, kind, { includeArchived: archived }), [kind, archived]);
  const open = (id: string) => router.push({ pathname: "/category", params: { id } });

  return (
    <Screen title="Categories" back right={<HeaderButton icon="plus" label="Add a category" onPress={() => router.push({ pathname: "/category", params: { kind } })} />}>
      <Segmented label="Kind" value={kind} onChange={setKind} options={[{ value: "Expense", label: "Expense" }, { value: "Income", label: "Income" }]} />
      {tree.map((parent) => (
        <Card key={parent.id} title={parent.archived ? `${parent.name} (archived)` : parent.name} action={{ label: "Edit", onPress: () => open(parent.id) }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {parent.children.map((child) => (
              <Chip key={child.id} label={child.archived ? `${child.name} (archived)` : child.name} selected={false} onPress={() => open(child.id)} />
            ))}
            <Chip label="+ Sub-category" selected={false} onPress={() => router.push({ pathname: "/category", params: { kind, parentId: parent.id } })} />
          </View>
        </Card>
      ))}
      {tree.length === 0 ? <Text style={{ color: c.muted }}>No categories yet.</Text> : null}
      <SwitchRow label="Show archived" value={archived} onChange={setArchived} />
    </Screen>
  );
}
