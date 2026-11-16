import type { Category, Wallet } from "../../api/types";

/** Wallets a person can pick: their own money wallets, not loan wallets, archived only if already chosen. */
export function pickableWallets(wallets: Wallet[], keep: (string | null | undefined)[] = []): Wallet[] {
  return wallets.filter((w) => w.personId === null && (!w.archived || keep.includes(w.id)));
}

export function WalletOptions({ wallets }: { wallets: Wallet[] }) {
  return (
    <>
      {wallets.map((wallet) => (
        <option key={wallet.id} value={wallet.id}>
          {wallet.name}
          {wallet.archived ? " (archived)" : ""}
        </option>
      ))}
    </>
  );
}

/** Top-level categories as groups; the parent itself can be chosen as "General". */
export function CategoryOptions({ categories, keep }: { categories: Category[]; keep?: string | null }) {
  const shown = (c: Category) => !c.archived || c.id === keep;
  const label = (c: Category) => `${c.name}${c.archived ? " (archived)" : ""}`;
  return (
    <>
      {categories.filter((p) => shown(p) || p.children.some((c) => c.id === keep)).map((parent) =>
        parent.children.filter(shown).length === 0 ? (
          <option key={parent.id} value={parent.id}>
            {label(parent)}
          </option>
        ) : (
          <optgroup key={parent.id} label={parent.name}>
            <option value={parent.id}>{label(parent)} (general)</option>
            {parent.children.filter(shown).map((child) => (
              <option key={child.id} value={child.id}>
                {label(child)}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </>
  );
}
