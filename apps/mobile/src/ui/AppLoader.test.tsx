import { render, screen } from "@testing-library/react-native";
import { AppLoader } from "./AppLoader";

describe("AppLoader", () => {
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
