import { formatBdt } from "@takaleaf/shared";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useWallets } from "../../api/queries";
import type { Wallet, WalletType } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { Button, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf } from "../../ui/Feedback";
import { WALLET_TYPE_LABEL } from "../../ui/format";
import { WalletForm } from "./WalletForm";

const ORDER: WalletType[] = ["Cash", "Mfs", "Bank", "CreditCard", "Lent", "Borrowed"];

function WalletCard({ wallet, onOpen }: { wallet: Wallet; onOpen: () => void }) {
  const negative = wallet.balance < 0;
  return (
    <li className="contents">
      <div className="glass flex flex-col gap-3 rounded-[20px] p-4">
        <button type="button" onClick={onOpen} className={`cursor-pointer rounded-[12px] text-left ${focusRing}`} aria-label={`Edit ${wallet.name}`}>
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold">{wallet.name}</span>
              <span className="block text-[13px] text-[var(--tl-muted)]">
                {WALLET_TYPE_LABEL[wallet.type]}
                {wallet.excludedFromTotal ? " · not in net balance" : ""}
              </span>
            </span>
            {wallet.archived ? (
              <span className="rounded-full bg-[var(--tl-chip)] px-2 py-0.5 text-[11px] font-bold text-[var(--tl-muted)]">Archived</span>
            ) : null}
          </span>
          <span className={`mt-3 block text-2xl font-extrabold tracking-tight ${negative ? "text-expense dark:text-expense-dark" : ""}`}>
            {formatBdt(wallet.balance)}
          </span>
          {wallet.type === "CreditCard" && wallet.availableCredit !== null ? (
            <span className="block text-[13px] text-[var(--tl-muted)]">
              {formatBdt(wallet.availableCredit)} available of {formatBdt(wallet.creditLimit ?? 0)}
            </span>
          ) : null}
        </button>
        <Link to={`/transactions?walletId=${wallet.id}&from=2000-01-01`} className="text-[13px] font-bold text-[var(--tl-primary)]">
          See transactions
        </Link>
      </div>
    </li>
  );
}

export function WalletsPage() {
  const wallets = useWallets();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const adding = params.get("add") === "1";

  const all = wallets.data?.wallets ?? [];
  const visible = all.filter((w) => showArchived || !w.archived);
  const archivedCount = all.filter((w) => w.archived).length;
  const closeForm = () => {
    setEditing(null);
    if (adding) setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader title="Wallets">
        <Button onClick={() => setParams({ add: "1" }, { replace: true })}>Add a wallet</Button>
      </PageHeader>

      {wallets.isPending ? <Loading /> : null}
      {wallets.error ? <ErrorNote>{messageOf(wallets.error)}</ErrorNote> : null}

      {wallets.data ? (
        <>
          <section aria-label="Totals" className="mb-5 grid grid-cols-3 gap-3">
            {[
              ["Net balance", wallets.data.totals.net],
              ["Assets", wallets.data.totals.assets],
              ["Owed", wallets.data.totals.liabilities],
            ].map(([label, value]) => (
              <div key={label} className="glass min-w-0 rounded-[18px] p-3">
                <p className="m-0 text-[12px] font-semibold text-[var(--tl-muted)]">{label}</p>
                <p className="m-0 truncate text-[15px] font-extrabold sm:text-lg">{formatBdt(value as number)}</p>
              </div>
            ))}
          </section>

          {all.length === 0 ? (
            <section className="glass rounded-[22px]">
              <EmptyState title="No wallets yet">
                <p className="m-0 max-w-sm text-sm text-[var(--tl-muted)]">Cash, a bank account, bKash, a credit card — add each with what it holds today.</p>
              </EmptyState>
            </section>
          ) : null}

          {ORDER.map((type) => {
            const group = visible.filter((w) => w.type === type);
            if (group.length === 0) return null;
            return (
              <section key={type} className="mb-5" aria-labelledby={`group-${type}`}>
                <h2 id={`group-${type}`} className="m-0 mb-2 text-[13px] font-extrabold uppercase tracking-wide text-[var(--tl-muted)]">
                  {WALLET_TYPE_LABEL[type]}
                </h2>
                <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
                  {group.map((wallet) => (
                    <WalletCard key={wallet.id} wallet={wallet} onOpen={() => setEditing(wallet)} />
                  ))}
                </ul>
              </section>
            );
          })}

          {archivedCount > 0 ? (
            <Button variant="ghost" onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
            </Button>
          ) : null}
        </>
      ) : null}

      {adding || editing ? <WalletForm wallet={editing} onClose={closeForm} /> : null}
    </>
  );
}
