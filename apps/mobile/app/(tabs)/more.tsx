import { initialOf } from "@takaleaf/shared";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { serverUrl } from "../../src/state/account";
import { useApp } from "../../src/state/AppState";
import { Card, ConfirmButton, Row, Screen } from "../../src/ui/kit";
import { SyncLine } from "../../src/ui/rows";
import { useColors } from "../../src/ui/theme";

export default function More() {
  const c = useColors();
  const { user, signOut, sync } = useApp();
  return (
    <Screen title="More">
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: c.onPrimary, fontSize: 20, fontWeight: "800" }}>{initialOf(user?.name ?? "", "T")}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: "800" }}>{user?.name || "Add your name"}</Text>
            <Text style={{ color: c.muted }}>{user?.email}</Text>
          </View>
        </View>
        <Row icon="account-edit-outline" title="Account" detail="Name and password" onPress={() => router.push("/account")} />
      </Card>
      <Card>
        <Row icon="wallet-outline" title="Wallets" onPress={() => router.push("/wallets")} />
        <Row icon="account-group-outline" title="People and loans" onPress={() => router.push("/people")} />
        <Row icon="bank-outline" title="Bank loans and card EMIs" onPress={() => router.push("/bank-loans")} />
        <Row icon="target" title="Budgets" onPress={() => router.push("/budgets")} />
        <Row icon="calendar-sync-outline" title="Recurring" onPress={() => router.push("/recurring")} />
        <Row icon="shape-outline" title="Categories" onPress={() => router.push("/categories")} />
      </Card>
      <Card title="Sync">
        <SyncLine />
        <Row icon="sync" title="Sync status" detail={sync.rejected ? "Some changes were not saved on the server" : "Changes waiting, last sync, problems"} onPress={() => router.push("/sync")} />
        <Text style={{ color: c.muted, fontSize: 12 }}>Connected to {serverUrl().replace(/^https?:\/\//, "")}</Text>
      </Card>
      <Card>
        <Row icon="lock-outline" title="App lock" detail="PIN or fingerprint" onPress={() => router.push("/lock-settings")} />
        <Row icon="bell-outline" title="Daily reminder" onPress={() => router.push("/reminder")} />
      </Card>
      <ConfirmButton label="Sign out" confirmLabel="Yes, sign out" onConfirm={() => void signOut()} />
      <Text style={{ color: c.muted, fontSize: 12, textAlign: "center" }}>TakaLeaf {Constants.expoConfig?.version} · Your data stays on this phone when you sign out.</Text>
    </Screen>
  );
}
