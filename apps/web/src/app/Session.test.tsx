import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../api/client";
import { fakeApi, session, wallet } from "../test/fakeApi";
import { renderApp } from "../test/render";

describe("restoring the session", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("offers Try again when the session cannot be checked, instead of signing the person out", async () => {
    let busy = true;
    fakeApi({
      "POST /auth/refresh": () => (busy ? { status: 429 } : { body: session() }),
      "GET /wallets": { body: { wallets: [], totals: { assets: 0, liabilities: 0, net: 0 } } },
    });
    renderApp("/wallets");

    expect(await screen.findByRole("heading", { name: "Your account could not be opened" })).toBeInTheDocument();
    expect(screen.getByText(/Too many requests from this network right now/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();

    busy = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Wallets" })).toBeInTheDocument();
  });

  it("still sends a person whose session has ended to sign in", async () => {
    fakeApi({ "POST /auth/refresh": { status: 401, body: { title: "Your session has ended. Sign in again." } } });
    renderApp("/wallets");
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
  });
});

describe("wallet rows", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("keep the balance in the row's accessible name", async () => {
    fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /wallets": { body: { wallets: [wallet({ balance: 125000 })], totals: { assets: 125000, liabilities: 0, net: 125000 } } },
    });
    renderApp("/wallets");
    expect(await screen.findByRole("button", { name: /^Cash.*৳1,250\.00.*, edit$/ })).toBeInTheDocument();
  });
});
