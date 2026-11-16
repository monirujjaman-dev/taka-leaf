import type { Transaction } from "../../api/types";
import { focusRing } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { signedAmount, timeLabel } from "../../ui/format";

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

function describe(t: Transaction): { title: string; detail: string } {
  if (t.feeOfId) return { title: t.note ?? "Transfer fee", detail: `${t.categoryName ?? "Fee"} · ${t.fromWalletName ?? ""}` };
  if (t.personId) {
    const ownWallet = isPersonWallet(t.fromWalletName) ? t.toWalletName : t.fromWalletName;
    return { title: loanTitle(t), detail: [t.note, ownWallet].filter(Boolean).join(" · ") };
  }
  if (t.type === "Transfer") return { title: t.note ?? "Transfer", detail: `${t.fromWalletName} → ${t.toWalletName}` };
  const wallet = t.type === "Income" ? t.toWalletName : t.fromWalletName;
  return { title: t.categoryName ?? (t.type === "Income" ? "Income" : "Expense"), detail: [t.note, wallet].filter(Boolean).join(" · ") };
}

export function TransactionRow({ transaction, onOpen }: { transaction: Transaction; onOpen: (transaction: Transaction) => void }) {
  const { title, detail } = describe(transaction);
  const icon = transaction.type === "Transfer" ? "transfer" : transaction.type === "Income" ? "arrowDown" : "arrowUp";
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(transaction)}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-[16px] px-2 py-2.5 text-left hover:bg-[var(--tl-chip)] ${focusRing}`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--tl-chip)] text-[var(--tl-primary)]">
          <Icon name={icon} size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{title}</span>
          <span className="block truncate text-[13px] text-[var(--tl-muted)]">
            {timeLabel(transaction.occurredAt)}
            {detail ? ` · ${detail}` : ""}
          </span>
        </span>
        <span className={`shrink-0 text-[15px] font-extrabold ${TONE[transaction.type]}`}>
          {signedAmount(transaction)}
          {transaction.fee ? <span className="block text-right text-[11px] font-semibold text-[var(--tl-muted)]">+ fee</span> : null}
        </span>
      </button>
    </li>
  );
}
