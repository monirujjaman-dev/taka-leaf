import "../src/background";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import migrations from "../drizzle/migrations";
import { db } from "../src/db/client";
import { AppLoader } from "../src/ui/AppLoader";
import { useColors } from "../src/ui/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colors = useColors();
  const { success, error } = useMigrations(db, migrations);

  // Hand over from the native splash to the animated loader as soon as React draws.
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background }}>
        <Text style={{ color: colors.expense, fontSize: 16, fontWeight: "700" }}>The database could not be prepared.</Text>
        <Text style={{ color: colors.muted, marginTop: 8 }}>{error.message}</Text>
      </View>
    );
  }
  if (!success) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <AppLoader label="Opening TakaLeaf…" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </SafeAreaProvider>
  );
}
