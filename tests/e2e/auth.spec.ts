import { expect, test } from "@playwright/test";

const password = process.env.SEED_STAFF_PASSWORD ?? "";

test.describe("staff authentication", () => {
  test.skip(!password, "SEED_STAFF_PASSWORD must be set to the seeded password");

  test("an unauthenticated dashboard request redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
  });

  test("wrong credentials show a generic error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("staff@bloodbank.test");
    await page.getByLabel("Password").fill("not-the-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toHaveText("Email or password is incorrect.");
  });

  test("staff can sign in and sign out", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("staff@bloodbank.test");
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Dev Coordinator · Staff").first()).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});
