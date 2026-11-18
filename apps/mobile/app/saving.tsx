import { formatBdt, percent, PRIZES, profit, taxOf } from "@takaleaf/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { dateLabel, localDate } from "../src/data/calendar";
import { payInstalment, payPremium, PRIZE_NAMES, savingDetail, skipInstalment, undoLast, updateSaving, type SavingDetail, type SavingView } from "../src/data/savings";
import { ownWallets } from "../src/data/wallets";
import { db } from "../src/db/client";
import { useApp, useData } from "../src/state/AppState";
import { useErrors } from "../src/ui/form";
import { Bar, Body, Button, Card, ErrorText, HeaderButton, Money, Notice, Picker, Row, Screen, SwitchRow } from "../src/ui/kit";
import { dueInWords, Fact, Pill } from "../src/ui/loanParts";
import { everyWords, premiumWords, termWords, wholeBdt } from "../src/ui/savingParts";
import { useColors } from "../src/ui/theme";

type Act = "profit" | "close" | "early" | "prize" | "bonds" | "sell" | "claim" | "matured";

export default function SavingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useData(() => savingDetail(db, id), [id]);
  if (!detail) {
    return (
      <Screen title="Savings" back>
        <Body muted>This is no longer here.</Body>
      </Screen>
    );
  }
  const s = detail.saving;
  const act = (mode: Act) => () => router.push({ pathname: "/saving-act", params: { id: s.id, mode } });
  const views = { Fdr: FdrView, Dps: DpsView, Certificate: CertificateView, PrizeBond: BondsView, Insurance: PolicyView } as const;
  const View2 = views[s.kind];
  return (
    <Screen
      title={s.name}
      back
      right={
        <View style={{ flexDirection: "row" }}>
          {s.kind === "PrizeBond" && !s.closed ? <HeaderButton icon="plus" label="Add bonds" onPress={act("bonds")} /> : null}
          <HeaderButton icon="pencil-outline" label={`Edit ${s.name}`} onPress={() => router.push({ pathname: "/saving-edit", params: { id: s.id } })} />
        </View>
      }
    >
      <View2 detail={detail} act={act} />
      <Activity detail={detail} />
    </Screen>
  );
}

type ViewProps = { detail: SavingDetail; act: (mode: Act) => () => void };

function Hero({ top, label, value, children }: { top?: string | null; label: string; value: number; children?: ReactNode }) {
  const c = useColors();
  return (
    <Card>
      {top ? <Text style={{ color: c.muted, fontSize: 13, fontWeight: "700" }}>{top}</Text> : null}
      <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      <Money amount={value} size={28} />
      {children}
    </Card>
  );
}

function Progress({ percent: pct, left, right }: { percent: number; left: string; right: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`${left}. ${right}`}>
      <Bar percent={pct} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: c.muted, fontSize: 13 }}>{left}</Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>{right}</Text>
      </View>
    </View>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 12 }}>{children}</View>;
}

function Lines({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <Card title={title}>
      {rows.map(([label, value]) => (
        <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, minHeight: 32, alignItems: "center" }}>
          <Body muted>{label}</Body>
          <Text style={{ fontWeight: "700", fontVariant: ["tabular-nums"] }}>{value}</Text>
        </View>
      ))}
    </Card>
  );
}

function useToggle(s: SavingView, key: "autoRecord" | "remind" | "renew") {
  const { changed } = useApp();
  const { errors, run } = useErrors();
  const set = (value: boolean) =>
    run(() =>
      updateSaving(db, s.id, {
        name: s.name, provider: s.provider, payFromWalletId: s.payFromWalletId, amount: null, ratePoints: null, taxPoints: null, chargesPerYear: null,
        maturityAmount: s.maturityAmount, cover: s.cover, policy: s.policy, policyNumber: s.policyNumber, insured: s.insured, nominee: s.nominee, bondNumbers: null,
        autoRecord: key === "autoRecord" ? value : null, remind: key === "remind" ? value : null, renew: key === "renew" ? value : null,
      }),
    ) && changed();
  return { set, error: errors.form ?? errors.saving };
}

