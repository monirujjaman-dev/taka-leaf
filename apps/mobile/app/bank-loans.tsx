import { formatBdt } from "@takaleaf/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { today } from "../src/data/calendar";
import { listLoans, summarizeLoans, type LoanView } from "../src/data/loans";
import { db } from "../src/db/client";
import { useData } from "../src/state/AppState";
import { Body, Card, Empty, HeaderButton, Money, Row, Screen, Segmented } from "../src/ui/kit";
import { dueInWords, Fact, nextWords, Pill, Progress } from "../src/ui/loanParts";
import { useColors } from "../src/ui/theme";

type Show = "All" | "Bank" | "CardEmi";

export default function BankLoans() {
  const c = useColors();
  const [show, setShow] = useState<Show>("All");
  const loans = useData(() => listLoans(db));
  const summary = summarizeLoans(loans);
  const open = loans.filter((l) => !l.closed && (show === "All" || l.type === show));
  const closed = loans.filter((l) => l.closed && (show === "All" || l.type === show));
  const add = () => router.push("/bank-loan-edit");
  const dueThisMonth = loans.filter((l) => l.next && !l.closed && l.next.dueDate.slice(0, 7) <= today().slice(0, 7)).reduce((s, l) => s + (l.next?.total ?? 0), 0);

  return (
    <Screen title="Loans" back right={<HeaderButton icon="plus" label="Add a loan" onPress={add} />}>
      {loans.length === 0 ? (
        <Empty title="No loans yet" detail="Add a bank loan or a credit card EMI to see what is left, and record each EMI as principal and interest." action={{ label: "Add a loan", onPress: add }} />
      ) : (
        <>
          <Card>
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>Left to pay on loans</Text>
            <Money amount={summary.outstanding} tone="expense" size={28} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Fact label="Bank loans" value={formatBdt(summary.bank)} />
              <Fact label="Card EMIs" value={formatBdt(summary.cardEmi)} />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Fact label="EMIs due this month" value={dueThisMonth ? formatBdt(dueThisMonth) : "None due"} />
              <Fact label="Interest paid so far" value={formatBdt(summary.interestPaid)} />
            </View>
          </Card>
          <Segmented label="Show" value={show} onChange={setShow} options={[{ value: "All", label: "All" }, { value: "Bank", label: "Bank loans" }, { value: "CardEmi", label: "Card EMIs" }]} />
          {open.length === 0 ? <Body muted>None of this kind.</Body> : null}
          {open.map((l) => (
            <LoanCard key={l.id} loan={l} />
          ))}
          {closed.length ? (
            <Card title="Closed">
              {closed.map((l) => (
                <Row key={l.id} dim icon={l.type === "CardEmi" ? "credit-card-outline" : "bank-outline"} title={l.name} detail={l.closedOn ? `Closed ${l.closedOn}` : "Paid off"} onPress={() => router.push({ pathname: "/bank-loan", params: { id: l.id } })} />
              ))}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function LoanCard({ loan }: { loan: LoanView }) {
  const c = useColors();
  const late = loan.next?.overdue;
  const soon = loan.next && !late && dueInWords(loan.next.dueDate).match(/today|tomorrow|in [1-7] days/);
  return (
    <Card>
      <Row
        icon={loan.type === "CardEmi" ? "credit-card-outline" : "bank-outline"}
        title={loan.name}
        detail={[loan.type === "CardEmi" ? loan.payFromWalletName : loan.lender, loan.autoRecord ? "Automatic" : null].filter(Boolean).join(" · ") || null}
        onPress={() => router.push({ pathname: "/bank-loan", params: { id: loan.id } })}
        accessibilityLabel={`${loan.name}, ${formatBdt(loan.outstanding)} left. ${nextWords(loan)}`}
        right={<Money amount={loan.outstanding} tone="expense" />}
      />
      <Progress loan={loan} />
      {loan.next ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>{nextWords(loan)}</Text>
          {late ? <Pill label={dueInWords(loan.next.dueDate)} tone="expense" /> : soon ? <Pill label={dueInWords(loan.next.dueDate)} tone="muted" /> : null}
        </View>
      ) : null}
    </Card>
  );
}
