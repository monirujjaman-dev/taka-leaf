import { formatBdt, TAGLINE } from "@takaleaf/shared";
import { desc } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { checkHealth, normaliseServerUrl } from "../src/api/health";
import { registerHealthTask, runHealthTaskNow, type BackgroundState } from "../src/background";
import { SERVER_URL_KEY } from "../src/backgroundCheck";
import { db } from "../src/db/client";
import { healthChecks, probeNotes } from "../src/db/schema";
import { addNote, getSetting, recordCheck, setSetting, sqliteVersion } from "../src/db/store";
import { AppLoader } from "../src/ui/AppLoader";
import { Body, Button, Card, Field } from "../src/ui/parts";
import { useColors } from "../src/ui/theme";

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" }).format(new Date(iso));

/**
 * A1 setup checks. Three experiments to run on the owner's phone before the real screens:
 * 1. SQLite keeps notes after the app is closed and opened again.
 * 2. The phone reaches the TakaLeaf server.
 * 3. Android runs the background task with the app closed, and it writes to SQLite.
 */
export default function SetupScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const notes = useLiveQuery(db.select().from(probeNotes).orderBy(desc(probeNotes.id)));
  const checks = useLiveQuery(db.select().from(healthChecks).orderBy(desc(healthChecks.id)).limit(8));
  const [note, setNote] = useState("");
  const [server, setServer] = useState(() => getSetting(db, SERVER_URL_KEY) ?? "");
  const [serverError, setServerError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [background, setBackground] = useState<BackgroundState | "starting">("starting");

  useEffect(() => {
    registerHealthTask().then(setBackground, () => setBackground("unavailable"));
  }, []);

  async function checkNow() {
    const url = normaliseServerUrl(server);
    if (!url) return setServerError("Enter the server address, like takaleaf.example.com.");
    setServerError(null);
    setServer(url);
    setSetting(db, SERVER_URL_KEY, url);
    setChecking(true);
    recordCheck(db, "app", await checkHealth(url));
    setChecking(false);
  }

  const backgroundText = {
    starting: "Starting…",
    on: "On. Android runs it about every 15 minutes or more, also with the app closed.",
    restricted: "Android is not allowing background work for this app. Check battery settings.",
    unavailable: "Background work is not available in this build.",
  }[background];

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brand}>
        <Image source={require("../assets/adaptive-foreground.png")} style={{ width: 48, height: 48 }} accessibilityIgnoresInvertColors />
        <View>
          <Text style={[styles.wordmark, { color: c.text }]}>
            Taka<Text style={{ color: c.primary }}>Leaf</Text>
          </Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>{TAGLINE}</Text>
        </View>
      </View>
      <Text accessibilityRole="header" style={[styles.h1, { color: c.text }]}>
        Setup checks
      </Text>
      <Body muted>
        Three quick checks before the real app is built on this phone. Shared money format: {formatBdt(12500000)}.
      </Body>

      <Card title="1. Saved on this phone">
        <Body muted>
          Add a note, close the app fully (swipe it away), then open it again. The notes should still be here. SQLite{" "}
          {sqliteVersion(db)}.
        </Body>
        <Field label="Note" value={note} onChangeText={setNote} placeholder="Anything, like 'first test'" returnKeyType="done" />
        <Button
          label="Save note"
          disabled={!note.trim()}
          onPress={() => {
            addNote(db, note);
            setNote("");
          }}
        />
        <Body>{notes.data.length === 0 ? "No notes yet." : `${notes.data.length} saved`}</Body>
        {notes.data.slice(0, 5).map((n) => (
          <Text key={n.id} style={{ color: c.text, fontSize: 14 }}>
            • {n.text} <Text style={{ color: c.muted }}>· {when(n.createdAt)}</Text>
          </Text>
        ))}
      </Card>

      <Card title="2. Reaches your server">
        <Field
          label="Server address"
          value={server}
          onChangeText={setServer}
          placeholder="takaleaf.example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        {serverError ? <Text style={{ color: c.expense, fontWeight: "600" }}>{serverError}</Text> : null}
        <Button label={checking ? "Checking…" : "Check now"} disabled={checking} onPress={() => void checkNow()} />
        {checking ? <AppLoader size={44} label="Asking your server…" /> : null}
      </Card>

      <Card title="3. Works with the app closed">
        <Body muted>{backgroundText}</Body>
        {__DEV__ ? <Button kind="secondary" label="Run the background task now" onPress={() => void runHealthTaskNow()} /> : null}
        <Body muted>Leave the app closed for an hour, then come back: rows marked "background" prove it ran.</Body>
      </Card>

      <Card title="Server checks">
        {checks.data.length === 0 ? <Body muted>None yet.</Body> : null}
        {checks.data.map((check) => (
          <View key={check.id} style={styles.checkRow}>
            <Text style={{ color: check.ok ? c.income : c.expense, fontWeight: "800", width: 18 }}>{check.ok ? "✓" : "✗"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 14, fontWeight: "700" }}>{check.detail}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>
                {check.source} · {when(check.checkedAt)}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 14 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  h1: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, marginTop: 8 },
  checkRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
});
