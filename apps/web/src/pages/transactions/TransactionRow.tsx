import { formatBdt } from "@takaleaf/shared";
import type { Transaction } from "../../api/types";
import { focusRing } from "../../ui/Button";
import { IconTile } from "../../ui/Parts";
import { shortDate, signedAmount, timeLabel } from "../../ui/format";

const TONE = {
  Income: "text-forest dark:text-income-dark",
  Expense: "text-expense dark:text-expense-dark",
  Transfer: "text-[var(--tl-text)]",
} as const;

const isPersonWallet = (name: string | null) => Boolean(name?.startsWith("Lent to ") || name?.startsWith("Borrowed from "));

/** Loan rows read as what happened, e.g. "Lent to Rafi" or "Rafi paid back". */
function loanTitle(t: Transaction): string {
  const from = t.fromWalletName ?? "";
  const to = t.toWalletName ?? "";
  if (to.startsWith("Lent to ")) return to;
  if (from.startsWith("Lent to ")) return `${from.slice(8)} paid back`;
  if (from.startsWith("Borrowed from ")) return from;
  if (to.startsWith("Borrowed from ")) return `Paid back ${to.slice(14)}`;
  return "Loan";
}

export function describe(t: Transaction): { title: string; detail: string } {
  if (t.feeOfId) return { title: t.note ?? "Transfer fee", detail: `${t.categoryName ?? "Fee"} · ${t.fromWalletName ?? ""}` };
  if (t.personId) {
    const ownWallet = isPersonWallet(t.fromWalletName) ? t.toWalletName : t.fromWalletName;
    return { title: loanTitle(t), detail: [t.note, ownWallet].filter(Boolean).join(" · ") };
  }
  if (t.type === "Transfer")
    return {
      title: t.note ?? `${t.fromWalletName} to ${t.toWalletName}`,
      detail: [t.note ? `${t.fromWalletName} to ${t.toWalletName}` : "Transfer", t.fee ? `fee ${formatBdt(t.fee)}` : null].filter(Boolean).join(" · "),
    };
  const wallet = t.type === "Income" ? t.toWalletName : t.fromWalletName;
  return { title: t.categoryName ?? (t.type === "Income" ? "Income" : "Expense"), detail: [t.note, wallet].filter(Boolean).join(" · ") };
}

/** One history row: 40 px icon tile, title, "detail · time" (or date), and the signed amount. */
export function TransactionRow({
  transaction,
  onOpen,
  withDate = false,
}: {
  transaction: Transaction;
  onOpen: (transaction: Transaction) => void;
  /** Show the day ("5 Nov") instead of the time, for lists not grouped by day. */
  withDate?: boolean;
}) {
  const { title, detail } = describe(transaction);
  const icon = transaction.type === "Transfer" ? "transfer" : transaction.type === "Income" ? "moneyIn" : "moneyOut";
  const when = withDate ? shortDate(transaction.occurredAt) : timeLabel(transaction.occurredAt);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(transaction)}
        className={`-mx-1.5 flex min-h-14 w-[calc(100%+12px)] cursor-pointer items-center gap-3 rounded-[14px] px-1.5 py-2 text-left hover:bg-[var(--tl-chip)] ${focusRing}`}
      >
        <IconTile icon={icon} tone={transaction.type === "Expense" ? "expense" : "primary"} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{title}</span>
          <span className="block truncate text-[12px] text-[var(--tl-muted)]">{[detail, when].filter(Boolean).join(" · ")}</span>
        </span>
        <span className={`shrink-0 text-[15px] font-extrabold ${TONE[transaction.type]}`}>{signedAmount(transaction)}</span>
      </button>
    </li>
  );
}
