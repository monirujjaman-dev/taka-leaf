import { router, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Keyboard, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, TAB_BAR, type IconName } from "../../src/ui/kit";
import { usePressScale } from "../../src/ui/motion";
import { useColors } from "../../src/ui/theme";

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: "Home", icon: "home-variant-outline" },
  history: { label: "History", icon: "format-list-bulleted" },
  reports: { label: "Reports", icon: "chart-bar" },
  more: { label: "More", icon: "dots-horizontal" },
};

function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setShown(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return shown;
}

/** The centre Add button: the one primary action, so it ripples and presses to 0.97 like every button. */
function AddButton() {
  const c = useColors();
  const press = usePressScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add transaction"
      onPress={() => router.push("/transaction")}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ flex: 1, alignItems: "center" }}
    >
      <Animated.View style={{ width: 54, height: 54, borderRadius: 27, overflow: "hidden", transform: [{ scale: press.scale }] }}>
        {/* The ripple lives on this inner circle, so it stays round and inside the forest fill. */}
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={() => router.push("/transaction")}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          android_ripple={{ color: c.rippleOnPrimary }}
          style={{ flex: 1, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="plus" size={30} color={c.onPrimary} />
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

/** Home, History, the centre Add button, Reports and More, floating above the content. */
export default function TabsLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardShown();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background } }}
      tabBar={({ state, navigateToTab }) => {
        const routes = state.routes.filter((r) => TABS[r.name]);
        const items = [...routes.slice(0, 2), null, ...routes.slice(2)];
        // The keyboard is up (History's search): the bar would sit on the results, so it steps aside.
        if (keyboard) return null;
        return (
          // A full-width layer that lets touches through, so the bar can be centred at phone width on tablets.
          <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + TAB_BAR.gap, alignItems: "center", paddingHorizontal: 12 }}>
            <View
              accessibilityRole="tablist"
              style={{ width: "100%", maxWidth: TAB_BAR.maxWidth, flexDirection: "row", alignItems: "center", borderRadius: 26, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, paddingHorizontal: 6, height: TAB_BAR.height, elevation: 8 }}
            >
              {items.map((route) => {
                if (!route) return <AddButton key="add" />;
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
                    android_ripple={{ color: c.ripple, borderless: true, radius: 32 }}
                    style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 56, gap: 2 }}
                  >
                    <Icon name={tab.icon} color={focused ? c.tabActive : c.muted} />
                    {/* Labels grow with the phone's text size, up to what the 68 dp bar can hold. */}
                    <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ fontSize: 12, fontWeight: focused ? "800" : "600", color: focused ? c.tabActive : c.muted }}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
