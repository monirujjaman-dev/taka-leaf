import { formatBdt } from "@takaleaf/shared";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useWallets } from "../../api/queries";
import type { Wallet, WalletType } from "../../api/types";
import { PageHeader } from "../../layout/AppShell";
import { Button, focusRing } from "../../ui/Button";
import { EmptyState, ErrorNote, Loading, messageOf, LoadError } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { Chevron, IconTile, iconButtonClass, ListCard, SectionHeading, StatGrid, StatTile, walletIcon } from "../../ui/Parts";
import { WALLET_TYPE_LABEL } from "../../ui/format";
import { WalletForm } from "./WalletForm";

/** The design's groups. Lent and Borrowed wallets belong to people and are summed under Loans. */
const GROUPS: { title: string; types: WalletType[] }[] = [
  { title: "Cash and bank", types: ["Cash", "Bank"] },
  { title: "MFS", types: ["Mfs"] },
  { title: "Credit card", types: ["CreditCard"] },
];

function detail(wallet: Wallet): string {
  if (wallet.type === "CreditCard" && wallet.creditLimit !== null && wallet.availableCredit !== null)
    return `Limit ${formatBdt(wallet.creditLimit)} · ${formatBdt(wallet.availableCredit)} left`;
  return [WALLET_TYPE_LABEL[wallet.type], wallet.excludedFromTotal ? "not in net balance" : null, wallet.archived ? "archived" : null]
    .filter(Boolean)
    .join(" · ");
}

function WalletRow({ wallet, onOpen }: { wallet: Wallet; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`-mx-1.5 flex min-h-14 w-[calc(100%+12px)] py-1.5 cursor-pointer items-center gap-3 rounded-[14px] px-1.5 text-left hover:bg-[var(--tl-chip)] ${focusRing}`}
      >
        <IconTile icon={walletIcon(wallet.type)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-bold">{wallet.name}</span>
          <span className="block truncate text-caption text-[var(--tl-muted)]">{detail(wallet)}</span>
        </span>
        <span className={`shrink-0 text-body font-extrabold ${wallet.balance < 0 ? "text-expense dark:text-expense-dark" : ""}`}>
          {formatBdt(wallet.balance)}
        </span>
        {/* Read as "Cash, Cash, ৳8,500.00, edit": the balance stays in the button's name. */}
        <span className="sr-only">, edit</span>
        <Chevron />
      </button>
    </li>
  );
}

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

export function WalletsPage() {
  const wallets = useWallets();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const adding = params.get("add") === "1";

  const everything = wallets.data?.wallets ?? [];
  const all = everything.filter((w) => w.personId === null);
  const visible = all.filter((w) => showArchived || !w.archived);
  const archivedCount = all.filter((w) => w.archived).length;
  const lent = everything.filter((w) => w.type === "Lent" && w.balance !== 0);
  const borrowed = everything.filter((w) => w.type === "Borrowed" && w.balance !== 0);
  const sum = (list: Wallet[]) => list.reduce((total, w) => total + Math.abs(w.balance), 0);
  const openAdd = () => setParams({ add: "1" }, { replace: true });
  const closeForm = () => {
    setEditing(null);
    if (adding) setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Wallets"
        back="/settings"
        phoneAction={
          <button type="button" aria-label="Add a wallet" onClick={openAdd} className={iconButtonClass}>
            <Icon name="plus" size={20} />
          </button>
        }
      >
        <Button onClick={openAdd} aria-label="Add a wallet">
          <Icon name="plus" size={18} /> Add a wallet
        </Button>
      </PageHeader>

      {wallets.isPending ? <Loading /> : null}
      <LoadError query={wallets} />

      {wallets.data ? (
        <div className="flex flex-col gap-3">
          <StatGrid label="Totals" className="lg:max-w-xl">
            <StatTile icon="moneyIn" label="Assets" value={formatBdt(wallets.data.totals.assets)} />
            <StatTile icon="moneyOut" tone="expense" label="Liabilities" value={formatBdt(wallets.data.totals.liabilities)} />
          </StatGrid>

          {all.length === 0 ? (
            <section className="glass rounded-[22px]">
              <EmptyState title="No wallets yet">
                <p className="m-0 max-w-sm text-body text-[var(--tl-muted)]">Cash, a bank account, bKash, a credit card — add each with what it holds today.</p>
              </EmptyState>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
            {GROUPS.map((group) => {
              const list = visible.filter((w) => group.types.includes(w.type));
              if (list.length === 0) return null;
              const id = `group-${group.title.replace(/\W/g, "")}`;
              return (
                <section key={group.title} aria-labelledby={id} className="flex flex-col gap-2">
                  <SectionHeading id={id} title={group.title}>
                    {formatBdt(list.reduce((total, w) => total + w.balance, 0))}
                  </SectionHeading>
                  <ListCard>
                    <ul className="m-0 flex list-none flex-col p-0">
                      {list.map((wallet) => (
                        <WalletRow key={wallet.id} wallet={wallet} onOpen={() => setEditing(wallet)} />
                      ))}
                    </ul>
                  </ListCard>
                </section>
              );
            })}

            {lent.length + borrowed.length > 0 ? (
              <section aria-labelledby="group-loans" className="flex flex-col gap-2">
                <SectionHeading id="group-loans" title="Loans" />
                <ListCard>
                  <ul className="m-0 flex list-none flex-col p-0">
                    {[
                      { list: lent, label: "Lent to others", icon: "moneyOut" as const },
                      { list: borrowed, label: "Borrowed", icon: "moneyIn" as const },
                    ]
                      .filter((row) => row.list.length > 0)
                      .map((row) => (
                        <li key={row.label}>
                          <Link
                            to="/people"
                            className={`-mx-1.5 flex min-h-14 items-center py-1.5 gap-3 rounded-[14px] px-1.5 hover:bg-[var(--tl-chip)] ${focusRing}`}
                          >
                            <IconTile icon={row.icon} tone={row.label === "Borrowed" ? "expense" : "primary"} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-body font-bold">{row.label}</span>
                              <span className="block text-caption text-[var(--tl-muted)]">{people(row.list.length)}</span>
                            </span>
                            <span className="text-body font-extrabold">{formatBdt(sum(row.list))}</span>
                            <Chevron />
                          </Link>
                        </li>
                      ))}
                  </ul>
                </ListCard>
              </section>
            ) : null}
          </div>

          {archivedCount > 0 ? (
            <Button variant="ghost" className="self-start" onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
            </Button>
          ) : null}
        </div>
      ) : null}

      {adding || editing ? <WalletForm wallet={editing} onClose={closeForm} /> : null}
    </>
  );
}
