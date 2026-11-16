import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running TakaLeaf: in CI the Docker image with PostgreSQL and
 * Mailpit (see .github/workflows/ci.yml). Locally: start the dev stack, then
 *   E2E_BASE_URL=http://localhost:5173 E2E_MAILPIT_URL=http://localhost:8025 pnpm --filter @takaleaf/e2e e2e
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    timezoneId: "Asia/Dhaka",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
});