function Undo({ s, what }: { s: SavingView; what: string }) {
  const { changed } = useApp();
  const { errors, run } = useErrors();
  return (
    <>
      <Button kind="secondary" label={`Undo the last ${what}`} onPress={() => run(() => undoLast(db, s.id)) && changed()} />
      {errors.saving ? <ErrorText>{errors.saving}</ErrorText> : null}
    </>
  );
}

function Early({ text, label, onPress }: { text: string; label: string; onPress: () => void }) {
  return (
    <Card title="Close it early">
      <Body muted>{text}</Body>
      <Button kind="quietDanger" label={label} onPress={onPress} />
    </Card>
  );
}

function FdrView({ detail, act }: ViewProps) {
  const s = detail.saving;
  const renew = useToggle(s, "renew");
  const gross = profit(s.amount, s.ratePoints, s.everyMonths > 0 ? s.everyMonths : s.months);
  const tax = taxOf(gross, s.taxPoints);
  const duty = s.estimate !== null ? s.balance + gross - tax - s.estimate : 0;
  return (
    <>
      <Hero top={s.provider} label={s.closed ? "Closed" : "In the FDR"} value={s.closed ? 0 : s.balance}>
        {s.closed ? null : <Progress percent={s.daysTotal ? (s.daysDone * 100) / s.daysTotal : 0} left={`${s.daysDone} of ${s.daysTotal} days`} right={s.maturesOn ? `Matures ${dateLabel(s.maturesOn)}` : ""} />}
        <Facts>
          <Fact label="Profit rate" value={`${percent(s.ratePoints)} a year`} />
          <Fact label="Then" value={s.closed ? "Closed" : s.renew ? `Renews for ${termWords(s.months)}` : `Pays into ${s.payFromWalletName ?? "your account"}`} />
        </Facts>
      </Hero>
      {s.closed ? null : (
        <>
          <Lines
            title={s.everyMonths > 0 ? `At maturity · profit ${everyWords(s.everyMonths)}` : "At maturity"}
            rows={[
              [s.everyMonths > 0 ? "Last profit payment" : "Profit", formatBdt(gross)],
              [`Tax at source, ${percent(s.taxPoints)}`, `−${formatBdt(tax)}`],
              ...(duty > 0 ? ([["Excise duty", `−${formatBdt(duty)}`]] as [string, string][]) : []),
              [s.renew ? "Your FDR becomes" : "Into your account", formatBdt(s.estimate ?? 0)],
            ]}
          />
          <Card title={s.maturesOn ? `${s.renew ? "Renews" : "Pays out"} on ${dateLabel(s.maturesOn)}` : "At maturity"}>
            <Body muted>{s.renew ? "On the day we record the profit, the tax and the duty, and start a new term. Change the rate then if the bank gives a new one." : `On the day we record the profit, the tax and the duty, and move it all into ${s.payFromWalletName ?? "your account"}.`}</Body>
            <Button kind="secondary" label={s.renew ? "Pay into account" : "Renew instead"} onPress={() => renew.set(!s.renew)} />
            <Button kind="secondary" label="Change rate" onPress={() => router.push({ pathname: "/saving-edit", params: { id: s.id } })} />
            {renew.error ? <ErrorText>{renew.error}</ErrorText> : null}
          </Card>
          {s.everyMonths > 0 ? <Payments detail={detail} /> : null}
          <Early text="Banks pay a lower rate, or none, if you break an FDR early. Enter what the bank paid you." label="Encash early" onPress={act("early")} />
        </>
      )}
    </>
  );
}

