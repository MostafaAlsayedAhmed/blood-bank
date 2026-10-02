import { expect, test } from "@playwright/test";

test.describe("Arabic and RTL", () => {
  // Start without the English cookie set in playwright.config.ts.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the public form defaults to Arabic, right-to-left", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "سجّل كمتبرع بالدم" })).toBeVisible();
    // Phone input stays left-to-right inside the RTL page.
    await expect(page.getByLabel("رقم الهاتف المحمول")).toHaveAttribute("dir", "ltr");
  });

  test("the language switcher changes language and direction, and remembers it", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { name: "Register as a blood donor" })).toBeVisible();

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();

    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: "إشعار الخصوصية" })).toBeVisible();
  });

  test("Arabic validation messages are shown", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "تسجيل" }).click();
    await expect(page.getByText("هذه الموافقة مطلوبة للتسجيل.")).toBeVisible();
  });
});
