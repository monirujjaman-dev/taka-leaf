import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "green-leaf-e2e-2026";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

/** Waits for the newest email to this address in Mailpit and returns the link it holds. */
async function linkFromEmail(email: string, path: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages = [] } = (await search.json()) as { messages?: { ID: string }[] };
    if (messages[0]) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string };
      const link = new RegExp(`https?://\\S+${path}\\?token=[\\w-]+`).exec(message.Text)?.[0];
      if (link) return new URL(link).pathname + new URL(link).search;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email with ${path} arrived for ${email}`);
}

/** Registers through the screens, opens the link from the email, and signs in. */
export async function newAccount(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto(await linkFromEmail(email, "/verify-email"));
  await expect(page.getByText("Your email is verified. You can sign in now.")).toBeVisible();
  await page.getByRole("link", { name: "Go to sign in" }).click();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  return email;
}

/** No serious or critical WCAG 2.2 AA problem on the page as it is now. */
export async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

export async function expectNoSidewaysScroll(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width);
}

export { linkFromEmail };
