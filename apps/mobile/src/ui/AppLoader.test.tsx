import { render, screen } from "@testing-library/react-native";
import { AppLoader, apartOffset } from "./AppLoader";

describe("AppLoader", () => {
  // React Native and react-native-svg load their parts on first use, inside the first render. On a
  // cold runner (CI never has a Jest cache) that one-time cost was 3.7 s here and passed the 5 s
  // test limit in CI. Pay it once, with its own limit, so each test times only what it checks.
  beforeAll(async () => {
    const warm = await render(<AppLoader label="Warming up" />);
    warm.unmount();
  }, 30_000);

  it("tells screen readers what is loading", async () => {
    await render(<AppLoader label="Opening TakaLeaf…" />);
    expect(await screen.findByLabelText("Opening TakaLeaf…")).toBeTruthy();
    expect(screen.getByText("Opening TakaLeaf…")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("draws the small in-page size", async () => {
    await render(<AppLoader size={44} label="Asking your server…" />);
    expect(await screen.findByText("Asking your server…")).toBeTruthy();
  });
});

describe("apartOffset", () => {
  it("leaves a piece without lift where the design puts it", () => {
    // The stem's offset at the design's 150 px box, with its 40 px lift turned into a plane shift.
    const stem = apartOffset("stem", 1);
    expect(Number.isFinite(stem.x)).toBe(true);
    expect(Number.isFinite(stem.y)).toBe(true);
  });

  it("scales with the loader's size", () => {
    const full = apartOffset("right", 1);
    const small = apartOffset("right", 44 / 150);
    expect(small.x).toBeCloseTo(full.x * (44 / 150));
    expect(small.y).toBeCloseTo(full.y * (44 / 150));
  });
});
