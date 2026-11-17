import { expect, test } from "@playwright/test";
import { expectAccessible, newAccount } from "./helpers";

test.describe("everyday money, in a real browser", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop flow; the phone checks are in layout.spec.ts");

  // A-1, A-4, W-1, T-1, T-3, P-1 end to end
  test("register, add wallets, an expense and a transfer with a fee; balances add up", async ({ page }) => {
    await newAccount(page);
    await expect(page.getByText("Start by adding your wallets")).toBeVisible();

    await page.getByRole("link", { name: "Add a wallet" }).click();
    let dialog = page.getByRole("dialog", { name: "Add a wallet" });
    await dialog.getByLabel("Name").fill("Cash");
    await dialog.getByLabel(/Balance when you start tracking/).fill("10,000");
    await dialog.getByRole("button", { name: /^Save/ }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Add a wallet" }).click();
    dialog = page.getByRole("dialog", { name: "Add a wallet" });
    await dialog.getByLabel("Type").selectOption({ label: "Mobile banking" });
    await dialog.getByRole("button", { name: "bKash" }).click();
    await dialog.getByLabel(/Balance when you start tracking/).fill("5000");
    await dialog.getByRole("button", { name: /^Save/ }).click();
    await expect(dialog).toBeHidden();

    // On wide screens the add button sits in the Dashboard and Transactions headers.
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" }).click();
    await page.getByRole("main").getByRole("button", { name: "Add transaction" }).click();
    dialog = page.getByRole("dialog", { name: "Add transaction" });
    await dialog.getByLabel("Amount (৳)").fill("1250");
    await dialog.getByLabel("Paid from").selectOption({ label: "Cash" });
    await dialog.getByLabel("Category").selectOption({ label: "Daily bazaar" });
    await dialog.getByLabel("Note (optional)").fill("Weekly bazaar");
    await dialog.getByRole("button", { name: /^Save/ }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("main").getByRole("button", { name: "Add transaction" }).click();
    dialog = page.getByRole("dialog", { name: "Add transaction" });
    await dialog.getByRole("radio", { name: "Transfer" }).click();
    await dialog.getByLabel("Amount (৳)").fill("2000");
    await dialog.getByLabel("From", { exact: true }).selectOption({ label: "bKash" });
    await dialog.getByLabel("To", { exact: true }).selectOption({ label: "Cash" });
    await dialog.getByLabel(/Fee/).fill("18.50");
    await dialog.getByRole("button", { name: /^Save/ }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("link", { name: "Dashboard" }).first().click();
    await expect(page.getByRole("region", { name: "Net balance" })).toContainText("৳13,731.50");

    // A wallet row's accessible name is what it shows, ending in ", edit", so a screen reader hears
    // the balance too ("Cash Cash ৳10,750.00, edit"), not only "Edit Cash".
    await page.getByRole("link", { name: "Wallets" }).first().click();
    await expect(page.getByRole("button", { name: /^Cash .*৳10,750\.00 ?, edit$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^bKash .*৳2,981\.50 ?, edit$/ })).toBeVisible();

    await page.getByRole("link", { name: "Transactions" }).first().click();
    await expect(page.getByText("Weekly bazaar")).toBeVisible();
    await expect(page.getByText("Transfer fee").first()).toBeVisible();
  });

  test("every main screen passes the accessibility check, in light and dark", async ({ page }) => {
    await newAccount(page);
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      for (const path of ["/", "/transactions", "/wallets", "/people", "/reports", "/budgets", "/recurring", "/categories", "/settings"]) {
        await page.goto(path);
        await expect(page.locator("main h1")).toBeVisible();
        await expectAccessible(page);
      }
    }
  });
});
