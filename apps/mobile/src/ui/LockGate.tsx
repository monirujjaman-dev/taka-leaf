import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, BackHandler, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { biometricEnabled, checkPin, failures, lockEnabled, MAX_FAILURES, turnOffLock, unlockWithBiometric } from "../state/lock";
import { useApp } from "../state/AppState";
import { Button, ErrorText, Icon } from "./kit";
import { LeafMark } from "./LeafMark";
import { AnimatedPressable, usePressScale } from "./motion";
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
  const showLock = locked && !signedOut;
  const unlock = useCallback(() => setLocked(false), []);

  // While locked, Back must not move the screens hidden underneath.
  useEffect(() => {
    if (!showLock) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [showLock]);

  return (
    <View style={{ flex: 1 }}>
      {/* The app stays drawn under the lock, so hide it from TalkBack: otherwise it could read balances and press buttons there. */}
      <View style={{ flex: 1 }} importantForAccessibility={showLock ? "no-hide-descendants" : "auto"} accessibilityElementsHidden={showLock}>
        {children}
      </View>
      {showLock ? <LockScreen onUnlock={unlock} /> : null}
    </View>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useApp();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  // A PIN is being checked: keys wait, so one PIN is never checked twice or run into the next.
  const checking = useRef(false);
  const bio = biometricEnabled();

  // Ask for the fingerprint once when the lock appears, not again on every re-render.
  useEffect(() => {
    if (bio) void unlockWithBiometric().then((ok) => ok && onUnlock());
  }, [bio, onUnlock]);

  async function submit(value: string) {
    if (checking.current) return;
    checking.current = true;
    try {
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
    } finally {
      checking.current = false;
    }
  }

  function press(key: string) {
    if (checking.current) return;
    if (key === "del") return setPin(pin.slice(0, -1));
    if (pin.length >= 6) return;
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
            <LockKey
              key={key}
              label={key === "del" ? "Delete digit" : key === "bio" ? "Use fingerprint" : key}
              onPress={() => (key === "bio" ? void unlockWithBiometric().then((ok) => ok && onUnlock()) : press(key))}
            >
              {key === "del" ? <Icon name="backspace-outline" /> : key === "bio" ? <Icon name="fingerprint" /> : <Text maxFontSizeMultiplier={1.4} style={{ color: c.text, fontSize: 26, fontWeight: "700" }}>{key}</Text>}
            </LockKey>
          ),
        )}
      </View>
      {pin.length >= 4 && pin.length < 6 ? <Button label="Unlock" onPress={() => void submit(pin)} /> : null}
    </View>
  );
}

/** A PIN key: it ripples and presses to 0.97, so each digit is felt even though the dots are small. */
function LockKey({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const c = useColors();
  const pressScale = usePressScale();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={pressScale.onPressIn}
      onPressOut={pressScale.onPressOut}
      android_ripple={{ color: c.ripple }}
      style={{ width: 80, height: 64, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: c.glass, borderWidth: 1, borderColor: c.border, transform: [{ scale: pressScale.scale }] }}
    >
      {children}
    </AnimatedPressable>
  );
}
