import { formatBdt } from "@takaleaf/shared";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { dayLabel, monthLabel, monthOf, monthRange, shiftMonth, today } from "../../src/data/calendar";
import { categoryTree } from "../../src/data/categories";
import { groupByDay, history } from "../../src/data/transactions";
import { ownWallets } from "../../src/data/wallets";
import type { TransactionType } from "../../src/db/schema";
import { db } from "../../src/db/client";
import { useData } from "../../src/state/AppState";
import { Body, Button, Card, Field, HeaderButton, Money, Picker, Screen, Segmented } from "../../src/ui/kit";
import { TransactionRow } from "../../src/ui/rows";
import { useColors } from "../../src/ui/theme";

const PAGE = 50;

export default function History() {
  const c = useColors();
  const params = useLocalSearchParams<{ categoryId?: string; month?: string; walletId?: string }>();
  const [month, setMonth] = useState(params.month ?? monthOf(today()));
  const [type, setType] = useState<TransactionType | "All">("All");
  const [search, setSearch] = useState("");
  const [walletId, setWalletId] = useState<string | null>(params.walletId ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(params.categoryId ?? null);
  const [filters, setFilters] = useState(Boolean(params.walletId || params.categoryId));
  const [page, setPage] = useState(0);

  const range = monthRange(month);
  const result = useData(
    () => history(db, { ...range, type: type === "All" ? undefined : type, search, walletId: walletId ?? undefined, categoryId: categoryId ?? undefined, limit: PAGE, offset: page * PAGE }),
    [month, type, search, walletId, categoryId, page],
  );
  const wallets = useData(() => ownWallets(db).map((w) => ({ id: w.id, label: w.name })));
  const categories = useData(() =>
    (["Expense", "Income"] as const).flatMap((kind) => categoryTree(db, kind, { includeArchived: true }).flatMap((p) => [{ id: p.id, label: p.name, group: kind }, ...p.children.map((ch) => ({ id: ch.id, label: ch.name, group: p.name }))])),
  );
  const reset = <T,>(set: (v: T) => void) => (v: T) => (set(v), setPage(0));

  return (
    <Screen title="History" right={<HeaderButton icon={filters ? "filter-off-outline" : "filter-outline"} label={filters ? "Hide filters" : "Filters"} onPress={() => setFilters(!filters)} />}>
      <Field label="Search" value={search} onChangeText={reset(setSearch)} placeholder="Note, category or wallet" returnKeyType="search" />
      <Segmented
        label="Type"
        value={type}
        onChange={reset(setType)}
        options={[
          { value: "All", label: "All" },
          { value: "Expense", label: "Expense" },
          { value: "Income", label: "Income" },
          { value: "Transfer", label: "Transfer" },
        ]}
      />
      {filters ? (
        <Card>
          <Picker label="Wallet" options={wallets} value={walletId} onChange={reset(setWalletId)} allowNone="Every wallet" placeholder="Every wallet" />
          <Picker label="Category" options={categories} value={categoryId} onChange={reset(setCategoryId)} allowNone="Every category" placeholder="Every category" />
        </Card>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <HeaderButton icon="chevron-left" label="Previous month" onPress={() => reset(setMonth)(shiftMonth(month, -1))} />
        <Text accessibilityRole="header" style={{ color: c.text, fontWeight: "800", fontSize: 16 }}>
          {monthLabel(month)}
        </Text>
        <HeaderButton icon="chevron-right" label="Next month" onPress={() => reset(setMonth)(shiftMonth(month, 1))} />
      </View>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Body muted>In</Body>
            <Money amount={result.income} tone="income" size={17} />
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Body muted>Out</Body>
            <Money amount={result.expense} tone="expense" size={17} />
          </View>
        </View>
      </Card>
      {result.items.length === 0 ? <Body muted>Nothing matches. Try another month or clear the filters.</Body> : null}
      {groupByDay(result.items).map((group) => (
        <Card key={group.day}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text accessibilityRole="header" style={{ color: c.text, fontWeight: "800" }}>
              {dayLabel(group.day)}
            </Text>
            <Text style={{ color: c.muted }}>{group.net === 0 ? "" : formatBdt(group.net)}</Text>
          </View>
          {group.items.map((t) => (
            <TransactionRow key={t.id} t={t} />
          ))}
        </Card>
      ))}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {page > 0 ? (
          <View style={{ flex: 1 }}>
            <Button kind="secondary" label="Newer" onPress={() => setPage(page - 1)} />
          </View>
        ) : null}
        {(page + 1) * PAGE < result.total ? (
          <View style={{ flex: 1 }}>
            <Button kind="secondary" label="Older" onPress={() => setPage(page + 1)} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
