import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createPrismaClient } from "../../src/server/db-client";
import { submitLogin } from "./support/sign-in";

/**
 * Phase 2 exit criteria (spec §15): a public registration appears in Pending Review,
 * staff verify it, record eligibility, audit rows exist, and a duplicate phone
 * reveals nothing. Fictional data only.
 */

const password = process.env.SEED_STAFF_PASSWORD ?? "";
const db = createPrismaClient(process.env.DATABASE_URL);

test.afterAll(async () => {
  await db.$disconnect();
});

/** A random fictional Egyptian mobile number in local format, e.g. 0100 0xx xxxx. */
function fictionalPhone(): { local: string; e164: string } {
  const rest = String(randomInt(0, 10_000_000)).padStart(7, "0");
  return { local: `0100${rest}`, e164: `+20100${rest}` };
}

/** Each test looks like a distinct client to the per-IP registration throttle. */
async function asDistinctClient(page: Page): Promise<void> {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${randomInt(1, 255)}-${randomUUID()}` });
}

async function register(page: Page, name: string, phone: string): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByLabel("Date of birth").fill("1992-03-14");
  await page.getByLabel("Blood group", { exact: true }).selectOption({ label: "B+" });
  await page.getByLabel("City").fill("Quseir");
  await page.getByRole("radio", { name: "No", exact: true }).check();
  await page.getByRole("radio", { name: "Phone call" }).check();
  await page.getByRole("checkbox", { name: /store and process my data/ }).check();
  await page.getByRole("checkbox", { name: /contacted by phone or WhatsApp/ }).check();
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page).toHaveURL(/\/register\/thanks$/);
}

test.describe("public registration", () => {
  test("a duplicate phone gets the same confirmation and creates nothing new", async ({ page }) => {
    await asDistinctClient(page);
    const phone = fictionalPhone();
    await register(page, `E2E Fictional ${randomUUID().slice(0, 6)}`, phone.local);
    const thanks = await page.getByRole("main").innerText();

    await register(page, "E2E Someone Else", phone.local);
    expect(await page.getByRole("main").innerText()).toBe(thanks);

    const donors = await db.donor.findMany({ where: { phoneE164: phone.e164 } });
    expect(donors).toHaveLength(1);
    expect(donors[0]?.needsReview).toBe(true);
  });

  test("shows field errors without losing input", async ({ page }) => {
    await asDistinctClient(page);
    await page.goto("/register");
    await page.getByLabel("Full name").fill("E2E Fictional Minor");
    await page.getByLabel("Date of birth").fill("2015-01-01");
    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.getByText("You must be 18 or older to register.")).toBeVisible();
    await expect(page.getByText("This consent is needed to register.")).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveValue("E2E Fictional Minor");
  });
});

test.describe("staff donor workflow", () => {
  test.skip(!password, "SEED_STAFF_PASSWORD must be set to the seeded password");
  // One staff journey per run: sign-in is rate-limited per IP in production builds.
  test.skip(({ isMobile }) => isMobile, "staff workflow runs on the desktop project");

  test("registration → pending review → verify → eligibility → audited", async ({ page }) => {
    await asDistinctClient(page);
    const name = `E2E Fictional ${randomUUID().slice(0, 8)}`;
    const phone = fictionalPhone();
    await register(page, name, phone.local);

    await submitLogin(page, "staff@bloodbank.test", password);
    await expect(page).toHaveURL(/\/dashboard$/);

    // Pending Review lists the new registration, with a masked phone only.
    await page.getByRole("link", { name: "Pending review" }).click();
    const card = page.getByTestId("pending-donor").filter({ hasText: name });
    await expect(card).toBeVisible();
    await expect(card).not.toContainText(phone.local.slice(1));
    await expect(card).toContainText("B+");
    await expect(card).toContainText("self-reported");

    await card.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByTestId("pending-donor").filter({ hasText: name })).toHaveCount(0);

    // Profile: verified, then record eligibility.
    await page.getByRole("link", { name: "Donors", exact: true }).click();
    await page.getByLabel("Search by name or mobile number").fill(name);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Verified", { exact: true }).first()).toBeVisible();

    await page.getByLabel("Assessment").selectOption({ label: "Eligible" });
    await page.getByRole("button", { name: "Record assessment" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Dev Coordinator" }).filter({ hasText: "Eligible" })).toBeVisible();

    // Audited phone reveal.
    await expect(page.getByTestId("donor-phone")).not.toContainText(phone.local.slice(1));
    await page.getByRole("button", { name: "Show number" }).click();
    await expect(page.getByTestId("donor-phone")).toContainText(phone.local.slice(-4));

    const donor = await db.donor.findFirstOrThrow({ where: { phoneE164: phone.e164 } });
    expect(donor).toMatchObject({ verificationStatus: "VERIFIED", eligibilityStatus: "ELIGIBLE" });
    const actions = (await db.auditLog.findMany({ where: { entityId: donor.id } })).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "donor.registered",
        "consent.granted",
        "donor.verified",
        "donor.viewed",
        "donor.eligibility_changed",
        "donor.contact_revealed",
      ]),
    );
  });

  test("a viewer sees masked contact details and no write controls", async ({ page }) => {
    await asDistinctClient(page);
    const phone = fictionalPhone();
    await register(page, `E2E Fictional ${randomUUID().slice(0, 8)}`, phone.local);
    const donor = await db.donor.findFirstOrThrow({ where: { phoneE164: phone.e164 } });
    await submitLogin(page, "viewer@bloodbank.test", password);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto(`/donors/${donor.id}`);
    await expect(page.getByTestId("donor-phone")).toContainText("••");
    await expect(page.getByRole("button", { name: "Show number" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Verify" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Notes" })).toHaveCount(0);

    await page.goto("/donors/pending");
    await expect(page).toHaveURL(/\/no-access$/);
  });
});
