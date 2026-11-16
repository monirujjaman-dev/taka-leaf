import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../../api/client";
import { fakeApi, session } from "../../test/fakeApi";
import { renderApp } from "../../test/render";
import { compactTaka } from "../../ui/format";

const report = {
  period: "Month",
  label: "2026-11",
  from: "2026-11-01",
  to: "2026-11-30",
  income: 8500000,
  expense: 5234000,
  saved: 3266000,
  savedPercent: 38,
  spending: [
    {
      categoryId: "c-housing", name: "Housing", amount: 1920000, percent: 36,
      children: [
        { categoryId: "c-rent", name: "House rent", amount: 1800000 },
        { categoryId: "c-net", name: "Internet", amount: 120000 },
      ],
    },
    { categoryId: null, name: "Uncategorised", amount: 50000, percent: 0, children: [{ categoryId: null, name: "Uncategorised", amount: 50000 }] },
  ],
  earning: [{ categoryId: "c-salary", name: "Salary", amount: 8500000, percent: 100, children: [] }],
  trend: ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map((month, i) => ({ month, income: 0, expense: 4800000 + i * 100000 })),
};

describe("reports", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setSession(null);
  });

  it("shows savings and drills from a category to its transactions", async () => {
    fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /reports": { body: report },
      "GET /budgets": { body: { month: "2026-11", budgets: [] } },
    });
    renderApp("/reports?month=2026-11");

    expect(await screen.findByText("Saved ৳32,660.00 · 38% of income")).toBeInTheDocument();
    const spending = screen.getByRole("region", { name: "Spending by category" });
    await userEvent.click(within(spending).getByRole("button", { name: /Housing/ }));

    expect(within(spending).getByRole("link", { name: /House rent/ })).toHaveAttribute(
      "href",
      "/transactions?from=2026-11-01&to=2026-11-30&type=Expense&categoryId=c-rent",
    );
    await userEvent.click(within(spending).getByRole("button", { name: /Uncategorised/ }));
    expect(within(spending).getByRole("link", { name: "See all Uncategorised transactions" })).toHaveAttribute(
      "href",
      "/transactions?from=2026-11-01&to=2026-11-30&type=Expense&uncategorised=true",
    );
  });

  it("asks for the year report when Year is chosen", async () => {
    const { calls } = fakeApi({
      "POST /auth/refresh": { body: session() },
      "GET /reports": { body: report },
      "GET /budgets": { body: { month: "2026-11", budgets: [] } },
    });
    renderApp("/reports?month=2026-11");

    await userEvent.click(await screen.findByRole("radio", { name: "Year" }));
    await vi.waitFor(() => expect(calls.some((c) => c.path.startsWith("/reports?period=Year&year="))).toBe(true));
  });

  it("writes chart labels in thousands, lakh and crore", () => {
    expect(compactTaka(95000)).toBe("৳950");
    expect(compactTaka(4800000)).toBe("48k");
    expect(compactTaka(12500000)).toBe("1.3L");
    expect(compactTaka(3400000000)).toBe("3.4Cr");
  });
});
