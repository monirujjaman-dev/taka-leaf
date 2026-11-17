import { formatBdt, formatRate } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { dateLabel, localDate } from "../src/data/calendar";
import { loanDetail, undoLastEmi, type ScheduleRow } from "../src/data/loans";
import { db } from "../src/db/client";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Body, Button, Card, ConfirmButton, ErrorText, HeaderButton, Money, Notice, Row, Screen } from "../src/ui/kit";
import { dueInWords, Fact, Pill, Progress } from "../src/ui/loanParts";
import { useColors } from "../src/ui/theme";

const STATUS: Record<ScheduleRow["status"], string> = { Paid: "Paid", PaidBefore: "Paid before", Due: "Due", Upcoming: "Upcoming" };

export default function BankLoan() {
  const c = useColors();
  const { changed } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useData(() => loanDetail(db, id), [id]);
  const [all, setAll] = useState(false);
  const { errors, run } = useErrors();
  if (!detail) {
    return (
      <Screen title="Loan" back>
        <Body muted>This loan is no longer here.</Body>
      </Screen>
    );
  }
  const { loan, card } = detail;
  const isCard = loan.type === "CardEmi";
  const pay = (mode: "emi" | "extra" | "settle") => router.push({ pathname: "/bank-loan-pay", params: { id: loan.id, mode } });
  const rows = all ? detail.schedule : detail.schedule.filter((r) => r.status === "Due" || r.status === "Paid").slice(0, 6);
  const canUndo = detail.activity.some((t) => t.loanEmi != null);

  return (
    <Screen title={loan.name} back right={<HeaderButton icon="pencil-outline" label="Edit loan" onPress={() => router.push({ pathname: "/bank-loan-edit", params: { id: loan.id } })} />}>
      <Card>
        <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>{[isCard ? "Credit card EMI" : "Bank loan", isCard ? loan.payFromWalletName : loan.lender].filter(Boolean).join(" · ")}</Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>{isCard ? "Still to be billed" : "Left to pay"}</Text>
        <Money amount={loan.outstanding} tone="expense" size={28} />
        <Progress loan={loan} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Fact label={isCard ? "Each month" : "EMI"} value={formatBdt(loan.emi)} />
          <Fact label="Rate" value={formatRate(loan.ratePoints)} />
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Fact label="Interest paid so far" value={formatBdt(loan.interestPaid)} />
          <Fact label="Interest still to come" value={formatBdt(loan.interestLeft)} />
        </View>
        {loan.endsOn ? <Body muted>{`${isCard ? "Last bill" : "Last EMI"} ${dateLabel(loan.endsOn)} · ${loan.left} left`}</Body> : null}
        {loan.closed ? <Pill label={loan.closedOn ? `Closed ${dateLabel(loan.closedOn)}` : "Paid off"} tone="income" /> : null}
      </Card>

      {loan.next ? (
        <Card title={isCard ? "Next bill" : "Next EMI"}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{`No. ${loan.next.number} · ${dateLabel(loan.next.dueDate)}`}</Text>
            <Pill label={dueInWords(loan.next.dueDate)} tone={loan.next.overdue ? "expense" : "muted"} />
          </View>
          <Money amount={loan.next.total} size={22} />
          <Body muted>{`Principal ${formatBdt(loan.next.principal)} · Interest ${formatBdt(loan.next.interest)}`}</Body>
          {isCard || loan.autoRecord ? (
            <Notice>{isCard ? "Added to the card automatically on the day." : "Recorded automatically on the day."}</Notice>
          ) : (
            <Button label="Record EMI" icon="check" onPress={() => pay("emi")} />
          )}
        </Card>
      ) : null}

      {card ? (
        <Card title={card.cardName}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Fact label="Card balance (spent)" value={formatBdt(card.spent)} />
            <Fact label="Held for EMIs" value={formatBdt(card.held)} />
          </View>
          {card.available != null ? <Fact label="You can still spend" value={formatBdt(card.available)} /> : null}
        </Card>
      ) : null}

      {!loan.closed ? (
        <Card>
          {!isCard ? <Button kind="secondary" label="Pay extra" icon="cash-plus" onPress={() => pay("extra")} /> : null}
          <Button kind="secondary" label={isCard ? "Pay off the rest now" : "Close the loan early"} icon="flag-checkered" onPress={() => pay("settle")} />
          <Body muted>{isCard ? "Bills everything left to the card now." : "Pays what is left, plus the bank's settlement charge, and marks the loan closed."}</Body>
        </Card>
      ) : null}

      <Card title={isCard ? "Instalments" : "Schedule"} action={detail.schedule.length > rows.length || all ? { label: all ? "Show fewer" : "Show all", onPress: () => setAll(!all) } : undefined}>
        {rows.map((r) => (
          <Row
            key={r.number}
            dim={r.status === "Upcoming" || r.status === "PaidBefore"}
            icon={r.status === "Paid" || r.status === "PaidBefore" ? "check-circle-outline" : r.status === "Due" ? "clock-outline" : "circle-outline"}
            title={`No. ${r.number} · ${dateLabel(r.dueDate)}`}
            detail={[STATUS[r.status], r.paidAt ? dateLabel(localDate(r.paidAt)) : null, r.paidFrom, `interest ${formatBdt(r.interest)}`].filter(Boolean).join(" · ")}
            right={<Money amount={r.total} />}
          />
        ))}
        {canUndo && !loan.closed ? (
          <ConfirmButton label="Undo the last EMI" confirmLabel="Yes, undo it" onConfirm={() => run(() => undoLastEmi(db, loan.id)) && changed()} />
        ) : null}
        {errors.loan ? <ErrorText>{errors.loan}</ErrorText> : null}
      </Card>

      {detail.activity.length ? (
        <Card title="Activity">
          {detail.activity.slice(0, 12).map((t) => (
            <Row
              key={t.id}
              title={t.note ?? t.loanPart ?? "Payment"}
              detail={[dateLabel(localDate(t.occurredAt)), t.fromWalletName].filter(Boolean).join(" · ")}
              right={<Money amount={t.amount} tone={t.loanPart === "Interest" || t.loanPart === "Fee" || t.loanPart === "Purchase" ? "expense" : "neutral"} />}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
