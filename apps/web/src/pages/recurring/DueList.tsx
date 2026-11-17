import { formatBdt, parseTaka } from "@takaleaf/shared";
import { useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { useRecurringAction } from "../../api/queries";
import type { RecurringRule } from "../../api/types";
import { Button } from "../../ui/Button";
import { ErrorNote, messageOf } from "../../ui/Feedback";
import { AmountField } from "../../ui/Field";
import { dayLabel, toAmountText } from "../../ui/format";
import { Modal } from "../../ui/Modal";

export function ruleTitle(rule: RecurringRule): string {
  return rule.note ?? rule.categoryName ?? (rule.type === "Transfer" ? `${rule.fromWalletName} → ${rule.toWalletName}` : rule.type);
}

function RecordForm({ rule, onClose }: { rule: RecurringRule; onClose: () => void }) {
  const action = useRecurringAction();
  const [amount, setAmount] = useState(toAmountText(rule.amount));
  const [problem, setProblem] = useState<string | null>(null);
  const apiError = action.error instanceof ApiError ? action.error : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const poisha = parseTaka(amount);
    if (poisha === null || poisha <= 0) return setProblem("Enter an amount above zero, like 1250 or 1250.50.");
    setProblem(null);
    await action.mutateAsync({ id: rule.id, action: "record", amount: poisha }).then(onClose, () => {});
  }

  return (
    <Modal title={`Record ${ruleTitle(rule)}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="m-0 text-sm text-[var(--tl-muted)]">
          Due {dayLabel(rule.nextDate!)} · {rule.type === "Income" ? `into ${rule.toWalletName}` : `from ${rule.fromWalletName}`}
        </p>
        <AmountField label="Amount (৳)" value={amount} onChange={(e) => setAmount(e.target.value)} error={problem ?? apiError?.field("amount")} />
        <ErrorNote>{apiError && !apiError.field("amount") ? apiError.message : null}</ErrorNote>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={action.isPending}>
            Record
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Rules waiting for the user, oldest date first, each with Record and Skip. */
export function DueList({ rules }: { rules: RecurringRule[] }) {
  const action = useRecurringAction();
  const [recording, setRecording] = useState<RecurringRule | null>(null);

  return (
    <>
      <ErrorNote>{messageOf(action.error)}</ErrorNote>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rules.map((rule) => (
          <li key={rule.id} className="flex flex-wrap items-center gap-3 rounded-[16px] bg-[var(--tl-chip)] px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold">{ruleTitle(rule)}</span>
              <span className="block text-[13px] text-[var(--tl-muted)]">
                {formatBdt(rule.amount)} · due {dayLabel(rule.nextDate!)}
                {rule.dueCount > 1 ? ` · ${rule.dueCount} dates waiting` : ""}
              </span>
            </span>
            <span className="flex gap-1.5">
              <Button variant="ghost" className="px-3" disabled={action.isPending} onClick={() => action.mutate({ id: rule.id, action: "skip" })}>
                Skip
              </Button>
              <Button className="px-3" onClick={() => setRecording(rule)}>
                Record
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {recording ? <RecordForm rule={recording} onClose={() => setRecording(null)} /> : null}
    </>
  );
}
