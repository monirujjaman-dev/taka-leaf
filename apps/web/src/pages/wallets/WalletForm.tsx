import { formatBdt, parseTaka } from "@takaleaf/shared";
import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { useSaveWallet, useWalletAction } from "../../api/queries";
import type { Wallet, WalletType } from "../../api/types";
import { Button, focusRing } from "../../ui/Button";
import { ErrorNote, messageOf } from "../../ui/Feedback";
import { AmountField, SelectField, TextField } from "../../ui/Field";
import { toAmountText, WALLET_TYPE_LABEL } from "../../ui/format";
import { Modal } from "../../ui/Modal";

const TYPES: WalletType[] = ["Cash", "Bank", "Mfs", "CreditCard"];
const MFS_NAMES = ["bKash", "Nagad", "Upay", "Rocket"];

/**
 * Add or edit a wallet. A credit card is entered as "owed now" (a positive number) and kept as a
 * negative opening balance, so a person never has to type a minus sign.
 */
export function WalletForm({ wallet, onClose }: { wallet: Wallet | null; onClose: () => void }) {
  const save = useSaveWallet();
  const action = useWalletAction();
  const [type, setType] = useState<WalletType>(wallet?.type ?? "Cash");
  const [name, setName] = useState(wallet?.name ?? "");
  const card = type === "CreditCard";
  const [opening, setOpening] = useState(toAmountText(wallet ? (card ? -wallet.openingBalance : wallet.openingBalance) : null));
  const [owedIsCredit, setOwedIsCredit] = useState(wallet ? card && wallet.openingBalance > 0 : false);
  const [limit, setLimit] = useState(toAmountText(wallet?.creditLimit));
  const [excluded, setExcluded] = useState(wallet?.excludedFromTotal ?? false);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const apiError = save.error instanceof ApiError ? save.error : null;
  const errorFor = (field: string) => problems[field] ?? apiError?.field(field);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const openingPoisha = opening.trim() === "" ? 0 : parseTaka(opening);
    const limitPoisha = card && limit.trim() !== "" ? parseTaka(limit) : null;
    if (!name.trim()) found.name = "Give the wallet a name.";
    if (openingPoisha === null) found.openingBalance = "Enter an amount like 5000 or 5000.50.";
    if (card && limit.trim() !== "" && limitPoisha === null) found.creditLimit = "Enter the limit like 100000.";
    setProblems(found);
    if (Object.keys(found).length > 0) return;

    const signedOpening = card && !owedIsCredit ? -openingPoisha! : openingPoisha!;
    await save
      .mutateAsync({
        id: wallet?.id ?? null,
        input: { type: wallet ? undefined : type, name: name.trim(), openingBalance: signedOpening, creditLimit: limitPoisha, excludedFromTotal: excluded },
      })
      .then(onClose, () => {});
  }

  async function run(kind: "archive" | "unarchive" | "delete") {
    if (!wallet) return;
    await action.mutateAsync({ id: wallet.id, action: kind }).then(onClose, () => {});
  }

  const generalError = apiError && Object.keys(apiError.fieldErrors).length === 0 ? apiError.message : messageOf(action.error);

  return (
    <Modal title={wallet ? `Edit ${wallet.name}` : "Add a wallet"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {wallet ? (
          <p className="m-0 text-sm text-[var(--tl-muted)]">
            {WALLET_TYPE_LABEL[wallet.type]} · balance now {formatBdt(wallet.balance)}
          </p>
        ) : (
          <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value as WalletType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {WALLET_TYPE_LABEL[t]}
              </option>
            ))}
          </SelectField>
        )}

        <TextField label="Name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} error={errorFor("name")} />
        {type === "Mfs" && !wallet ? (
          <div className="-mt-2 flex flex-wrap gap-2" aria-label="Common names">
            {MFS_NAMES.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setName(suggestion)}
                className={`h-11 cursor-pointer rounded-full bg-[var(--tl-chip)] px-4 text-[13px] font-bold text-[var(--tl-primary)] ${focusRing}`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <AmountField
          label={card ? "Amount owed now (৳)" : "Balance when you start tracking (৳)"}
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
          error={errorFor("openingBalance")}
          hint={
            wallet
              ? "Changing this moves the balance by the same amount; transactions stay as they are."
              : card
                ? "What the card's statement says you owe today. Leave empty if nothing."
                : "Leave empty to start at zero."
          }
        />
        {card ? (
          <>
            <label className="-mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={owedIsCredit} onChange={(e) => setOwedIsCredit(e.target.checked)} className="h-4 w-4 accent-forest" />
              The card is in credit (you paid more than you owed)
            </label>
            <AmountField label="Credit limit (৳, optional)" value={limit} onChange={(e) => setLimit(e.target.value)} error={errorFor("creditLimit")} />
          </>
        ) : null}

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={excluded} onChange={(e) => setExcluded(e.target.checked)} className="mt-0.5 h-4 w-4 accent-forest" />
          <span>
            Leave out of net balance
            <span className="block text-[13px] text-[var(--tl-muted)]">For money you keep for someone else, for example.</span>
          </span>
        </label>

        <ErrorNote>{generalError}</ErrorNote>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {wallet ? (
            <span className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => run(wallet.archived ? "unarchive" : "archive")} disabled={action.isPending}>
                {wallet.archived ? "Bring back" : "Archive"}
              </Button>
              {confirmDelete ? (
                <Button variant="danger" onClick={() => run("delete")} disabled={action.isPending}>
                  Yes, delete
                </Button>
              ) : (
                <Button variant="ghost" className="text-expense dark:text-expense-dark" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </span>
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </span>
        </div>
      </form>
    </Modal>
  );
}
