import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoSidewaysScroll, newAccount } from "./helpers";

test.describe("on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "Phone checks only");

  test("tabs, add button and every screen fit 390 px, with nothing sideways", async ({ page }) => {
    await newAccount(page);
    const tabs = page.getByRole("navigation", { name: "Main" }).last();
    for (const tab of ["Home", "History", "Reports", "More"]) {
      await tabs.getByRole("link", { name: tab }).click();
      await expect(page.locator("main h1")).toBeVisible();
      await expectNoSidewaysScroll(page);
    }

    for (const link of ["Wallets", "People and loans", "Budgets", "Recurring", "Categories"]) {
      await tabs.getByRole("link", { name: "More" }).click();
      await page.getByRole("navigation", { name: "More" }).getByRole("link", { name: link }).click();
      await expect(page.getByRole("heading", { level: 1, name: link })).toBeVisible();
      await expectNoSidewaysScroll(page);
      await page.getByRole("link", { name: "Back" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    }

    await tabs.getByRole("button", { name: "Add transaction" }).click();
    await expect(page.getByRole("dialog", { name: "Add transaction" })).toBeVisible();
    await expect(page.getByText("Add a wallet first")).toBeVisible();
  });

  test("dark theme on a phone passes the accessibility check", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await newAccount(page);
    for (const path of ["/", "/transactions", "/wallets", "/people", "/budgets", "/categories", "/settings"]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      await expectAccessible(page);
    }
  });
});
