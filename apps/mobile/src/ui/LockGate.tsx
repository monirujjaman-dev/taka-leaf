import { useEffect, useState, type ReactNode } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { biometricEnabled, checkPin, failures, lockEnabled, MAX_FAILURES, turnOffLock, unlockWithBiometric } from "../state/lock";
import { useApp } from "../state/AppState";
import { Button, ErrorText, Icon } from "./kit";
import { LeafMark } from "./LeafMark";
import { useColors } from "./theme";

/** Covers the app with the lock when it opens and whenever it comes back from the background. */
export function LockGate({ children }: { children: ReactNode }) {
  const { signedOut } = useApp();
  const [locked, setLocked] = useState(() => lockEnabled());
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" && lockEnabled()) setLocked(true);
    });
    return () => subscription.remove();
  }, []);
  return (
    <View style={{ flex: 1 }}>
      {children}
      {locked && !signedOut ? <LockScreen onUnlock={() => setLocked(false)} /> : null}
    </View>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useApp();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bio = biometricEnabled();

  useEffect(() => {
    if (bio) void unlockWithBiometric().then((ok) => ok && onUnlock());
  }, [bio, onUnlock]);

  async function submit(value: string) {
    if (await checkPin(value)) return onUnlock();
    setPin("");
    const left = MAX_FAILURES - failures();
    if (left <= 0) {
      await turnOffLock();
      await signOut();
      onUnlock();
      return;
    }
    setError(`That PIN is not right. ${left} ${left === 1 ? "try" : "tries"} left before you must sign in again.`);
  }

  function press(key: string) {
    if (key === "del") return setPin(pin.slice(0, -1));
    const next = pin + key;
    setPin(next);
    if (next.length === 6) void submit(next);
  }

  return (
    <View accessibilityViewIsModal style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.background, paddingTop: insets.top + 40, paddingHorizontal: 24, gap: 18, alignItems: "center" }}>
      <LeafMark size={56} />
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 22, fontWeight: "800" }}>
        Enter your PIN
      </Text>
      <View accessibilityLabel={`${pin.length} digits entered`} style={{ flexDirection: "row", gap: 12, minHeight: 20 }}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i < pin.length ? c.primary : c.track }} />
        ))}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, width: 264, justifyContent: "center" }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "del"].map((key) =>
          key === "bio" && !bio ? (
            <View key={key} style={{ width: 80, height: 64 }} />
          ) : (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === "del" ? "Delete digit" : key === "bio" ? "Use fingerprint" : key}
              onPress={() => (key === "bio" ? void unlockWithBiometric().then((ok) => ok && onUnlock()) : press(key))}
              style={({ pressed }) => ({ width: 80, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.chip : c.glass, borderWidth: 1, borderColor: c.border })}
            >
              {key === "del" ? <Icon name="backspace-outline" /> : key === "bio" ? <Icon name="fingerprint" /> : <Text style={{ color: c.text, fontSize: 26, fontWeight: "700" }}>{key}</Text>}
            </Pressable>
          ),
        )}
      </View>
      {pin.length >= 4 && pin.length < 6 ? <Button label="Unlock" onPress={() => void submit(pin)} /> : null}
    </View>
  );
}
