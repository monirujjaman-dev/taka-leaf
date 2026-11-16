import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../../api/client";
import { fakeApi, session } from "../../test/fakeApi";
import { renderApp } from "../../test/render";

const child = (id: string, name: string) => ({ id, kind: "Expense", name, parentId: "c-transport", icon: null, color: null, archived: false, children: [] });
const categories = [
  { id: "c-transport", kind: "Expense", name: "Transport", parentId: null, icon: null, color: null, archived: false, children: [child("c-bus", "Bus fare"), child("c-cng", "Rickshaw and CNG")] },
];

describe("categories", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("merges a sub-category into another after confirming", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /categories": { body: categories },
      "POST /categories/c-bus/merge": { body: { movedTransactions: 3 } },
    });
    renderApp("/categories");

    await userEvent.click(await screen.findByRole("button", { name: "Bus fare" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Bus fare" });
    await userEvent.selectOptions(within(dialog).getByLabelText("Merge Bus fare into"), "c-cng");
    await userEvent.click(within(dialog).getByRole("button", { name: "Merge" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Yes, merge" }));

    await vi.waitFor(() => expect(calls.some((c) => c.path === "/categories/c-bus/merge")).toBe(true));
    expect(calls.find((c) => c.path === "/categories/c-bus/merge")?.body).toEqual({ intoCategoryId: "c-cng" });
  });

  it("asks to sort out sub-categories before merging a parent", async () => {
    fakeApi({ "POST /auth/refresh": { body: session() }, "GET /categories": { body: categories } });
    renderApp("/categories");

    await userEvent.click(await screen.findByRole("button", { name: "Transport" }));
    expect(await screen.findByText(/first merge or delete its sub-categories/)).toBeInTheDocument();
  });
});
