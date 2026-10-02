import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a production build with a migrated, seeded database:
 *   pnpm db:deploy && pnpm db:seed && pnpm build && pnpm test:e2e
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // One worker: the server rate-limits sign-in per IP, so parallel workers race for the same budget.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    // Specs use English labels; Arabic (the default) is covered by tests/e2e/i18n.spec.ts.
    storageState: {
      cookies: [
        {
          name: "NEXT_LOCALE",
          value: "en",
          domain: new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000").hostname,
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm start",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