function DpsView({ detail, act }: ViewProps) {
  const c = useColors();
  const { changed } = useApp();
  const s = detail.saving;
  const auto = useToggle(s, "autoRecord");
  const { errors, run } = useErrors();
  const next = s.next;
  const payIn = s.amount * (s.months - s.missedList.length);
  return (
    <>
      <Hero top={s.provider} label={s.closed ? "Closed" : "Paid in so far"} value={s.balance}>
        <Progress percent={s.total ? (s.done * 100) / s.total : 0} left={`${s.done} of ${s.total} instalments`} right={s.maturesOn ? `Matures ${dateLabel(s.maturesOn)}` : ""} />
        <Facts>
          <Fact label="Each month" value={wholeBdt(s.amount)} />
          <Fact label="Profit rate" value={`${percent(s.ratePoints)} a year`} />
          <Fact label="At maturity, about" value={wholeBdt(s.estimate ?? 0)} />
        </Facts>
      </Hero>
      {next && !s.closed ? (
        next.action === "Close" ? (
          <Card title={`Matured on ${dateLabel(next.date)}`}>
            <Body muted>Every instalment is in. Record what reached your account; the profit and the tax taken are worked out from it.</Body>
            <Button label="Record what the bank paid" onPress={act("close")} />
          </Card>
        ) : (
          <Card>
            <Row icon="calendar-clock" title={`${next.label} · ${dateLabel(next.date)}`} detail={`${dueInWords(next.date)} · from ${s.payFromWalletName ?? "your account"}`} right={<Money amount={s.amount} tone={next.overdue ? "expense" : "neutral"} />} />
            <SwitchRow label="The bank takes it automatically" detail="Recorded on the day, like your EMIs" value={s.autoRecord} onChange={auto.set} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button kind="secondary" label="Record now" onPress={() => run(() => payInstalment(db, s.id, { occurredAt: new Date().toISOString() })) && changed()} />
              </View>
              <View style={{ flex: 1 }}>
                <Button kind="secondary" label="Missed it" onPress={() => run(() => skipInstalment(db, s.id)) && changed()} />
              </View>
            </View>
            {errors.saving || errors.walletId || auto.error ? <ErrorText>{errors.saving ?? errors.walletId ?? auto.error}</ErrorText> : null}
          </Card>
        )
      ) : null}
      <Card title="Instalments">
        <View accessible accessibilityLabel={`${s.done} of ${s.total} instalments paid${next?.number ? `; instalment ${next.number} is next` : ""}`} style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
          {detail.schedule.map((r) => (
            <View
              key={r.number}
              style={{
                width: "6.9%",
                height: 18,
                borderRadius: 5,
                backgroundColor: r.status === "Paid" || r.status === "PaidBefore" ? c.primary : r.status === "Due" ? "transparent" : r.status === "Missed" ? "transparent" : c.track,
                borderWidth: r.status === "Due" || r.status === "Missed" ? 2 : 0,
                borderColor: r.status === "Missed" ? c.expense : c.primary,
              }}
            />
          ))}
        </View>
        <Body muted>Filled: paid · outlined: next{s.missedList.length ? " · red outline: missed" : ""} · one row = a year</Body>
      </Card>
      <Lines
        title="At maturity · from your DPS book"
        rows={[["You pay in", wholeBdt(payIn)], ["Profit, before tax", wholeBdt(Math.max((s.estimate ?? 0) - payIn, 0))], [s.maturityAmount ? "Bank's maturity amount" : "Maturity amount, about", wholeBdt(s.estimate ?? 0)]]}
      />
      {s.maturityAmount ? null : <Body muted>Worked out at {percent(s.ratePoints)} compounded monthly. Type the amount from your DPS book (Edit) to use the bank's figure.</Body>}
      {s.closed ? null : (
        <>
          <Early text="Most banks pay little or no profit on a DPS closed early. Enter what was paid to you." label="Close DPS early" onPress={act("early")} />
          {s.done > s.paidBefore ? <Undo s={s} what="instalment" /> : null}
        </>
      )}
    </>
  );
}

function CertificateView({ detail, act }: ViewProps) {
  const s = detail.saving;
  const auto = useToggle(s, "autoRecord");
  const gross = profit(s.amount, s.ratePoints, s.everyMonths > 0 ? s.everyMonths : s.months);
  const tax = taxOf(gross, s.taxPoints);
  const monthsDone = s.daysTotal ? Math.round((s.months * s.daysDone) / s.daysTotal) : 0;
  return (
    <>
      <Hero top={`${s.provider ? `${s.provider} · ` : ""}${termWords(s.months)}`} label={s.closed ? "Closed" : "Invested"} value={s.closed ? 0 : s.balance}>
        {s.closed ? null : <Progress percent={s.daysTotal ? (s.daysDone * 100) / s.daysTotal : 0} left={`${monthsDone} of ${s.months} months`} right={s.maturesOn ? `Matures ${dateLabel(s.maturesOn)}` : ""} />}
        <Facts>
          <Fact label="Profit rate" value={`${percent(s.ratePoints)} a year`} />
          <Fact label={s.everyMonths > 0 ? `Each ${s.everyMonths === 1 ? "month" : `${s.everyMonths} months`}` : "At maturity"} value={formatBdt(gross - tax)} />
          <Fact label="Received so far" value={wholeBdt(s.profitReceived - s.taxTaken)} />
        </Facts>
      </Hero>
      <Lines title={s.everyMonths > 0 ? "Each profit payment" : "Profit at maturity"} rows={[["Profit", formatBdt(gross)], [`Tax at source, ${percent(s.taxPoints)}`, `−${formatBdt(tax)}`], [`Into ${s.payFromWalletName ?? "your account"}`, formatBdt(gross - tax)]]} />
      <Notice>{`Tax at source: ${percent(s.taxPoints)}. 5% while all your certificates together come to ৳5,00,000 or less; above that the rate is 10%.`}</Notice>
      {s.closed ? null : (
        <>
          <SwitchRow label="Record each payment automatically" detail={`On its date, into ${s.payFromWalletName ?? "your account"}`} value={s.autoRecord} onChange={auto.set} />
          {auto.error ? <ErrorText>{auto.error}</ErrorText> : null}
          {s.next?.action === "Record" ? <Button label={`Record ${s.next.label.toLowerCase()}`} onPress={act("profit")} /> : null}
          {s.next?.action === "Close" ? <Button label="Record maturity" onPress={act("close")} /> : null}
        </>
      )}
      <Payments detail={detail} />
      {s.closed ? null : (
        <>
          <Early text="Early encashment pays a lower rate and takes back the extra profit. Enter the amount the bank or post office paid." label="Encash early" onPress={act("early")} />
          {s.done > s.paidBefore ? <Undo s={s} what="profit payment" /> : null}
        </>
      )}
    </>
  );
}

function Payments({ detail }: { detail: SavingDetail }) {
  const [all, setAll] = useState(false);
  const rows = detail.schedule;
  const firstOpen = Math.max(0, rows.findIndex((r) => r.status === "Due" || r.status === "Upcoming"));
  const start = all ? 0 : Math.max(0, firstOpen - 5);
  const shown = all ? rows : rows.slice(start, start + 7);
  return (
    <Card title={`Profit payments · ${detail.saving.done} of ${detail.saving.total}`} action={rows.length > shown.length || all ? { label: all ? "Show fewer" : `All ${rows.length}`, onPress: () => setAll(!all) } : undefined}>
      {shown.map((r) => {
        const paid = r.status === "Paid" || r.status === "PaidBefore";
        return (
          <Row
            key={r.number}
            dim={!paid}
            icon={paid ? "check-circle-outline" : "clock-outline"}
            title={`Profit ${r.number} · ${dateLabel(r.date)}`}
            detail={r.status === "Paid" ? `Into ${r.paidFrom ?? "your account"} · tax ${formatBdt(r.tax)}` : r.status === "PaidBefore" ? "Received before TakaLeaf" : r.status === "Due" ? `Next · ${dueInWords(r.date)}` : r.status === "Missed" ? "Not paid" : "To come"}
            right={<Money amount={r.amount - r.tax} tone={paid ? "income" : "neutral"} />}
          />
        );
      })}
    </Card>
  );
}

function BondsView({ detail, act }: ViewProps) {
  const c = useColors();
  const s = detail.saving;
  const [all, setAll] = useState(false);
  const prize = detail.activity.find((t) => t.savingPart === "Prize");
  const prizeTax = prize ? detail.activity.find((t) => t.savingPart === "Tax" && t.occurredAt === prize.occurredAt) : undefined;
  const wonNumber = prize?.note?.replace(/^Prize bond /, "");
  const numbers = all ? s.bondList : s.bondList.slice(0, 6);
  return (
    <>
      <Hero label={s.closed ? "Sold back" : `${s.bondCount} bonds`} value={s.balance}>
        <Facts>
          <Fact label="Face value" value="৳100 each" />
          <Fact label="Won so far" value={`${wholeBdt(s.profitReceived - s.taxTaken)} after tax`} />
        </Facts>
        {s.nextDraw && !s.closed ? (
          <Notice>{`Next draw · ${dateLabel(s.nextDraw)}. ${s.bondsInDraw === s.bondCount ? `All ${s.bondCount} are in it.` : `${s.bondsInDraw} of ${s.bondCount} are in it.`} Bonds bought less than 60 days before a draw wait for the next one.`}</Notice>
        ) : null}
      </Hero>
      <Card title="Your numbers" action={s.bondList.length > 6 ? { label: all ? "Show fewer" : `See all ${s.bondList.length}`, onPress: () => setAll(!all) } : undefined}>
        {s.bondList.length === 0 ? <Body muted>Add the numbers (Edit) to check each draw's result here.</Body> : null}
        <View accessibilityLabel="Your bond numbers" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {numbers.map((n) => (
            <View key={n} style={{ width: "48%", borderRadius: 14, borderWidth: n === wonNumber ? 2 : 1, borderColor: n === wonNumber ? "#B07A10" : c.border, padding: 10 }}>
              <Text style={{ color: c.text, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{n}</Text>
              {n === wonNumber && prize ? <Text style={{ color: "#B07A10", fontSize: 12, fontWeight: "800" }}>Won {wholeBdt(prize.amount)}</Text> : null}
            </View>
          ))}
        </View>
      </Card>
      {s.closed ? null : (
        <Card title="Did a number win?">
          <Body muted>Draws are on 31 Jan, 30 Apr, 31 Jul and 31 Oct. Check the Bangladesh Bank result, then record the prize here.</Body>
          <Button label="I won a prize" icon="trophy-outline" onPress={act("prize")} />
          <Button kind="secondary" label="Sell back" onPress={act("sell")} />
        </Card>
      )}
      {prize ? (
        <Lines
          title="Last win"
          rows={[[`${wonNumber ?? "Prize"} · ${dateLabel(localDate(prize.occurredAt))}`, formatBdt(prize.amount)], ["Tax at source", `−${formatBdt(prizeTax?.amount ?? 0)}`], [`Into ${prize.toWalletName ?? "your account"}`, formatBdt(prize.amount - (prizeTax?.amount ?? 0))]]}
        />
      ) : null}
      <Lines title="Prizes in each draw, per series" rows={PRIZES.map((p, i) => [`${PRIZE_NAMES[i]} prize`, wholeBdt(p)] as [string, string])} />
      <Body muted>Prize money is income under Prize bond prize; the tax taken is an expense under Tax at source. Selling back returns ৳100 a bond.</Body>
    </>
  );
}

function PolicyView({ detail, act }: ViewProps) {
  const { changed } = useApp();
  const s = detail.saving;
  const remind = useToggle(s, "remind");
  const wallets = useData(() => ownWallets(db, { includeArchived: false }));
  const [walletId, setWalletId] = useState<string | null>(s.payFromWalletId);
  const { errors, run } = useErrors();
  const next = s.next;
  const paid = detail.schedule.filter((r) => r.status === "Paid").sort((a, b) => b.number - a.number);
  const before = detail.schedule.filter((r) => r.status === "PaidBefore").length;
  return (
    <>
      <Hero top={[s.provider, s.policy ? `${s.policy.toLowerCase()} policy` : null, s.months ? termWords(s.months) : null].filter(Boolean).join(" · ")} label={s.policy === "Life" ? "Sum assured" : "Cover"} value={s.cover ?? 0}>
        {s.total ? <Progress percent={(s.done * 100) / s.total} left={`${s.done} of ${s.total} premiums paid`} right={s.maturesOn ? `Matures ${dateLabel(s.maturesOn)}` : ""} /> : null}
        <Facts>
          <Fact label="Premium" value={`${wholeBdt(s.amount)} ${premiumWords(s.everyMonths)}`} />
          <Fact label="Paid so far" value={wholeBdt(s.paidSoFar)} />
        </Facts>
      </Hero>
      {next && !s.closed ? (
        <Card>
          <Row icon="calendar-clock" title={`${next.label} · ${dateLabel(next.date)}`} detail={`${dueInWords(next.date)}${s.graceEnds ? ` · grace period to ${dateLabel(s.graceEnds)}` : ""}`} right={<Money amount={s.amount} tone={next.overdue ? "expense" : "neutral"} />} />
          <Picker label="Pay from" options={wallets.map((w) => ({ id: w.id, label: w.name, detail: formatBdt(w.balance) }))} value={walletId} onChange={setWalletId} error={errors.walletId} />
          <Button label="Pay premium" onPress={() => run(() => payPremium(db, s.id, { walletId, occurredAt: new Date().toISOString() })) && changed()} />
          {errors.saving ? <ErrorText>{errors.saving}</ErrorText> : null}
        </Card>
      ) : null}
      {s.closed ? null : <SwitchRow label="Remind me 7 days before" detail="On Home, with the amount" value={s.remind} onChange={remind.set} />}
      <Lines
        title="Policy"
        rows={[
          ...(s.policyNumber ? ([["Policy number", s.policyNumber]] as [string, string][]) : []),
          ...(s.insured ? ([["Insured", s.insured]] as [string, string][]) : []),
          ...(s.nominee ? ([["Nominee", s.nominee]] as [string, string][]) : []),
          ["Started", dateLabel(s.startDate)],
          ["Counts as", `Insurance${s.policy && s.policy !== "Other" ? ` · ${s.policy}` : ""}`],
        ]}
      />
      <Card title="Premiums paid">
        {paid.map((r) => (
          <Row key={r.number} icon="check-circle-outline" title={`Premium ${r.number} · ${dateLabel(r.date)}`} detail={`From ${r.paidFrom ?? "your account"}`} right={<Money amount={r.amount} />} />
        ))}
        {before > 0 ? <Row dim icon="check-circle-outline" title={`Premiums ${before === 1 ? "1" : `1–${before}`}`} detail="Paid before you started TakaLeaf" right={<Money amount={before * s.amount} />} /> : null}
        {paid.length === 0 && before === 0 ? <Body muted>No premium recorded yet.</Body> : null}
      </Card>
      {s.closed ? null : (
        <>
          <Card title="Money from the policy">
            <Body muted>A claim, a survival benefit or the maturity amount is recorded as income into the account it was paid to.</Body>
            <Button kind="secondary" label="Got a claim" onPress={act("claim")} />
            <Button kind="secondary" label="Matured" onPress={act("matured")} />
          </Card>
          {paid.length > 0 ? <Undo s={s} what="premium" /> : null}
        </>
      )}
    </>
  );
}

function Activity({ detail }: { detail: SavingDetail }) {
  if (detail.activity.length === 0) return null;
  return (
    <Card title="Activity">
      {detail.activity.slice(0, 15).map((t) => (
        <Row
          key={t.id}
          title={t.note ?? t.categoryName ?? t.type}
          detail={[dateLabel(localDate(t.occurredAt)), t.categoryName, t.type === "Income" ? t.toWalletName : t.fromWalletName].filter(Boolean).join(" · ")}
          right={<Money amount={t.amount} tone={t.type === "Income" ? "income" : t.type === "Expense" ? "expense" : "neutral"} />}
        />
      ))}
    </Card>
  );
}
