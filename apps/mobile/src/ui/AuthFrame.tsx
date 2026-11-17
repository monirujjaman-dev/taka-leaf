import { TAGLINE } from "@takaleaf/shared";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLUMN_MAX } from "./kit";
import { LeafMark } from "./LeafMark";
import { useColors } from "./theme";

/** The sign-in screens: a forest band with the leaf and tagline, then the card. */
export function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={{ backgroundColor: c.hero, paddingTop: insets.top + 28, paddingBottom: 36, paddingHorizontal: 24, gap: 10, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <LeafMark size={40} onDark />
            <Text style={{ color: c.onHero, fontSize: 24, fontWeight: "800" }}>TakaLeaf</Text>
          </View>
          <Text style={{ color: c.onHeroMuted, fontSize: 16, fontWeight: "600" }}>{TAGLINE}</Text>
        </View>
        <View style={{ padding: 20, gap: 16, width: "100%", maxWidth: COLUMN_MAX, alignSelf: "center" }}>
          <Text accessibilityRole="header" style={{ color: c.text, fontSize: 26, fontWeight: "800" }}>
            {title}
          </Text>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
