import { render, screen } from "@testing-library/react-native";
import { BackHandler, Text } from "react-native";
import { LockGate } from "./LockGate";

jest.mock("@react-native-community/datetimepicker", () => () => null);
jest.mock("../state/lock", () => ({
  biometricEnabled: () => false,
  checkPin: jest.fn(async () => false),
  failures: () => 0,
  lockEnabled: () => true,
  MAX_FAILURES: 5,
  turnOffLock: jest.fn(),
  unlockWithBiometric: jest.fn(async () => false),
}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../state/AppState", () => ({ useApp: () => ({ signedOut: false, signOut: jest.fn() }) }));

describe("LockGate", () => {
  beforeAll(async () => {
    const warm = await render(<LockGate>{null}</LockGate>);
    warm.unmount();
  }, 30_000);

  it("hides the app underneath from TalkBack while locked", async () => {
    await render(
      <LockGate>
        <Text>Net balance ৳1,25,000.00</Text>
      </LockGate>,
    );
    expect(screen.getByRole("header", { name: "Enter your PIN" })).toBeTruthy();
    // Hidden from accessibility, so role and label queries cannot reach it.
    expect(screen.queryByText("Net balance ৳1,25,000.00")).toBeNull();
    expect(screen.getByText("Net balance ৳1,25,000.00", { includeHiddenElements: true })).toBeTruthy();
  });

  it("keeps Back from moving the hidden screens", async () => {
    const add = jest.spyOn(BackHandler, "addEventListener");
    await render(<LockGate>{null}</LockGate>);
    const handler = add.mock.calls.find(([event]) => event === "hardwareBackPress")?.[1] as (() => boolean) | undefined;
    expect(handler?.()).toBe(true);
    add.mockRestore();
  });
});
