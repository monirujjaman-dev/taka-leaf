import "../src/background";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import migrations from "../drizzle/migrations";
import { registerSyncTask } from "../src/background";
import { db } from "../src/db/client";
import { AppProvider, useApp } from "../src/state/AppState";
import { AppLoader } from "../src/ui/AppLoader";
import { LockGate } from "../src/ui/LockGate";
import { useReduceMotion } from "../src/ui/motion";
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
      <AppProvider>
        <StatusBar style="auto" />
        <Gate />
      </AppProvider>
    </SafeAreaProvider>
  );
}

/** Signed out → the sign-in screens; signed in → the app. Local data and the outbox stay either way. */
function Gate() {
  const colors = useColors();
  const { signedOut } = useApp();
  const segments = useSegments();
  const inAuth = segments[0] === "(auth)";
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (signedOut && !inAuth) router.replace("/sign-in");
    else if (!signedOut && inAuth) router.replace("/");
  }, [signedOut, inAuth]);

  useEffect(() => {
    if (!signedOut) void registerSyncTask();
  }, [signedOut]);

  return (
    <LockGate>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {/*
          The add sheet rises from the bottom edge, where the Add button is, as on the web; every
          other screen keeps Android's own transition. With "Remove animations" it fades in place.
        */}
        <Stack.Screen name="transaction" options={{ animation: reduceMotion ? "fade" : "slide_from_bottom", animationDuration: 260 }} />
      </Stack>
    </LockGate>
  );
}
