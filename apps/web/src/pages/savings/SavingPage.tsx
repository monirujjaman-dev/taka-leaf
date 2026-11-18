import { formatBdt, percent, PRIZES, profit, taxOf } from "@takaleaf/shared";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useSaving, useSavingAction, useUndoSavingEntry, useUpdateSaving, useWallets } from "../../api/queries";
import type { Saving, SavingDetail, SavingScheduleRow, Transaction } from "../../api/types";
import { Button, focusRing } from "../../ui/Button";
import { ErrorNote, LoadError, Loading, messageOf } from "../../ui/Feedback";
import { SelectField } from "../../ui/Field";
import { localDate, shortDate } from "../../ui/format";
import { Icon, type IconName } from "../../ui/Icon";
import { iconButtonClass, IconTile, LeafWatermark, ListCard } from "../../ui/Parts";
import { pickableWallets, WalletOptions } from "../transactions/pickers";
import { DateBadge, dueInWords, dueLabel, everyWords, HeroBar, HeroStat, Line, minus, Pill, premiumWords, SwitchRow, termWords, wholeBdt } from "./parts";
import { AddBondsForm, CloseForm, EditSavingForm, PayoutForm, PrizeForm, ProfitForm, SellForm } from "./SavingForms";

type Form = "edit" | "profit" | "close" | "early" | "prize" | "bonds" | "sell" | "claim" | "matured" | null;

/** One saving or policy, laid out for its kind as on the design boards. */
export function SavingPage() {
  const { id = "" } = useParams();
  const detail = useSaving(id);
  const [form, setForm] = useState<Form>(null);
  if (detail.isPending) return <Loading />;
  if (detail.error) return <LoadError query={detail} />;
  const { saving } = detail.data;
  const open = (f: Form) => () => setForm(f);
  const close = () => setForm(null);
  const views = { Fdr: FdrView, Dps: DpsView, Certificate: CertificateView, PrizeBond: BondsView, Insurance: PolicyView } as const;
  const View = views[saving.kind];

  return (
    <>
      <div className="mb-3 flex min-h-14 items-center gap-3 lg:mb-5">
        <Link to="/savings" aria-label="Back to savings" className={iconButtonClass}>
          <Icon name="left" size={20} />
        </Link>
        <h1 className="m-0 min-w-0 flex-1 text-xl font-extrabold tracking-tight [overflow-wrap:anywhere] lg:text-headline">{saving.name}</h1>
        {saving.kind === "PrizeBond" && !saving.closed ? (
          <button type="button" aria-label="Add bonds" onClick={open("bonds")} className={iconButtonClass}>
            <Icon name="plus" size={20} />
          </button>
        ) : null}
        <button type="button" aria-label={`Edit ${saving.kind === "Insurance" ? "policy" : saving.name}`} onClick={open("edit")} className={iconButtonClass}>
          <Icon name="edit" size={20} />
        </button>
      </div>
      <View detail={detail.data} open={open} />
      <Activity rows={detail.data.activity} />

      {form === "edit" ? <EditSavingForm saving={saving} onClose={close} /> : null}
      {form === "profit" ? <ProfitForm saving={saving} onClose={close} /> : null}
      {form === "close" || form === "early" ? <CloseForm saving={saving} early={form === "early"} onClose={close} /> : null}
      {form === "prize" ? <PrizeForm saving={saving} onClose={close} /> : null}
      {form === "bonds" ? <AddBondsForm saving={saving} onClose={close} /> : null}
      {form === "sell" ? <SellForm saving={saving} onClose={close} /> : null}
      {form === "claim" || form === "matured" ? <PayoutForm saving={saving} kind={form === "claim" ? "Claim" : "Maturity"} onClose={close} /> : null}
    </>
  );
}

type ViewProps = { detail: SavingDetail; open: (form: Form) => () => void };

