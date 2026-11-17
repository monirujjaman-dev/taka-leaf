import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import { AccessibilityInfo, StyleSheet, type Animated } from "react-native";
import { Segmented } from "./kit";
import { MOTION, usePressScale } from "./motion";

jest.mock("@react-native-community/datetimepicker", () => () => null);
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));

const valueOf = (v: Animated.Value) => (v as unknown as { __getValue: () => number }).__getValue();

/** The phone's "Remove animations" setting, as the app reads it. */
function reduceMotion(on: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(on);
}

afterEach(() => jest.restoreAllMocks());

describe("press feedback", () => {
  it("presses to 0.97 the moment a finger lands", async () => {
    reduceMotion(false);
    const { result } = await renderHook(() => usePressScale());
    await act(async () => result.current.onPressIn());
    expect(valueOf(result.current.scale)).toBe(MOTION.pressScale);
  });

  it("stays still with reduce motion (the ripple alone confirms the press)", async () => {
    reduceMotion(true);
    const { result } = await renderHook(() => usePressScale());
    await act(async () => undefined);
    await act(async () => result.current.onPressIn());
    expect(valueOf(result.current.scale)).toBe(1);
  });
});

describe("Segmented", () => {
  const options = [
    { value: "Expense", label: "Expense" },
    { value: "Income", label: "Income" },
    { value: "Transfer", label: "Transfer" },
  ];
  /** The switch's track: the view above the options that carries the radiogroup role. */
  const track = () => {
    let node = screen.getByRole("radio", { name: "Expense" }).parent;
    while (node && node.props.accessibilityRole !== "radiogroup") node = node.parent;
    if (!node) throw new Error("No radiogroup above the options");
    return node;
  };
  /** Where the chosen pill sits: the track's absolutely placed child. */
  const pillX = () => {
    const pill = track().children.find((n) => typeof n !== "string" && StyleSheet.flatten(n.props.style)?.position === "absolute");
    if (!pill || typeof pill === "string") return undefined;
    const transform = StyleSheet.flatten(pill.props.style)?.transform as { translateX: number }[] | undefined;
    return transform?.[0]?.translateX;
  };

  it("puts the chosen pill on the option the person picks", async () => {
    reduceMotion(true);
    const ui = (value: string) => <Segmented label="Type" value={value} onChange={() => undefined} options={options} />;
    const { rerender } = await render(ui("Expense"));
    await act(async () => undefined);
    // A 316 dp track: 4 dp padding each side and between, so three 100 dp options.
    await fireEvent(track(), "layout", { nativeEvent: { layout: { width: 316, height: 56, x: 0, y: 0 } } });
    expect(pillX()).toBe(0);
    await rerender(ui("Transfer"));
    expect(pillX()).toBe(208);
    expect(screen.getByRole("radio", { name: "Transfer" }).props.accessibilityState).toMatchObject({ selected: true });
  });
});
