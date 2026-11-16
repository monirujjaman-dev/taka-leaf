import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../api/client";
import { emptyDashboard, fakeApi, session, signedOut, wallet } from "../test/fakeApi";
import { renderApp } from "../test/render";
import { localMonth } from "../ui/format";

const month = localMonth();

describe("signing in", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("sends a signed-out visitor to sign in, then to the dashboard", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": signedOut,
      "POST /auth/login": { body: session() },
      "GET /dashboard": { body: { ...emptyDashboard(month), netBalance: 18425000, assets: 18425000 } },
      "GET /wallets": { body: { wallets: [wallet()], totals: { assets: 0, liabilities: 0, net: 0 } } },
    });
    renderApp("/");

    await userEvent.type(await screen.findByLabelText("Email"), "monir@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "green-leaf-2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("region", { name: "Net balance" })).toHaveTextContent("Net balance৳1,84,250.00");
    expect(calls.find((c) => c.path === "/auth/login")?.body).toEqual({
      email: "monir@example.com",
      password: "green-leaf-2026",
      client: "web",
    });
  });

  it("picks up an existing session without asking again", async () => {
    fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /dashboard": { body: emptyDashboard(month) },
      "GET /wallets": { body: { wallets: [], totals: { assets: 0, liabilities: 0, net: 0 } } },
    });
    renderApp("/");

    expect(await screen.findByText("Start by adding your wallets")).toBeInTheDocument();
  });

  it("offers a new verification link when the email is not verified", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": signedOut,
      "POST /auth/login": { status: 403, body: { title: "Verify your email before signing in.", code: "email_not_verified" } },
      "POST /auth/resend-verification": { status: 202, body: { message: "Check your email for a link to finish creating your account." } },
    });
    renderApp("/sign-in");

    await userEvent.type(await screen.findByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "green-leaf-2026");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await userEvent.click(await screen.findByRole("button", { name: "Send the link again" }));

    expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
    expect(calls.at(-1)?.body).toEqual({ email: "new@example.com" });
  });

  it("shows the password rule next to the password field when registering", async () => {
    fakeApi({
      "POST /auth/refresh": signedOut,
      "POST /auth/register": { status: 400, body: { title: "x", errors: { password: ["Use at least 10 characters."] } } },
    });
    renderApp("/register");

    await userEvent.type(await screen.findByLabelText("Your name"), "Rafi Ahmed");
    await userEvent.type(screen.getByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Use at least 10 characters.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("sends the cleaned name with the registration and checks it first", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": signedOut,
      "POST /auth/register": { status: 202, body: { message: "Check your email for a link to finish creating your account." } },
    });
    renderApp("/register");

    await userEvent.type(await screen.findByLabelText("Your name"), "   ");
    await userEvent.type(screen.getByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "green-leaf-2026");
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText("Your name"));
    await userEvent.type(screen.getByLabelText("Your name"), "  Monir   Hossain ");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(calls.find((c) => c.path === "/auth/register")?.body).toEqual({
      name: "Monir Hossain",
      email: "new@example.com",
      password: "green-leaf-2026",
    });
  });

  it("verifies the email once from the link", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": signedOut,
      "POST /auth/verify-email": { body: { message: "Your email is verified. You can sign in now." } },
    });
    renderApp("/verify-email?token=abc");

    expect(await screen.findByText("Your email is verified. You can sign in now.")).toBeInTheDocument();
    expect(calls.filter((c) => c.path === "/auth/verify-email")).toHaveLength(1);
  });

  it("switches to the dark theme and remembers it", async () => {
    fakeApi({ "POST /auth/refresh": signedOut });
    renderApp("/sign-in");

    await userEvent.click(await screen.findByRole("button", { name: /switch to dark theme/i }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(window.localStorage.getItem("takaleaf.theme")).toBe("dark");
  });
});
