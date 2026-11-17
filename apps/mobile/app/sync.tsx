import { useState } from "react";
import { db } from "../src/db/client";
import { clearRejected, rejectedChanges } from "../src/sync/engine";
import { useApp, useData } from "../src/state/AppState";
import { Body, Button, Card, Notice, Row, Screen } from "../src/ui/kit";
import { relative, SyncLine } from "../src/ui/rows";

const NAMES: Record<string, string> = { wallets: "Wallet", categories: "Category", people: "Person", transactions: "Transaction", budgets: "Budget", recurringRules: "Recurring" };

/** The saved change, for its name. A damaged payload shows the row without one rather than break the screen. */
function readPayload(payload: string): { name?: string; note?: string } {
  try {
    const row: unknown = JSON.parse(payload);
    return row && typeof row === "object" ? (row as { name?: string; note?: string }) : {};
  } catch {
    return {};
  }
}

export default function SyncStatus() {
  const { sync, syncNow } = useApp();
  const rejected = useData(() => rejectedChanges(db));
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setResult(null);
    await syncNow();
    setResult("Done.");
  }

  return (
    <Screen title="Sync" back>
      <Card>
        <SyncLine />
        <Body muted>
          Changes are saved on this phone first and sent to your server when there is a connection: when the app opens, a few seconds after a save, when the internet comes back, and in the background.
        </Body>
        <Button label={sync.running ? "Syncing…" : "Sync now"} disabled={sync.running} onPress={() => void run()} />
        {result && !sync.error ? <Notice>{`Synced. ${sync.pending ? `${sync.pending} still waiting.` : "Nothing waiting."}`}</Notice> : null}
        {sync.error && !sync.running ? <Notice tone="expense">{sync.error}</Notice> : null}
      </Card>
      <Card title="Not saved on the server">
        {rejected.length === 0 ? <Body muted>Everything you saved reached the server.</Body> : null}
        {rejected.map((r) => {
          const row = readPayload(r.payload);
          return <Row key={r.id} icon="alert-circle-outline" title={`${NAMES[r.tableName] ?? r.tableName}${row.name ? `: ${row.name}` : row.note ? `: ${row.note}` : ""}`} detail={`${r.reason} · ${relative(r.createdAt)}`} />;
        })}
        {rejected.length ? (
          <>
            <Body muted>The server kept its own version of these. Make the change again if you still need it.</Body>
            <Button kind="secondary" label="Clear this list" onPress={() => clearRejected(db)} />
          </>
        ) : null}
      </Card>
    </Screen>
  );
}
