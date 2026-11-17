import { router, Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "../../src/ui/kit";
import { useColors } from "../../src/ui/theme";

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: "Home", icon: "home-variant-outline" },
  history: { label: "History", icon: "format-list-bulleted" },
  reports: { label: "Reports", icon: "chart-bar" },
  more: { label: "More", icon: "dots-horizontal" },
};

/** Home, History, the centre Add button, Reports and More, floating above the content. */
export default function TabsLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background } }}
      tabBar={({ state, navigateToTab }) => {
        const routes = state.routes.filter((r) => TABS[r.name]);
        const items = [...routes.slice(0, 2), null, ...routes.slice(2)];
        return (
          <View
            accessibilityRole="tablist"
            style={{ position: "absolute", left: 12, right: 12, bottom: insets.bottom + 10, flexDirection: "row", alignItems: "center", borderRadius: 26, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 6, height: 68, elevation: 8 }}
          >
            {items.map((route) => {
              if (!route) {
                return (
                  <Pressable
                    key="add"
                    accessibilityRole="button"
                    accessibilityLabel="Add transaction"
                    onPress={() => router.push("/transaction")}
                    style={{ flex: 1, alignItems: "center" }}
                  >
                    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
                      <Icon name="plus" size={30} color={c.onPrimary} />
                    </View>
                  </Pressable>
                );
              }
              const tab = TABS[route.name]!;
              const focused = state.routes[state.index]?.key === route.key;
              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={tab.label}
                  onPress={() => {
                    if (!focused) navigateToTab(route.key);
                  }}
                  style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 56, gap: 2 }}
                >
                  <Icon name={tab.icon} color={focused ? c.tabActive : c.muted} />
                  <Text style={{ fontSize: 12, fontWeight: focused ? "800" : "600", color: focused ? c.tabActive : c.muted }}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        );
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
