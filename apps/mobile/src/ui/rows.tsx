import { formatBdt } from "@takaleaf/shared";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { timeLabel } from "../data/calendar";
import type { TransactionView } from "../data/transactions";
import { useApp } from "../state/AppState";
import { Icon, Money, Row, type IconName } from "./kit";
import { useColors } from "./theme";

const ICONS: Record<TransactionView["type"], IconName> = { Income: "arrow-down-bold-circle-outline", Expense: "arrow-up-bold-circle-outline", Transfer: "swap-horizontal" };

/** Opens a row where it can be changed: a transaction in the form, a fee on its transfer, a loan on its person, an EMI on its loan. */
export function openTransaction(t: Pick<TransactionView, "id" | "feeOfId" | "personId" | "loanId">) {
  if (t.loanId) router.push({ pathname: "/bank-loan", params: { id: t.loanId } });
  else if (t.personId) router.push({ pathname: "/person", params: { id: t.personId } });
  else router.push({ pathname: "/transaction", params: { id: t.feeOfId ?? t.id } });
}

export function TransactionRow({ t, showTime = true }: { t: TransactionView; showTime?: boolean }) {
  const title = t.note ?? t.categoryName ?? (t.type === "Transfer" ? `${t.fromWalletName ?? "?"} → ${t.toWalletName ?? "?"}` : t.type);
  const wallet = t.type === "Transfer" ? `${t.fromWalletName ?? "?"} → ${t.toWalletName ?? "?"}` : (t.fromWalletName ?? t.toWalletName ?? "");
  const detail = [t.note ? t.categoryName : null, wallet, showTime ? timeLabel(t.occurredAt) : null, t.fee ? `fee ${formatBdt(t.fee)}` : null].filter(Boolean).join(" · ");
  const tone = t.type === "Income" ? "income" : t.type === "Expense" ? "expense" : "neutral";
  return (
    <Row
      icon={ICONS[t.type]}
      title={title}
      detail={detail}
      onPress={() => openTransaction(t)}
      accessibilityLabel={`${t.type} ${title}, ${formatBdt(t.amount)}, ${detail}`}
      right={<Money amount={t.type === "Expense" ? -t.amount : t.amount} tone={tone} sign={t.type === "Income"} />}
    />
  );
}

/** "Synced 2 min ago · 3 changes waiting", or the last problem. */
export function SyncLine() {
  const c = useColors();
  const { sync } = useApp();
  const ago = sync.lastSyncedAt ? relative(sync.lastSyncedAt) : "not yet";
  const parts = [sync.running ? "Syncing…" : `Synced ${ago}`];
  if (sync.pending) parts.push(`${sync.pending} ${sync.pending === 1 ? "change" : "changes"} waiting`);
  if (sync.rejected) parts.push(`${sync.rejected} not saved on the server`);
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon name={sync.error ? "cloud-off-outline" : "cloud-check-outline"} size={16} color={sync.error || sync.rejected ? c.expense : c.muted} />
      <Text numberOfLines={2} style={{ color: sync.error || sync.rejected ? c.expense : c.muted, fontSize: 12, flex: 1 }}>
        {sync.error && !sync.running ? `${sync.error} ` : ""}
        {parts.join(" · ")}
      </Text>
    </View>
  );
}

export function relative(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}
