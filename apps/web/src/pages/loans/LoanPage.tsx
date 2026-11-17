import { formatBdt, formatRate } from "@takaleaf/shared";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useBankLoan, useUndoEmi } from "../../api/queries";
import type { BankLoan, CardLimit, ScheduleRow } from "../../api/types";
import { Button, focusRing } from "../../ui/Button";
import { ErrorNote, LoadError, Loading, messageOf } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { iconButtonClass, IconTile, LeafWatermark, ListCard, StatTile } from "../../ui/Parts";
import { shortDate } from "../../ui/format";
import { LoanForm } from "./LoanForm";
import { loanIcon } from "./LoansPage";
import { dueInWords, dueLabel, HeroBar, HeroStat, LegendDot, monthOfDay, Pill, repaidPercent, SplitBar } from "./parts";
import { PayEmiForm, PayExtraForm, SettleForm } from "./PaymentForms";

const SHOWN = 6;

export function LoanPage() {
  const { id = "" } = useParams();
  const detail = useBankLoan(id);
  const undo = useUndoEmi(id);
  const [form, setForm] = useState<"edit" | "pay" | "extra" | "settle" | null>(null);
  const [all, setAll] = useState(false);

  if (detail.isPending) return <Loading />;
  if (detail.error) return <LoadError query={detail} />;
  const { loan, schedule, card } = detail.data;
  const isCard = loan.type === "CardEmi";
  const rows = schedule.filter((r) => r.status !== "PaidBefore");
  const before = schedule.filter((r) => r.status === "PaidBefore").length;
  const upcomingFirst = [...rows].sort((a, b) => (a.status === "Paid") === (b.status === "Paid") ? (a.status === "Paid" ? b.number - a.number : a.number - b.number) : a.status === "Paid" ? 1 : -1);
  const shown = all ? upcomingFirst : upcomingFirst.slice(0, SHOWN);
  const lastPaid = rows.some((r) => r.status === "Paid");

  return (
    <>
      <div className="mb-3 flex min-h-14 items-center gap-3 lg:mb-5">
        <Link to="/loans" aria-label="Back to loans" className={iconButtonClass}>
          <Icon name="left" size={20} />
        </Link>
        <h1 className="m-0 min-w-0 flex-1 text-xl font-extrabold tracking-tight [overflow-wrap:anywhere] lg:text-headline">{loan.name}</h1>
        <button type="button" aria-label="Edit loan" onClick={() => setForm("edit")} className={iconButtonClass}>
          <Icon name="edit" size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
        <section aria-label={isCard ? "Still to be billed" : "Left to pay"} className="@container relative flex min-h-[230px] flex-col justify-between gap-3.5 overflow-hidden rounded-[26px] bg-forest p-5 text-white shadow-hero">
          <LeafWatermark />
          <div className="relative">
            <p className="m-0 flex items-center gap-2 text-small font-semibold text-mint">
              {isCard ? <Icon name="card" size={16} /> : null}
              {isCard ? `${card?.cardName ?? loan.payFromWalletName} · ${formatRate(loan.ratePoints)} EMI · ${loan.months} months` : `${loan.lender ?? "Bank"} · ${formatRate(loan.ratePoints)} a year`}
            </p>
            <p className="m-0 mt-2.5 text-small font-semibold text-mint">{loan.closed ? "Closed" : isCard ? "Still to be billed" : "Left to pay"}</p>
            <p className="m-0 mt-0.5 text-[length:min(var(--text-display),13cqi)] font-extrabold leading-tight tracking-[-0.025em] tabular-nums">{formatBdt(loan.outstanding)}</p>
          </div>
          <HeroBar percent={isCard ? (loan.paid * 100) / Math.max(1, loan.paid + loan.left) : repaidPercent(loan)} />
          {isCard ? null : (
            <p className="m-0 text-small text-[#E7F5EC]">
              {repaidPercent(loan)}% repaid · {formatBdt(loan.principal - loan.outstanding)} of {formatBdt(loan.principal)}
            </p>
          )}
          <div className="relative flex flex-wrap gap-x-6 gap-y-2">
            <HeroStat label={isCard ? "Each month" : "EMI"} value={formatBdt(loan.emi)} />
            <HeroStat label={isCard ? "Billed" : "EMIs left"} value={isCard ? `${loan.paid} of ${loan.paid + loan.left}` : `${loan.left} of ${loan.paid + loan.left}`} />
            <HeroStat label={loan.closed ? "Closed" : isCard ? "Last bill" : "Ends"} value={loan.closed ? (loan.closedOn ? dueLabel(loan.closedOn) : "—") : loan.endsOn ? monthOfDay(loan.endsOn) : "—"} />
          </div>
        </section>

        <div className="flex flex-col gap-3">
          {loan.next && !loan.closed ? <NextEmiCard loan={loan} onPay={() => setForm("pay")} onExtra={() => setForm("extra")} /> : null}
          {isCard && card ? <CardLimitCard card={card} /> : null}
          {isCard ? (
            <section className="glass flex items-start gap-2.5 rounded-[18px] px-4 py-3.5 text-body leading-relaxed">
              <Icon name="info" size={18} className="mt-0.5 shrink-0 text-[var(--tl-primary)]" />
              <span>
                On the <strong>{Number(loan.firstDueDate.slice(8))}th</strong> of each month TakaLeaf adds {formatBdt(loan.emi)} to the card's balance, like your statement. Then pay the card bill as you always do.
              </span>
            </section>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile icon="moneyOut" tone="expense" label="Interest paid so far" value={formatBdt(loan.interestPaid)} />
              <StatTile icon="calendar" label="Interest still to come" value={formatBdt(loan.interestLeft)} />
            </div>
          )}
        </div>
      </div>

      <section className="mt-3 flex flex-col gap-2 lg:mt-5" aria-labelledby="schedule-title">
        <div className="flex min-h-5 items-center justify-between px-1">
          <h2 id="schedule-title" className="m-0 text-small font-extrabold text-[var(--tl-muted)]">
            {isCard ? "Instalments" : "Schedule"}
          </h2>
          {upcomingFirst.length > SHOWN ? (
            <button type="button" onClick={() => setAll(!all)} className={`cursor-pointer text-small font-bold text-[var(--tl-primary)] ${focusRing}`}>
              {all ? "Show fewer" : `All ${loan.paid + loan.left} ${isCard ? "instalments" : "EMIs"}`}
            </button>
          ) : null}
        </div>
        <ListCard>
          {before > 0 ? (
            <p className="m-0 border-b border-[var(--tl-border)] py-3 text-small text-[var(--tl-muted)]">
              {isCard ? `Instalments 1–${before} were billed` : `EMIs 1–${before} were paid`} before the loan was added.
            </p>
          ) : null}
          <ul className="m-0 list-none p-0">
            {shown.map((row) => (
              <li key={`${row.status}-${row.number}`} className="border-b border-[var(--tl-border)] py-3 last:border-b-0">
                <ScheduleItem row={row} card={isCard} />
              </li>
            ))}
          </ul>
        </ListCard>
      </section>

      <div className="mt-4 flex flex-col gap-2.5">
        <ErrorNote>{messageOf(undo.error)}</ErrorNote>
        {lastPaid ? (
          <Button variant="ghost" className="self-center" disabled={undo.isPending} onClick={() => undo.mutate()}>
            Undo the last {isCard ? "instalment" : "EMI"}
          </Button>
        ) : null}
        {loan.closed ? null : (
          <>
            <Button variant="secondary" onClick={() => setForm("settle")}>
              <Icon name="flag" size={18} />
              {isCard ? "Pay off the rest now" : "Close the loan early"}
            </Button>
            <p className="m-0 text-center text-small text-[var(--tl-muted)]">
              {isCard ? "Bills everything left to the card now." : "Pays what is left, plus the bank's settlement charge, and marks the loan closed."}
            </p>
          </>
        )}
      </div>

      {form === "edit" ? <LoanForm loan={loan} onClose={() => setForm(null)} /> : null}
      {form === "pay" ? <PayEmiForm loan={loan} onClose={() => setForm(null)} /> : null}
      {form === "extra" ? <PayExtraForm loan={loan} onClose={() => setForm(null)} /> : null}
      {form === "settle" ? <SettleForm loan={loan} onClose={() => setForm(null)} /> : null}
    </>
  );
}

