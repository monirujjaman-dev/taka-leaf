import { TAGLINE } from "@takaleaf/shared";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LeafMark } from "./LeafMark";
import { useColors } from "./theme";

/** The sign-in screens: a forest band with the leaf and tagline, then the card. */
export function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={{ backgroundColor: "#0F7A44", paddingTop: insets.top + 28, paddingBottom: 36, paddingHorizontal: 24, gap: 10, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <LeafMark size={40} onDark />
            <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "800" }}>TakaLeaf</Text>
          </View>
          <Text style={{ color: "#D7EFE0", fontSize: 16, fontWeight: "600" }}>{TAGLINE}</Text>
        </View>
        <View style={{ padding: 20, gap: 16 }}>
          <Text accessibilityRole="header" style={{ color: c.text, fontSize: 26, fontWeight: "800" }}>
            {title}
          </Text>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
