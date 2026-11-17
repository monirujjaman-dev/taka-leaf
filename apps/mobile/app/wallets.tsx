import { formatBdt } from "@takaleaf/shared";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { listWallets, summarize, type WalletWithBalance, isOwnWallet } from "../src/data/wallets";
import { db } from "../src/db/client";
import { useData } from "../src/state/AppState";
import { Body, Card, Empty, HeaderButton, Money, Row, Screen, SwitchRow, type IconName } from "../src/ui/kit";

const GROUPS: { title: string; types: WalletWithBalance["type"][]; icon: IconName }[] = [
  { title: "Cash and bank", types: ["Cash", "Bank"], icon: "wallet-outline" },
  { title: "Mobile banking", types: ["Mfs"], icon: "cellphone" },
  { title: "Credit card", types: ["CreditCard"], icon: "credit-card-outline" },
];

export default function Wallets() {
  const [showArchived, setShowArchived] = useState(false);
  const all = useData(() => listWallets(db));
  const summary = summarize(all);
  const shown = all.filter((w) => showArchived || !w.archived);
  const own = shown.filter((w) => isOwnWallet(w.type));
  const loanLeft = all.filter((w) => w.type === "Loan" && w.balance < 0).reduce((s, w) => s - w.balance, 0);

  return (
    <Screen title="Wallets" back right={<HeaderButton icon="plus" label="Add a wallet" onPress={() => router.push("/wallet")} />}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1 }}>
          <Body muted>Assets</Body>
          <Money amount={summary.assets} tone="income" size={17} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Body muted>Liabilities</Body>
          <Money amount={summary.liabilities} tone="expense" size={17} />
        </Card>
      </View>
      {own.length === 0 ? <Empty title="No wallets yet" detail="Add Cash, bKash and your bank with today's balances." action={{ label: "Add a wallet", onPress: () => router.push("/wallet") }} /> : null}
      {GROUPS.map((group) => {
        const rows = own.filter((w) => group.types.includes(w.type));
        if (!rows.length) return null;
        return (
          <Card key={group.title} title={`${group.title} · ${formatBdt(rows.reduce((s, w) => s + w.balance, 0))}`}>
            {rows.map((w) => (
              <Row
                key={w.id}
                icon={group.icon}
                title={w.name}
                dim={w.archived}
                detail={[w.archived ? "Archived" : null, w.excludedFromTotal ? "Left out of net balance" : null, w.availableCredit != null ? `Credit left ${formatBdt(w.availableCredit)}` : null].filter(Boolean).join(" · ")}
                onPress={() => router.push({ pathname: "/wallet", params: { id: w.id } })}
                right={<Money amount={w.balance} tone={w.balance < 0 ? "expense" : "neutral"} />}
              />
            ))}
          </Card>
        );
      })}
      {loanLeft ? (
        <Card title="Bank loans and card EMIs" action={{ label: "Loans", onPress: () => router.push("/bank-loans") }}>
          <Row icon="bank-outline" title="Left to pay" onPress={() => router.push("/bank-loans")} right={<Money amount={loanLeft} tone="expense" />} />
        </Card>
      ) : null}
      {summary.owedToMe || summary.iOwe ? (
        <Card title="Lending and borrowing" action={{ label: "People", onPress: () => router.push("/people") }}>
          <Row icon="account-arrow-right-outline" title="Lent to others" right={<Money amount={summary.owedToMe} tone="income" />} />
          <Row icon="account-arrow-left-outline" title="Borrowed" right={<Money amount={summary.iOwe} tone="expense" />} />
        </Card>
      ) : null}
      <SwitchRow label="Show archived" value={showArchived} onChange={setShowArchived} />
    </Screen>
  );
}