function NextEmiCard({ loan, onPay, onExtra }: { loan: BankLoan; onPay: () => void; onExtra: () => void }) {
  const next = loan.next!;
  const isCard = loan.type === "CardEmi";
  return (
    <section className="glass rounded-[20px] p-4" aria-label={isCard ? "Next bill" : "Next EMI"}>
      <div className="flex items-center gap-3">
        <IconTile icon={isCard ? loanIcon(loan) : "calendar"} tone={next.overdue ? "expense" : "primary"} />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-caption font-semibold text-[var(--tl-muted)]">
            {isCard ? "Next bill" : "Next EMI"} · {isCard ? "instalment" : "EMI"} {next.number}
          </p>
          <p className="m-0 text-base font-extrabold">
            {dueLabel(next.dueDate)} <span className="text-small font-semibold text-[var(--tl-muted)]">· {dueInWords(next.dueDate)}</span>
          </p>
        </div>
        <p className="m-0 text-lg font-extrabold tabular-nums">{formatBdt(next.total)}</p>
      </div>
      {next.interest > 0 ? (
        <>
          <div className="mt-3.5">
            <SplitBar principal={next.principal} interest={next.interest} />
          </div>
          <p className="m-0 mt-2 flex flex-wrap justify-between gap-2 text-small tabular-nums">
            <span>
              <LegendDot />
              Principal {formatBdt(next.principal)}
            </span>
            <span>
              <LegendDot amber />
              Interest {formatBdt(next.interest)}
            </span>
          </p>
        </>
      ) : null}
      {isCard ? (
        <p className="m-0 mt-3 text-small text-[var(--tl-muted)]">Added to the card automatically on the day.</p>
      ) : (
        <div className="mt-3.5 flex gap-2.5">
          <Button className="flex-1" onClick={onPay}>
            Pay EMI
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onExtra}>
            Pay extra
          </Button>
        </div>
      )}
    </section>
  );
}

