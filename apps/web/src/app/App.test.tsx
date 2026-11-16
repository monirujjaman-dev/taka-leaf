import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App (M0 placeholder)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the sample balance with Bangladeshi digit grouping", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<App />);
    expect(screen.getByText("৳1,84,250.00")).toBeInTheDocument();
  });

  it("reports a connected backend when the health endpoint answers", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))));
    render(<App />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Backend connected"));
  });

  it("reports an unreachable backend when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("network"))));
    render(<App />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Backend not reachable"));
  });

  it("switches to the dark theme and remembers it", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /switch to dark theme/i }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("takaleaf.theme")).toBe("dark");
  });
});
