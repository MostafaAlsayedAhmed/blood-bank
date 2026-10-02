import { expect, test } from "@playwright/test";
import { submitLogin } from "./support/sign-in";

const password = process.env.SEED_STAFF_PASSWORD ?? "";

test.describe("staff authentication", () => {
  test.skip(!password, "SEED_STAFF_PASSWORD must be set to the seeded password");

  test("an unauthenticated dashboard request redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
  });

  test("wrong credentials show a generic error", async ({ page }) => {
    await submitLogin(page, "staff@bloodbank.test", "not-the-password-123");
    // Scoped to <main>: Next.js also renders a role=alert route announcer.
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Email or password is incorrect.");
  });

  test("staff can sign in and sign out", async ({ page }) => {
    await submitLogin(page, "staff@bloodbank.test", password);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Dev Coordinator · Staff").first()).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});
