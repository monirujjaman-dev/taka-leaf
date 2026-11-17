import { formatBdt } from "@takaleaf/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { Button, Money, REPEAT_TAP_MS, Screen, TAB_BAR } from "./kit";

// The native date picker has no Node build; these tests never open it.
jest.mock("@react-native-community/datetimepicker", () => () => null);
// A phone with the three-button navigation bar: 48 dp at the bottom.
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 48, left: 0, right: 0 }) }));
jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));

describe("Screen", () => {
  /** The screen's content column: the nearest view above the text that carries the bottom padding. */
  const bodyOf = (text: string) => {
    let node = screen.getByText(text).parent;
    while (node) {
      const style = StyleSheet.flatten(node.props.style) as { paddingBottom?: number } | undefined;
      if (style?.paddingBottom !== undefined) return style;
      node = node.parent;
    }
    throw new Error(`No content column above "${text}"`);
  };

  it("keeps a tab's last row above the floating tab bar, whatever the navigation bar", async () => {
    await render(
      <Screen title="History">
        <Text>Last row</Text>
      </Screen>,
    );
    expect(bodyOf("Last row").paddingBottom).toBeGreaterThanOrEqual(48 + TAB_BAR.gap + TAB_BAR.height);
  });

  it("keeps a phone-width column on tablets", async () => {
    await render(
      <Screen title="Wallets" back>
        <Text>Cash</Text>
      </Screen>,
    );
    expect(bodyOf("Cash")).toMatchObject({ maxWidth: 600, alignSelf: "center" });
  });
});

describe("Button", () => {
  beforeAll(async () => {
    const warm = await render(<Button label="Warm" onPress={() => undefined} />);
    warm.unmount();
  }, 30_000);

  it("ignores a quick second tap, so Save cannot run twice", async () => {
    const now = jest.spyOn(Date, "now");
    const onPress = jest.fn();
    await render(<Button label="Save expense" onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Save expense" });

    now.mockReturnValue(10_000);
    await fireEvent.press(button);
    now.mockReturnValue(10_000 + REPEAT_TAP_MS - 1);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);

    now.mockReturnValue(10_000 + REPEAT_TAP_MS + 1);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });
});

describe("Money", () => {
  it("shrinks a long amount instead of cutting off digits", async () => {
    await render(<Money amount={12_500_000_00} />);
    const text = screen.getByText(formatBdt(12_500_000_00));
    expect(text.props.numberOfLines).toBe(1);
    expect(text.props.adjustsFontSizeToFit).toBe(true);
  });
});
