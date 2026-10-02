import type { Page } from "@playwright/test";

const SIGN_IN_PATH = "/api/auth/sign-in/email";
const HTTP_TOO_MANY_REQUESTS = 429;
const FALLBACK_RETRY_SECONDS = 10;

/**
 * Submits the login form. Better Auth rate-limits sign-in per IP in production,
 * and the whole suite shares one IP, so a 429 is waited out (X-Retry-After) and
 * the submission retried once. Production rate limiting stays on for e2e.
 */
export async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  for (let attempt = 0; attempt < 2; attempt++) {
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(SIGN_IN_PATH) && r.request().method() === "POST"),
      page.getByRole("button", { name: "Sign in" }).click(),
    ]);
    if (response.status() !== HTTP_TOO_MANY_REQUESTS) return;

    const retryAfter = Number(response.headers()["x-retry-after"]) || FALLBACK_RETRY_SECONDS;
    await page.waitForTimeout((retryAfter + 1) * 1000);
  }
  throw new Error("Sign-in still rate-limited after waiting out X-Retry-After.");
}
