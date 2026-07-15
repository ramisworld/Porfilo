import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the custom-domain unlock E2E.
 *
 * Runs against a locally running app (default http://localhost:3000, override
 * with E2E_BASE_URL). The custom-domain flow is behind auth, so the suite reuses
 * an authenticated storage state produced by e2e/global-setup.ts — see e2e/README.md.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    storageState: "e2e/.auth/user.json",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