function Hero({ label, value, top, children }: { label: string; value: string; top?: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="@container relative flex min-h-[200px] flex-col justify-between gap-3.5 overflow-hidden rounded-[26px] bg-forest p-5 text-white shadow-hero">
      <LeafWatermark />
      <div className="relative">
        {top ? <p className="m-0 mb-2 text-small font-bold text-mint">{top}</p> : null}
        <p className="m-0 text-small font-semibold text-mint">{label}</p>
        <p className="m-0 mt-0.5 text-[length:min(var(--text-display),13cqi)] font-extrabold leading-tight tracking-[-0.025em] tabular-nums">{value}</p>
      </div>
      <div className="relative flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

function BarWords({ share, left, right }: { share: number; left: string; right: string }) {
  return (
    <>
      <HeroBar percent={share * 100} />
      <p className="m-0 -mt-1.5 flex justify-between gap-3 text-caption font-semibold text-mint">
        <span>{left}</span>
        <span>{right}</span>
      </p>
    </>
  );
}

function Stats({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-6 gap-y-2">{children}</div>;
}

function Card({ title, right, children, className = "" }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-[20px] px-4 py-3.5 ${className}`}>
      {title ? (
        <div className="flex min-h-5 items-center justify-between gap-2">
          <h2 className="m-0 text-small font-extrabold text-[var(--tl-muted)]">{title}</h2>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function Breakdown({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <dl className="m-0 mt-1">{children}</dl>
    </Card>
  );
}

function Notice({ icon, tone = "primary", title, children, actions }: { icon: IconName; tone?: "primary" | "gold"; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconTile icon={icon} tone={tone} />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-body font-bold">{title}</p>
          <p className="m-0 mt-0.5 text-small text-[var(--tl-muted)]">{children}</p>
        </div>
      </div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2.5 [&>*]:flex-1">{actions}</div> : null}
    </Card>
  );
}

function EarlyCard({ text, label, onClick }: { text: string; label: string; onClick: () => void }) {
  return (
    <Card>
      <p className="m-0 text-body font-bold">Close it early</p>
      <p className="m-0 mb-3 mt-0.5 text-small text-[var(--tl-muted)]">{text}</p>
      <button type="button" onClick={onClick} className={`h-12 w-full cursor-pointer rounded-[16px] border border-[#E3C3BB] text-[15px] font-extrabold text-expense dark:border-expense-dark/40 dark:text-expense-dark ${focusRing}`}>
        {label}
      </button>
    </Card>
  );
}

function Layout({ hero, children }: { hero: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
      <div className="flex flex-col gap-3 lg:gap-5">{hero}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function useToggle(saving: Saving, key: "autoRecord" | "remind" | "renew") {
  const update = useUpdateSaving(saving.id);
  return {
    error: update.error,
    set: (value: boolean) =>
      update.mutate({
        name: saving.name, provider: saving.provider, payFromWalletId: saving.payFromWalletId, amount: null, ratePoints: null, taxPoints: null,
        chargesPerYear: null, maturityAmount: saving.maturityAmount, cover: saving.cover, policy: saving.policy, policyNumber: saving.policyNumber,
        insured: saving.insured, nominee: saving.nominee, bondNumbers: null, autoRecord: key === "autoRecord" ? value : null,
        remind: key === "remind" ? value : null, renew: key === "renew" ? value : null,
      }),
  };
}

function UndoButton({ saving, what }: { saving: Saving; what: string }) {
  const undo = useUndoSavingEntry(saving.id);
  if (saving.closed) return null;
  return (
    <div className="flex flex-col items-center gap-1">
      <Button variant="ghost" disabled={undo.isPending} onClick={() => undo.mutate()}>
        Undo the last {what}
      </Button>
      <ErrorNote>{messageOf(undo.error)}</ErrorNote>
    </div>
  );
}

// FDR

function FdrView({ detail, open }: ViewProps) {
  const s = detail.saving;
  const renew = useToggle(s, "renew");
  const gross = profit(s.amount, s.ratePoints, s.everyMonths > 0 ? s.everyMonths : s.months);
  const tax = taxOf(gross, s.taxPoints);
  const duty = s.estimate !== null ? s.balance + gross - tax - s.estimate : 0;
  const so = s.daysTotal ? Math.round((gross * s.daysDone) / s.daysTotal) : 0;
  return (
    <Layout
      hero={
        <Hero label={s.closed ? "Closed" : "In the FDR"} value={formatBdt(s.closed ? 0 : s.balance)} top={s.provider ?? undefined}>
          {s.closed ? null : <BarWords share={s.daysTotal ? s.daysDone / s.daysTotal : 0} left={`${s.daysDone} of ${s.daysTotal} days`} right={s.maturesOn ? `Matures ${dueLabel(s.maturesOn)}` : ""} />}
          <Stats>
            <HeroStat label="Profit rate" value={`${percent(s.ratePoints)} a year`} />
            <HeroStat label="Then" value={s.closed ? (s.closedOn ? `Closed ${dueLabel(s.closedOn)}` : "Closed") : s.renew ? `Renews for ${termWords(s.months)}` : `Pays into ${s.payFromWalletName ?? "your account"}`} />
          </Stats>
        </Hero>
      }
    >
      {s.closed ? null : (
        <>
          <Breakdown title={s.everyMonths > 0 ? `At maturity · profit ${everyWords(s.everyMonths)}` : "At maturity"}>
            <Line label={s.everyMonths > 0 ? "Last profit payment" : "Profit"} value={formatBdt(gross)} tone="income" />
            <Line label={`Tax at source, ${percent(s.taxPoints)}`} value={minus(tax)} tone="expense" />
            {duty > 0 ? <Line label="Excise duty" value={minus(duty)} tone="expense" /> : null}
            <Line label={s.renew ? "Your FDR becomes" : "Into your account"} value={formatBdt(s.estimate ?? 0)} strong />
          </Breakdown>
          <Notice
            icon="repeat"
            title={s.maturesOn ? `${s.renew ? "Renews" : "Pays out"} on ${dueLabel(s.maturesOn)}` : "At maturity"}
            actions={
              <>
                <Button variant="secondary" onClick={() => renew.set(!s.renew)}>
                  {s.renew ? "Pay into account" : "Renew instead"}
                </Button>
                <Button variant="secondary" onClick={open("edit")}>
                  Change rate
                </Button>
              </>
            }
          >
            {s.renew
              ? "On the day we record the profit, the tax and the duty, and start a new term. Change the rate then if the bank gives a new one."
              : `On the day we record the profit, the tax and the duty, and move it all into ${s.payFromWalletName ?? "your account"}.`}
          </Notice>
          <ErrorNote>{messageOf(renew.error)}</ErrorNote>
          {s.everyMonths > 0 ? <Payments rows={detail.schedule} title="Profit payments" done={s.done} total={s.total} /> : null}
          {s.everyMonths === 0 && s.daysDone > 0 ? (
            <Card>
              <div className="flex items-center gap-3">
                <IconTile icon="clock" tone="muted" />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-bold">Profit builds up</span>
                  <span className="block text-small text-[var(--tl-muted)]">Paid at maturity, not counted until then</span>
                </span>
                <span className="text-right">
                  <span className="block text-body font-extrabold tabular-nums text-[var(--tl-muted)]">{wholeBdt(so)}</span>
                  <span className="block text-caption text-[var(--tl-muted)]">so far, about</span>
                </span>
              </div>
            </Card>
          ) : null}
          <EarlyCard text="Banks pay a lower rate, or none, if you break an FDR early. Enter what the bank paid you." label="Encash early" onClick={open("early")} />
        </>
      )}
    </Layout>
  );
}

// DPS

function DpsView({ detail, open }: ViewProps) {
  const s = detail.saving;
  const auto = useToggle(s, "autoRecord");
  const record = useSavingAction(s.id, "deposit");
  const skip = useSavingAction(s.id, "skip");
  const next = s.next;
  const matured = next?.action === "Close";
  const payIn = s.amount * (s.months - s.missed.length);
  return (
    <Layout
      hero={
        <Hero label={s.closed ? "Closed" : "Paid in so far"} value={formatBdt(s.balance)} top={s.provider ?? undefined}>
          <BarWords share={s.total ? s.done / s.total : 0} left={`${s.done} of ${s.total} instalments`} right={s.maturesOn ? `Matures ${dueLabel(s.maturesOn)}` : ""} />
          <Stats>
            <HeroStat label="Each month" value={wholeBdt(s.amount)} />
            <HeroStat label="Profit rate" value={`${percent(s.ratePoints)} a year`} />
            <HeroStat label="At maturity, about" value={wholeBdt(s.estimate ?? 0)} />
          </Stats>
        </Hero>
      }
    >
      {next && !s.closed ? (
        matured ? (
          <Notice icon="flag" title={`Matured on ${dueLabel(next.date)}`} actions={<Button onClick={open("close")}>Record what the bank paid</Button>}>
            Every instalment is in. Record what reached your account; the profit and the tax taken are worked out from it.
          </Notice>
        ) : (
          <Card>
            <div className="flex items-center gap-3">
              <IconTile icon="calendar" tone={next.overdue ? "expense" : "gold"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold">
                  {next.label} · {dueLabel(next.date)}
                </span>
                <span className="block truncate text-small text-[var(--tl-muted)]">
                  {dueInWords(next.date)} · from {s.payFromWalletName ?? "your account"}
                </span>
              </span>
              <span className="text-body font-extrabold tabular-nums">{wholeBdt(s.amount)}</span>
            </div>
            <SwitchRow label="The bank takes it automatically" detail="Recorded on the day, like your EMIs" checked={s.autoRecord} onChange={auto.set} />
            <div className="flex gap-2.5">
              <Button variant="secondary" className="flex-1" disabled={record.isPending} onClick={() => record.mutate({})}>
                Record now
              </Button>
              <Button variant="secondary" className="flex-1" disabled={skip.isPending} onClick={() => skip.mutate({})}>
                Missed it
              </Button>
            </div>
            <ErrorNote>{messageOf(record.error) ?? messageOf(skip.error) ?? messageOf(auto.error)}</ErrorNote>
          </Card>
        )
      ) : null}
      <Card title="Instalments">
        <InstalmentGrid rows={detail.schedule} />
      </Card>
      <Breakdown title="At maturity · from your DPS book">
        <Line label="You pay in" value={wholeBdt(payIn)} />
        <Line label="Profit, before tax" value={wholeBdt(Math.max((s.estimate ?? 0) - payIn, 0))} tone="income" />
        <Line label={s.maturityAmount ? "Bank's maturity amount" : "Maturity amount, about"} value={wholeBdt(s.estimate ?? 0)} strong />
      </Breakdown>
      {s.maturityAmount ? null : <p className="m-0 px-1 text-small text-[var(--tl-muted)]">Worked out at {percent(s.ratePoints)} compounded monthly. Type the amount from your DPS book (Edit) to use the bank's figure.</p>}
      {s.closed ? null : (
        <>
          <EarlyCard text="Most banks pay little or no profit on a DPS closed early. Enter what was paid to you." label="Close DPS early" onClick={open("early")} />
          {s.done > s.paidBefore ? <UndoButton saving={s} what="instalment" /> : null}
        </>
      )}
    </Layout>
  );
}

function InstalmentGrid({ rows }: { rows: SavingScheduleRow[] }) {
  const paid = rows.filter((r) => r.status === "Paid" || r.status === "PaidBefore").length;
  const next = rows.find((r) => r.status === "Due");
  const cell = (r: SavingScheduleRow) =>
    r.status === "Paid" || r.status === "PaidBefore"
      ? "bg-forest dark:bg-sage"
      : r.status === "Missed"
        ? "border-2 border-expense bg-[#F7E4DF] dark:border-expense-dark dark:bg-transparent"
        : r.status === "Due"
          ? "border-2 border-forest bg-[var(--tl-surface)] dark:border-sage"
          : "bg-[var(--tl-track)]";
  return (
    <div className="mt-3">
      <div role="img" aria-label={`${paid} of ${rows.length} instalments paid${next ? `; instalment ${next.number} is next` : ""}`} className="grid grid-cols-12 gap-[5px]">
        {rows.map((r) => (
          <span key={r.number} className={`h-[18px] rounded-[5px] ${cell(r)}`} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-caption font-semibold text-[var(--tl-muted)]">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-forest dark:bg-sage" />Paid</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-forest dark:border-sage" />Next</span>
        {rows.some((r) => r.status === "Missed") ? <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-expense dark:border-expense-dark" />Missed</span> : null}
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[var(--tl-track)]" />To come</span>
        <span className="ml-auto">One row = a year</span>
      </div>
    </div>
  );
}

// Sanchayapatra

function CertificateView({ detail, open }: ViewProps) {
  const s = detail.saving;
  const auto = useToggle(s, "autoRecord");
  const gross = profit(s.amount, s.ratePoints, s.everyMonths > 0 ? s.everyMonths : s.months);
  const tax = taxOf(gross, s.taxPoints);
  const monthsDone = s.daysTotal ? Math.round((s.months * s.daysDone) / s.daysTotal) : 0;
  const next = s.next;
  return (
    <Layout
      hero={
        <Hero label={s.closed ? "Closed" : "Invested"} value={formatBdt(s.closed ? 0 : s.balance)} top={`${s.provider ? `${s.provider} · ` : ""}${termWords(s.months)}`}>
          {s.closed ? null : <BarWords share={s.daysTotal ? s.daysDone / s.daysTotal : 0} left={`${monthsDone} of ${s.months} months`} right={s.maturesOn ? `Matures ${dueLabel(s.maturesOn)}` : ""} />}
          <Stats>
            <HeroStat label="Profit rate" value={`${percent(s.ratePoints)} a year`} />
            <HeroStat label={s.everyMonths > 0 ? `Each ${s.everyMonths === 1 ? "month" : `${s.everyMonths} months`}` : "At maturity"} value={formatBdt(gross - tax)} />
            <HeroStat label="Received so far" value={wholeBdt(s.profitReceived - s.taxTaken)} />
          </Stats>
        </Hero>
      }
    >
      <Breakdown title={s.everyMonths > 0 ? "Each profit payment" : "Profit at maturity"}>
        <Line label={s.everyMonths > 0 ? `Profit, ${s.everyMonths === 12 ? "a year" : `${s.everyMonths} ${s.everyMonths === 1 ? "month" : "months"}`} of ${percent(s.ratePoints)}` : `Profit, ${percent(s.ratePoints)} a year`} value={formatBdt(gross)} tone="income" />
        <Line label={`Tax at source, ${percent(s.taxPoints)}`} value={minus(tax)} tone="expense" />
        <Line label={`Into ${s.payFromWalletName ?? "your account"}`} value={formatBdt(gross - tax)} strong />
      </Breakdown>
      <Notice icon="percent" tone="gold" title={`Tax at source: ${percent(s.taxPoints)}`}>
        5% while all your certificates together come to ৳5,00,000 or less; above that the rate is 10%. Change it with Edit if your certificate says otherwise.
      </Notice>
      {s.closed ? null : (
        <>
          <SwitchRow label="Record each payment automatically" detail={`On its date, into ${s.payFromWalletName ?? "your account"}`} checked={s.autoRecord} onChange={auto.set} />
          <ErrorNote>{messageOf(auto.error)}</ErrorNote>
          {next && next.action === "Record" ? <Button onClick={open("profit")}>Record {next.label.toLowerCase()}</Button> : null}
          {next && next.action === "Close" ? <Button onClick={open("close")}>Record maturity</Button> : null}
        </>
      )}
      <Payments rows={detail.schedule} title="Profit payments" done={s.done} total={s.total} into={s.payFromWalletName} />
      {s.closed ? null : (
        <>
          <EarlyCard text="Early encashment pays a lower rate and takes back the extra profit. Enter the amount the bank or post office paid." label="Encash early" onClick={open("early")} />
          {s.done > s.paidBefore ? <UndoButton saving={s} what="profit payment" /> : null}
        </>
      )}
    </Layout>
  );
}

/** Profit payments: received (net of tax), the next one, and those to come. */
function Payments({ rows, title, done, total, into }: { rows: SavingScheduleRow[]; title: string; done: number; total: number | null; into?: string | null }) {
  const [all, setAll] = useState(false);
  const firstOpen = rows.findIndex((r) => r.status === "Due" || r.status === "Upcoming");
  const start = all ? 0 : Math.max(0, firstOpen - 5);
  const shown = all ? rows : rows.slice(start, start + 7);
  return (
    <ListCard>
      <div className="flex min-h-9 items-center justify-between pt-1">
        <h2 className="m-0 text-small font-extrabold text-[var(--tl-muted)]">{title}</h2>
        <span className="text-caption font-bold text-[var(--tl-muted)]">
          {done} of {total}
        </span>
      </div>
      <ul className="m-0 list-none p-0">
        {shown.map((r) => {
          const paid = r.status === "Paid" || r.status === "PaidBefore";
          return (
            <li key={r.number} className="flex min-h-[60px] items-center gap-3 border-b border-[var(--tl-border)] py-2 last:border-b-0">
              <IconTile icon={paid ? "check" : "clock"} tone={paid ? "primary" : "muted"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold">
                  Profit {r.number} · {dueLabel(r.date)}
                </span>
                <span className="block truncate text-small text-[var(--tl-muted)]">
                  {r.status === "Paid" ? `Into ${r.paidFrom ?? into ?? "your account"} · tax ${formatBdt(r.tax)}` : r.status === "PaidBefore" ? "Received before TakaLeaf" : r.status === "Due" ? `Next · ${dueInWords(r.date).replace("Due in ", "")}` : r.status === "Missed" ? "Not paid" : "To come"}
                </span>
              </span>
              <span className="text-right">
                <span className={`block text-body font-extrabold tabular-nums ${paid ? "text-[var(--tl-primary)]" : "text-[var(--tl-muted)]"}`}>{formatBdt(r.amount - r.tax)}</span>
                <span className="block text-caption text-[var(--tl-muted)]">after tax</span>
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length > shown.length || all ? (
        <button type="button" onClick={() => setAll(!all)} className={`min-h-11 w-full cursor-pointer text-small font-bold text-[var(--tl-primary)] ${focusRing}`}>
          {all ? "Show fewer" : `All ${rows.length}`}
        </button>
      ) : null}
    </ListCard>
  );
}

// Prize bonds

function BondsView({ detail, open }: ViewProps) {
  const s = detail.saving;
  const [all, setAll] = useState(false);
  const prizes = detail.activity.filter((t) => t.categoryName === "Prize bond prize" || (t.type === "Income" && t.note?.startsWith("Prize bond")));
  const last = prizes[0];
  const lastTax = last ? detail.activity.find((t) => t.type === "Expense" && t.occurredAt === last.occurredAt) : undefined;
  const numbers = all ? s.bondNumbers : s.bondNumbers.slice(0, 6);
  const wonNumber = last?.note?.replace(/^Prize bond /, "");
  const cutoff = s.nextDraw ? new Date(Date.parse(`${s.nextDraw}T00:00:00Z`) - 60 * 86_400_000).toISOString().slice(0, 10) : null;
  return (
    <Layout
      hero={
        <Hero label={s.closed ? "Sold back" : `${s.bondCount} bonds`} value={formatBdt(s.balance)}>
          <Stats>
            <HeroStat label="Face value" value="৳100 each" />
            <HeroStat label="Won so far" value={`${wholeBdt(s.profitReceived - s.taxTaken)} after tax`} />
          </Stats>
          {s.nextDraw && !s.closed ? (
            <div className="flex items-center gap-2.5 rounded-[16px] bg-white/15 px-3 py-2.5">
              <Icon name="calendar" size={20} />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-extrabold">Next draw · {dueLabel(s.nextDraw)}</p>
                <p className="m-0 text-caption text-mint">
                  {s.bondsInDraw === s.bondCount ? `All ${s.bondCount} are in it.` : `${s.bondsInDraw} of ${s.bondCount} are in it.`} Bonds bought after {cutoff ? dueLabel(cutoff) : ""} wait for the next draw.
                </p>
              </div>
            </div>
          ) : null}
        </Hero>
      }
    >
      <Card title="Your numbers">
        {s.bondNumbers.length === 0 ? (
          <p className="m-0 mt-2 text-small text-[var(--tl-muted)]">Add the numbers (Edit) to check each draw's result here.</p>
        ) : (
          <>
            <ul aria-label="Your bond numbers" className="m-0 mt-2.5 grid list-none grid-cols-2 gap-2 p-0">
              {numbers.map((n) => {
                const won = n === wonNumber;
                return (
                  <li key={n} className={`rounded-[14px] px-2.5 py-2 ${won ? "border-2 border-[var(--tl-gold)] bg-[var(--tl-gold-tint)]" : "border border-[var(--tl-border)] bg-[var(--tl-surface)]"}`}>
                    <span className="block text-sm font-bold tabular-nums tracking-wide">{n}</span>
                    {won && last ? <span className="block text-caption font-extrabold text-[var(--tl-gold)]">Won {wholeBdt(last.amount)}</span> : null}
                  </li>
                );
              })}
            </ul>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-caption font-semibold text-[var(--tl-muted)]">
                Showing {numbers.length} of {s.bondNumbers.length}
              </span>
              {s.bondNumbers.length > 6 ? (
                <button type="button" onClick={() => setAll(!all)} className={`min-h-11 cursor-pointer text-sm font-extrabold text-[var(--tl-primary)] ${focusRing}`}>
                  {all ? "Show fewer" : `See all ${s.bondNumbers.length}`}
                </button>
              ) : null}
            </div>
          </>
        )}
      </Card>
      {s.closed ? null : (
        <Notice
          icon="trophy"
          tone="gold"
          title="Did a number win?"
          actions={
            <>
              <Button onClick={open("prize")}>I won a prize</Button>
              <Button variant="secondary" onClick={open("sell")}>
                Sell back
              </Button>
            </>
          }
        >
          Draws are on 31 Jan, 30 Apr, 31 Jul and 31 Oct. Check the Bangladesh Bank result, then record the prize here.
        </Notice>
      )}
      {last ? (
        <Breakdown title="Last win">
          <Line label={`${wonNumber ?? "Prize"} · ${shortDate(last.occurredAt)}`} value={formatBdt(last.amount)} />
          <Line label="Tax at source" value={minus(lastTax?.amount ?? 0)} tone="expense" />
          <Line label={`Into ${last.toWalletName ?? "your account"}`} value={formatBdt(last.amount - (lastTax?.amount ?? 0))} strong />
        </Breakdown>
      ) : null}
      <Breakdown title="Prizes in each draw, per series">
        {PRIZES.map((p, i) => (
          <Line key={p} label={`${["1st", "2nd", "3rd", "4th", "5th"][i]} prize`} value={wholeBdt(p)} />
        ))}
      </Breakdown>
      <p className="m-0 flex gap-2 px-1 text-small text-[var(--tl-muted)]">
        <Icon name="info" size={15} className="mt-0.5 shrink-0" />
        <span>Prize money is income under Prize bond prize; the tax taken is an expense under Tax at source. Selling back returns ৳100 a bond.</span>
      </p>
    </Layout>
  );
}

// Insurance

function PolicyView({ detail, open }: ViewProps) {
  const s = detail.saving;
  const remind = useToggle(s, "remind");
  const pay = useSavingAction(s.id, "premium");
  const wallets = useWallets();
  const accounts = pickableWallets(wallets.data?.wallets ?? [], [s.payFromWalletId]);
  const [walletId, setWalletId] = useState(s.payFromWalletId);
  const next = s.next;
  const paidRows = detail.schedule.filter((r) => r.status === "Paid").sort((a, b) => b.number - a.number);
  const before = detail.schedule.filter((r) => r.status === "PaidBefore").length;
  return (
    <Layout
      hero={
        <Hero label={s.policy === "Life" ? "Sum assured" : "Cover"} value={s.cover ? wholeBdt(s.cover) : "—"} top={[s.provider, s.policy ? `${s.policy.toLowerCase()} policy` : null, s.months ? termWords(s.months) : null].filter(Boolean).join(" · ")}>
          {s.total ? <BarWords share={s.done / s.total} left={`${s.done} of ${s.total} premiums paid`} right={s.maturesOn ? `Matures ${dueLabel(s.maturesOn)}` : ""} /> : null}
          <Stats>
            <HeroStat label="Premium" value={`${wholeBdt(s.amount)} ${premiumWords(s.everyMonths)}`} />
            <HeroStat label="Paid so far" value={wholeBdt(s.paidSoFar)} />
          </Stats>
        </Hero>
      }
    >
      {next && !s.closed ? (
        <Card>
          <div className="flex items-center gap-3">
            <IconTile icon="calendar" tone={next.overdue ? "expense" : "gold"} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-bold">
                {next.label} · {dueLabel(next.date)}
              </span>
              <span className="block truncate text-small text-[var(--tl-muted)]">
                {dueInWords(next.date)}
                {s.graceEnds ? ` · grace period to ${dueLabel(s.graceEnds)}` : ""}
              </span>
            </span>
            <span className="text-body font-extrabold tabular-nums">{wholeBdt(s.amount)}</span>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            <SelectField label="Pay from" value={walletId} onChange={(e) => setWalletId(e.target.value)} error={undefined}>
              <WalletOptions wallets={accounts} />
            </SelectField>
            <Button disabled={pay.isPending} onClick={() => pay.mutate({ walletId })}>
              {pay.isPending ? "Recording…" : "Pay premium"}
            </Button>
            <ErrorNote>{messageOf(pay.error)}</ErrorNote>
          </div>
        </Card>
      ) : null}
      {s.closed ? null : <SwitchRow label="Remind me 7 days before" detail="On the dashboard, with the amount" checked={s.remind} onChange={remind.set} />}
      <Breakdown title="Policy">
        {s.policyNumber ? <Line label="Policy number" value={s.policyNumber} /> : null}
        {s.insured ? <Line label="Insured" value={s.insured} /> : null}
        {s.nominee ? <Line label="Nominee" value={s.nominee} /> : null}
        <Line label="Started" value={dueLabel(s.startDate)} />
        <Line label="Counts as" value={`Insurance${s.policy && s.policy !== "Other" ? ` · ${s.policy}` : ""}`} />
      </Breakdown>
      <ListCard>
        <div className="flex min-h-9 items-center pt-1">
          <h2 className="m-0 text-small font-extrabold text-[var(--tl-muted)]">Premiums paid</h2>
        </div>
        <ul className="m-0 list-none p-0">
          {paidRows.map((r) => (
            <li key={r.number} className="flex min-h-[60px] items-center gap-3 border-b border-[var(--tl-border)] py-2 last:border-b-0">
              <IconTile icon="check" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold">
                  Premium {r.number} · {dueLabel(r.date)}
                </span>
                <span className="block truncate text-small text-[var(--tl-muted)]">From {r.paidFrom ?? "your account"}</span>
              </span>
              <span className="text-body font-extrabold tabular-nums">{wholeBdt(r.amount)}</span>
            </li>
          ))}
          {before > 0 ? (
            <li className="flex min-h-[60px] items-center gap-3 py-2">
              <IconTile icon="check" tone="muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold">Premiums {before === 1 ? "1" : `1–${before}`}</span>
                <span className="block truncate text-small text-[var(--tl-muted)]">Paid before you started TakaLeaf</span>
              </span>
              <span className="text-body font-extrabold tabular-nums text-[var(--tl-muted)]">{wholeBdt(before * s.amount)}</span>
            </li>
          ) : null}
          {paidRows.length === 0 && before === 0 ? <li className="py-3 text-body text-[var(--tl-muted)]">No premium recorded yet.</li> : null}
        </ul>
      </ListCard>
      {s.closed ? null : (
        <>
          <Notice
            icon="shield"
            title="Money from the policy"
            actions={
              <>
                <Button variant="secondary" onClick={open("claim")}>
                  Got a claim
                </Button>
                <Button variant="secondary" onClick={open("matured")}>
                  Matured
                </Button>
              </>
            }
          >
            A claim, a survival benefit or the maturity amount is recorded as income into the account it was paid to.
          </Notice>
          {paidRows.length > 0 ? <UndoButton saving={s} what="premium" /> : null}
        </>
      )}
    </Layout>
  );
}

function Activity({ rows }: { rows: Transaction[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-3 lg:mt-5" aria-labelledby="activity-title">
      <ListCard>
        <div className="flex min-h-9 items-center pt-1">
          <h2 id="activity-title" className="m-0 text-small font-extrabold text-[var(--tl-muted)]">
            Activity
          </h2>
        </div>
        <ul className="m-0 list-none p-0">
          {rows.slice(0, 20).map((t) => {
            const income = t.type === "Income";
            const expense = t.type === "Expense";
            return (
              <li key={t.id} className="flex min-h-14 items-center gap-3 border-b border-[var(--tl-border)] py-2 last:border-b-0">
                <DateBadge date={localDate(new Date(t.occurredAt))} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold">{t.note ?? t.categoryName ?? t.type}</span>
                  <span className="block truncate text-small text-[var(--tl-muted)]">
                    {[t.categoryName, income ? t.toWalletName : t.fromWalletName].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className={`text-body font-extrabold tabular-nums ${income ? "text-[var(--tl-primary)]" : expense ? "text-expense dark:text-expense-dark" : ""}`}>
                  {income ? "+" : expense ? "−" : ""}
                  {formatBdt(t.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      </ListCard>
    </section>
  );
}
