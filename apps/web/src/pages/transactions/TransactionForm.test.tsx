import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../../api/client";
import { emptyDashboard, fakeApi, session, wallet } from "../../test/fakeApi";
import { renderApp } from "../../test/render";
import { localMonth } from "../../ui/format";

const wallets = {
  wallets: [
    wallet({ id: "w-bkash", type: "Mfs", name: "bKash", balance: 1240000 }),
    wallet({ id: "w-cash", name: "Cash" }),
    wallet({ id: "w-old", name: "Old bank", type: "Bank", archived: true }),
    wallet({ id: "w-lent", name: "Lent to Rafi", type: "Lent", personId: "p1" }),
  ],
  totals: { assets: 1240000, liabilities: 0, net: 1240000 },
};

const categories = [
  { id: "c-food", kind: "Expense", name: "Food and dining", parentId: null, icon: null, color: null, archived: false, children: [
    { id: "c-tea", kind: "Expense", name: "Snacks and tea", parentId: "c-food", icon: null, color: null, archived: false, children: [] },
  ] },
];

function backend(extra: Parameters<typeof fakeApi>[0] = {}) {
  return fakeApi({
    "POST /auth/refresh": { body: session() },
    "GET /dashboard": { body: emptyDashboard(localMonth()) },
    "GET /wallets": { body: wallets },
    "GET /categories": { body: categories },
    ...extra,
  });
}

async function openForm() {
  renderApp("/");
  const [add] = await screen.findAllByRole("button", { name: /add transaction/i });
  await userEvent.click(add!);
  return screen.findByRole("dialog", { name: "Add transaction" });
}

describe("transaction form", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("records a transfer with a fee in poisha (F-2)", async () => {
    const { calls } = backend({ "POST /transactions": { status: 201, body: {} } });
    const dialog = await openForm();

    await userEvent.click(within(dialog).getByRole("radio", { name: "Transfer" }));
    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "5,000");
    await userEvent.selectOptions(within(dialog).getByLabelText("From"), "w-bkash");
    await userEvent.selectOptions(within(dialog).getByLabelText("To"), "w-cash");
    await userEvent.type(within(dialog).getByLabelText(/Fee/), "92.50");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Save/ }));

    await vi.waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/transactions")).toBe(true));
    expect(calls.find((c) => c.method === "POST" && c.path === "/transactions")?.body).toMatchObject({
      type: "Transfer",
      amount: 500000,
      fromWalletId: "w-bkash",
      toWalletId: "w-cash",
      categoryId: null,
      fee: 9250,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers only own, active wallets", async () => {
    backend();
    const dialog = await openForm();
    const options = within(within(dialog).getByLabelText("Paid from")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Choose a wallet", "bKash", "Cash"]);
  });

  it("checks the amount before sending anything (T-6)", async () => {
    const { calls } = backend();
    const dialog = await openForm();

    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "12.345");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Save/ }));

    expect(await within(dialog).findByText(/Enter an amount above zero/)).toBeInTheDocument();
    expect(within(dialog).getByText("Choose the wallet the money left.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.path === "/transactions")).toBe(false);
  });

  it("shows the server's message beside the field it names", async () => {
    backend({
      "POST /transactions": { status: 400, body: { title: "x", errors: { categoryId: ["That category is archived."] } } },
    });
    const dialog = await openForm();

    await userEvent.type(within(dialog).getByLabelText("Amount (৳)"), "120");
    await userEvent.selectOptions(within(dialog).getByLabelText("Paid from"), "w-cash");
    await userEvent.selectOptions(within(dialog).getByLabelText("Category"), "c-tea");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Save/ }));

    expect(await within(dialog).findByText("That category is archived.")).toBeInTheDocument();
  });

  it("takes the amount from the number pad and the category from a quick chip", async () => {
    const { calls } = backend({ "POST /transactions": { status: 201, body: {} } });
    const dialog = await openForm();
    const pad = within(dialog).getByRole("group", { name: "Number pad" });

    for (const key of ["1", "2", "5", "0", "Decimal point", "5", "0", "9"]) {
      await userEvent.click(within(pad).getByRole("button", { name: key }));
    }
    await userEvent.click(within(pad).getByRole("button", { name: "Delete last digit" }));
    expect(within(dialog).getByLabelText("Amount (৳)")).toHaveValue("1250.5");

    await userEvent.click(within(dialog).getByRole("button", { name: "Snacks and tea" }));
    expect(within(dialog).getByRole("button", { name: "Snacks and tea" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.selectOptions(within(dialog).getByLabelText("Paid from"), "w-cash");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save expense" }));

    await vi.waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/transactions")).toBe(true));
    expect(calls.find((c) => c.method === "POST" && c.path === "/transactions")?.body).toMatchObject({
      type: "Expense",
      amount: 125050,
      fromWalletId: "w-cash",
      categoryId: "c-tea",
    });
  });
});
