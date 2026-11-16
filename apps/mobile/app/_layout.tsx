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
import { useColors } from "../src/ui/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colors = useColors();
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (success || error) void SplashScreen.hideAsync();
  }, [success, error]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background }}>
        <Text style={{ color: colors.expense, fontSize: 16, fontWeight: "700" }}>The database could not be prepared.</Text>
        <Text style={{ color: colors.muted, marginTop: 8 }}>{error.message}</Text>
      </View>
    );
  }
  if (!success) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </SafeAreaProvider>
  );
}