function CardLimitCard({ card }: { card: CardLimit }) {
  const limit = card.limit ?? card.spent + card.held + Math.max(card.available ?? 0, 0);
  const share = (part: number) => (limit > 0 ? `${Math.min(100, (part * 100) / limit)}%` : "0%");
  return (
    <section className="glass rounded-[20px] p-4" aria-labelledby="limit-title">
      <h2 id="limit-title" className="m-0 text-base font-extrabold">
        Card limit
      </h2>
      <p className="m-0 text-small text-[var(--tl-muted)]">
        {card.cardName}
        {card.limit !== null ? ` · limit ${formatBdt(card.limit)}` : ""}
      </p>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--tl-chip)]" aria-hidden="true">
        <div className="bg-expense dark:bg-expense-dark" style={{ width: share(card.spent) }} />
        <div className="bg-[repeating-linear-gradient(135deg,#D8A24A_0_6px,#E7BE73_6px_12px)]" style={{ width: share(card.held) }} />
      </div>
      <dl className="m-0 mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-2 text-body">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-expense dark:bg-expense-dark" />
        <dt>Card balance (spent)</dt>
        <dd className="m-0 font-bold tabular-nums">{formatBdt(card.spent)}</dd>
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] bg-[#D8A24A]" />
        <dt>Held for EMIs</dt>
        <dd className="m-0 font-bold tabular-nums">{formatBdt(card.held)}</dd>
        {card.available !== null ? (
          <>
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px] border border-[var(--tl-border)] bg-[var(--tl-chip)]" />
            <dt className="font-bold">You can still spend</dt>
            <dd className="m-0 font-extrabold text-[var(--tl-primary)] tabular-nums">{formatBdt(card.available)}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function ScheduleItem({ row, card }: { row: ScheduleRow; card: boolean }) {
  const status =
    row.status === "Paid" ? <Pill tone="mint">{card ? "Billed" : "Paid"}</Pill>
    : row.status === "Due" ? <Pill tone={Date.parse(row.dueDate) < Date.now() ? "rust" : "amber"}>{card ? "Bills" : "Due"} {dueLabel(row.dueDate)}</Pill>
    : <Pill>{dueLabel(row.dueDate)}</Pill>;
  const note = row.status === "Paid" ? [row.paidAt ? shortDate(row.paidAt) : null, row.paidFrom].filter(Boolean).join(" · ") : row.balanceAfter !== null ? `Leaves ${formatBdt(row.balanceAfter)}` : "";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-body font-bold">
          {monthOfDay(row.dueDate)} <span className="text-small font-semibold text-[var(--tl-muted)]">· {card ? "instalment" : "EMI"} {row.number}</span>
        </span>
        {status}
        <span className="text-body font-extrabold tabular-nums">{formatBdt(row.total)}</span>
      </div>
      {row.interest > 0 ? <SplitBar principal={row.principal} interest={row.interest} height={6} /> : null}
      <div className="flex flex-wrap justify-between gap-2 text-small text-[var(--tl-muted)] tabular-nums">
        <span>{row.interest > 0 ? `Principal ${formatBdt(row.principal)} · Interest ${formatBdt(row.interest)}` : ""}</span>
        <span>{note}</span>
      </div>
    </div>
  );
}
