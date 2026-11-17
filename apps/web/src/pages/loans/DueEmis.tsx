import { formatBdt } from "@takaleaf/shared";
import { useState } from "react";
import { Link } from "react-router";
import { useBankLoans } from "../../api/queries";
import type { BankLoan } from "../../api/types";
import { Button, focusRing } from "../../ui/Button";
import { IconTile } from "../../ui/Parts";
import { dueInWords, dueLabel } from "./parts";
import { PayEmiForm } from "./PaymentForms";

export const DUE_SOON_DAYS = 7;

/** Bank EMIs to pay by hand within a week (or late), for the dashboard's "due" area. */
export function DueEmis() {
  const loans = useBankLoans();
  const [paying, setPaying] = useState<BankLoan | null>(null);
  const soon = new Date(Date.now() + DUE_SOON_DAYS * 86_400_000).toISOString().slice(0, 10);
  const due = (loans.data?.loans ?? []).filter((l) => l.type === "Bank" && !l.closed && !l.autoRecord && l.next && l.next.dueDate <= soon);
  if (due.length === 0) return null;
  return (
    <section className="glass rounded-[22px] p-4 lg:col-span-2" aria-labelledby="emis-due-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="emis-due-title" className="m-0 text-base font-extrabold">
          EMIs due
        </h2>
        <Link to="/loans" className={`text-small font-bold text-[var(--tl-primary)] ${focusRing}`}>
          Loans
        </Link>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {due.map((loan) => (
          <li key={loan.id} className="flex min-h-14 items-center gap-3">
            <IconTile icon="calendar" tone={loan.next!.overdue ? "expense" : "primary"} />
            <Link to={`/loans/${loan.id}`} className={`min-w-0 flex-1 rounded-lg ${focusRing}`}>
              <span className="block truncate text-body font-bold">
                {loan.name} EMI · {dueLabel(loan.next!.dueDate)}
              </span>
              <span className="block truncate text-small text-[var(--tl-muted)]">
                {dueInWords(loan.next!.dueDate)}
                {loan.payFromWalletName ? ` · from ${loan.payFromWalletName}` : ""}
              </span>
            </Link>
            <span className="hidden text-body font-extrabold tabular-nums sm:inline">{formatBdt(loan.next!.total)}</span>
            <Button onClick={() => setPaying(loan)}>Pay</Button>
          </li>
        ))}
      </ul>
      {paying ? <PayEmiForm loan={paying} onClose={() => setPaying(null)} /> : null}
    </section>
  );
}
