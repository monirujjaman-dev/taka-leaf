import { render } from "@testing-library/react-native";
import { Text, View } from "react-native";
import { LeafWatermark } from "./LeafMark";

describe("LeafWatermark", () => {
  it("draws the four leaf pieces in white, faint, in the top-right corner, hidden from TalkBack", async () => {
    const screen = await render(
      <View>
        <LeafWatermark />
        <Text>Net balance</Text>
      </View>,
    );
    const svg = screen.getByTestId("leaf-watermark", { includeHiddenElements: true });
    expect(svg).toHaveStyle({ position: "absolute", right: -18, top: -14, opacity: 0.16 });
    expect(svg.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(screen.getByText("Net balance")).toBeTruthy();
  });
});
