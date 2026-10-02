import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import type { AuthContext } from "@/server/auth/session-verifier";
import type { StaffRole } from "@/domain/auth/permissions";
import { registrationSchema, staffCreateDonorSchema } from "@/domain/donor/schemas";
import { isDomainError } from "@/domain/errors";

// Services read DATABASE_URL when first imported, so point them at the test container first.
process.env.DATABASE_URL = inject("databaseUrl");
const { db } = await import("@/server/db");
const { registerPublicDonor, REGISTRATION_THROTTLE } = await import("@/server/services/registration");
const donors = await import("@/server/services/donors");
const queries = await import("@/server/queries/donors");

const TODAY = "2026-10-02";
let hospitalId: string;
let otherHospitalId: string;
let areaId: string;
const ctx = {} as Record<StaffRole | "OTHER", AuthContext>;

// Fictional people and numbers only. Each test uses its own number.
let phoneCounter = 100;
function nextPhone(): string {
  phoneCounter += 1;
  return `0100000${String(phoneCounter).padStart(4, "0")}`;
}

function publicForm(overrides: Record<string, string> = {}) {
  return registrationSchema(TODAY).parse({
    fullName: "Fictional Registrant",
    phone: nextPhone(),
    dateOfBirth: "1990-05-01",
    bloodGroup: "A_POS",
    city: "Quseir",
    areaId,
    donatedBefore: "YES",
    lastDonationMonth: "2026-01",
    preferredContact: "PHONE",
    consentRegistry: "on",
    consentContact: "on",
    ...overrides,
  });
}

function staffForm(overrides: Record<string, string> = {}) {
  return staffCreateDonorSchema(TODAY).parse({
    fullName: "Fictional Walk-in",
    phone: nextPhone(),
    dateOfBirth: "1985-01-15",
    bloodGroup: "UNKNOWN",
    city: "Quseir",
    donatedBefore: "NO",
    preferredContact: "WHATSAPP",
    consentRegistry: "on",
    consentContact: "on",
    ...overrides,
  });
}

async function makeStaff(hospital: string, role: StaffRole, hospitalName: string): Promise<AuthContext> {
  const user = await db.user.create({
    data: { id: randomUUID(), name: `Test ${role}`, email: `${randomUUID()}@bloodbank.test` },
  });
  await db.staffMembership.create({ data: { userId: user.id, hospitalId: hospital, role } });
  return { userId: user.id, name: user.name, hospitalId: hospital, hospitalName, role } as AuthContext;
}

async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "OK";
  } catch (error) {
    if (isDomainError(error)) return error.code;
    throw error;
  }
}

async function createStaffDonor(overrides: Record<string, string> = {}): Promise<string> {
  return (await donors.createDonor(ctx.STAFF, staffForm(overrides))).donorId;
}

beforeAll(async () => {
  const hospital = await db.hospital.create({
    data: { code: `T-${randomUUID().slice(0, 8)}`, name: "Integration Hospital", city: "Quseir" },
  });
  const other = await db.hospital.create({
    data: { code: `T-${randomUUID().slice(0, 8)}`, name: "Other Hospital", city: "Elsewhere" },
  });
  hospitalId = hospital.id;
  otherHospitalId = other.id;
  areaId = (await db.area.create({ data: { hospitalId, city: "Quseir", name: "Test Area" } })).id;
  ctx.ADMIN = await makeStaff(hospitalId, "ADMIN", hospital.name);
  ctx.STAFF = await makeStaff(hospitalId, "STAFF", hospital.name);
  ctx.VIEWER = await makeStaff(hospitalId, "VIEWER", hospital.name);
  ctx.OTHER = await makeStaff(otherHospitalId, "ADMIN", other.name);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("public registration (W1)", () => {
  it("creates a PENDING/UNASSESSED donor, two consents and audit rows together", async () => {
    const input = publicForm();
    expect(await registerPublicDonor({ hospitalId, ipHash: randomUUID() }, input)).toBe("accepted");

    const donor = await db.donor.findUniqueOrThrow({
      where: { hospitalId_phoneE164: { hospitalId, phoneE164: input.phone } },
      include: { consents: true },
    });
    expect(donor).toMatchObject({
      verificationStatus: "PENDING",
      eligibilityStatus: "UNASSESSED",
      activityStatus: "ACTIVE",
      availability: "UNKNOWN",
      source: "PUBLIC_FORM",
      selfReportedBloodGroup: "A_POS",
      verifiedBloodGroup: null,
      areaId,
    });
    expect(donor.consents.map((c) => c.purpose).sort()).toEqual(["CONTACT", "REGISTRY"]);
    expect(donor.consents.every((c) => c.channel === "PUBLIC_FORM" && c.capturedById === null)).toBe(true);

    const audit = await db.auditLog.findMany({ where: { entityId: donor.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => a.action)).toEqual(["donor.registered", "consent.granted", "consent.granted"]);
    expect(audit.every((a) => a.actorType === "PUBLIC" && a.actorUserId === null)).toBe(true);
  });

  it("stores only the registry consent when contact consent is not ticked", async () => {
    const input = publicForm({ consentContact: "" });
    await registerPublicDonor({ hospitalId, ipHash: randomUUID() }, input);
    const consents = await db.consentRecord.findMany({ where: { donor: { phoneE164: input.phone } } });
    expect(consents.map((c) => c.purpose)).toEqual(["REGISTRY"]);
  });

  it("answers a duplicate phone identically, flags the existing donor and stores nothing new", async () => {
    const first = publicForm();
    await registerPublicDonor({ hospitalId, ipHash: randomUUID() }, first);
    const again = { ...publicForm({ fullName: "Someone Else" }), phone: first.phone };

    expect(await registerPublicDonor({ hospitalId, ipHash: randomUUID() }, again)).toBe("accepted");

    const rows = await db.donor.findMany({ where: { hospitalId, phoneE164: first.phone }, include: { consents: true } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fullName: "Fictional Registrant", needsReview: true });
    expect(rows[0]?.consents).toHaveLength(2);
    const audit = await db.auditLog.findFirst({ where: { entityId: rows[0]?.id, action: "donor.registration_resubmitted" } });
    expect(audit?.actorType).toBe("PUBLIC");
  });

  it("throttles repeated submissions from one IP hash", async () => {
    const pctx = { hospitalId, ipHash: randomUUID() };
    for (let i = 0; i < REGISTRATION_THROTTLE.maxAttempts; i++) {
      expect(await registerPublicDonor(pctx, publicForm())).toBe("accepted");
    }
    const blocked = publicForm();
    expect(await registerPublicDonor(pctx, blocked)).toBe("throttled");
    expect(await db.donor.count({ where: { phoneE164: blocked.phone } })).toBe(0);
  });
});

describe("staff entry and verification (W2, W3)", () => {
  it("creates a donor with staff-captured consents, and 'verify now' is a separate audited step", async () => {
    const { donorId } = await donors.createDonor(ctx.STAFF, staffForm({ verifyNow: "on" }));
    const donor = await db.donor.findUniqueOrThrow({
      where: { id: donorId },
      include: { consents: true, verifications: true },
    });
    expect(donor.source).toBe("STAFF_ENTRY");
    expect(donor.verificationStatus).toBe("VERIFIED");
    expect(donor.consents.every((c) => c.channel === "STAFF_ENTRY" && c.capturedById === ctx.STAFF.userId)).toBe(true);
    expect(donor.verifications.map((v) => v.decision)).toEqual(["VERIFIED"]);

    const actions = (await db.auditLog.findMany({ where: { entityId: donorId }, orderBy: { createdAt: "asc" } })).map(
      (a) => a.action,
    );
    expect(actions).toEqual(["donor.created", "consent.granted", "consent.granted", "donor.verified"]);
  });

  it("rejects a duplicate phone number with CONFLICT", async () => {
    const phone = nextPhone();
    await createStaffDonor({ phone });
    expect(await errorCode(createStaffDonor({ phone }))).toBe("CONFLICT");
  });

  it("forbids VIEWER writes", async () => {
    expect(await errorCode(donors.createDonor(ctx.VIEWER, staffForm()))).toBe("FORBIDDEN");
  });

  it("rejects with a reason; only ADMIN can reopen", async () => {
    const donorId = await createStaffDonor();
    await donors.rejectDonor(ctx.STAFF, { donorId, reason: "UNREACHABLE", note: "Three calls, no answer" });
    expect(await errorCode(donors.reopenDonor(ctx.STAFF, { donorId, note: "retry" }))).toBe("FORBIDDEN");
    await donors.reopenDonor(ctx.ADMIN, { donorId, note: "Donor called back" });

    const history = await db.donorVerification.findMany({ where: { donorId }, orderBy: { createdAt: "asc" } });
    expect(history.map((h) => [h.decision, h.rejectionReason])).toEqual([
      ["REJECTED", "UNREACHABLE"],
      ["REOPENED", null],
    ]);
    expect((await db.donor.findUniqueOrThrow({ where: { id: donorId } })).verificationStatus).toBe("PENDING");
  });

  it("lets exactly one of two concurrent verifications win", async () => {
    const donorId = await createStaffDonor();
    const codes = await Promise.all([
      errorCode(donors.verifyDonor(ctx.STAFF, { donorId })),
      errorCode(donors.verifyDonor(ctx.ADMIN, { donorId })),
    ]);
    expect(codes.filter((c) => c === "OK")).toHaveLength(1);
    expect(codes.filter((c) => c === "CONFLICT" || c === "INVALID_TRANSITION")).toHaveLength(1);
    expect(await db.donorVerification.count({ where: { donorId } })).toBe(1);
  });

  it("returns a verified donor to PENDING when the phone number changes (A13)", async () => {
    const donorId = await createStaffDonor({ verifyNow: "on" });
    const current = await db.donor.findUniqueOrThrow({ where: { id: donorId } });
    await donors.updateDonor(ctx.STAFF, {
      donorId,
      fullName: current.fullName,
      phone: `+20${nextPhone().slice(1)}`,
      dateOfBirth: "1985-01-15",
      bloodGroup: null,
      city: current.city,
      areaId: undefined,
      donatedBefore: "NO",
      lastDonationMonth: undefined,
      preferredContact: "WHATSAPP",
    });
    const after = await db.donor.findUniqueOrThrow({ where: { id: donorId }, include: { verifications: true } });
    expect(after.verificationStatus).toBe("PENDING");
    expect(after.verifications.map((v) => v.decision).sort()).toEqual(["REVOKED", "VERIFIED"]);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: donorId, action: "donor.updated" } });
    expect(audit.metadata).toMatchObject({ fields: ["phoneE164"], reason: "phone_changed" });
  });

  it("clears the review flag set by a resubmission", async () => {
    const input = publicForm();
    await registerPublicDonor({ hospitalId, ipHash: randomUUID() }, input);
    await registerPublicDonor({ hospitalId, ipHash: randomUUID() }, input);
    const donor = await db.donor.findUniqueOrThrow({ where: { hospitalId_phoneE164: { hospitalId, phoneE164: input.phone } } });
    await donors.clearReview(ctx.STAFF, { donorId: donor.id });
    expect((await db.donor.findUniqueOrThrow({ where: { id: donor.id } })).needsReview).toBe(false);
    expect(await errorCode(donors.clearReview(ctx.STAFF, { donorId: donor.id }))).toBe("INVALID_TRANSITION");
  });
});

describe("eligibility (W4)", () => {
  it("appends history and keeps the until-date on the donor", async () => {
    const donorId = await createStaffDonor();
    await donors.recordEligibility(ctx.STAFF, {
      donorId,
      status: "TEMPORARILY_INELIGIBLE",
      until: "2026-12-01",
      note: "Deferred by staff",
    });
    await donors.recordEligibility(ctx.STAFF, { donorId, status: "ELIGIBLE", until: undefined, note: undefined });

    const donor = await db.donor.findUniqueOrThrow({ where: { id: donorId }, include: { eligibility: true } });
    expect(donor.eligibilityStatus).toBe("ELIGIBLE");
    expect(donor.ineligibleUntil).toBeNull();
    expect(donor.eligibility).toHaveLength(2);
    expect(donor.eligibility.every((e) => e.rulesetVersion === null)).toBe(true);
  });

  it("refuses transitions outside the state machine, and permanent corrections by STAFF", async () => {
    const donorId = await createStaffDonor();
    await donors.recordEligibility(ctx.STAFF, { donorId, status: "PERMANENTLY_INELIGIBLE", note: "Recorded by staff" });
    expect(await errorCode(donors.recordEligibility(ctx.STAFF, { donorId, status: "ELIGIBLE" }))).toBe("FORBIDDEN");
    expect(await errorCode(donors.correctEligibility(ctx.STAFF, { donorId, note: "x" }))).toBe("FORBIDDEN");
    await donors.correctEligibility(ctx.ADMIN, { donorId, note: "Entered on the wrong donor" });
    expect((await db.donor.findUniqueOrThrow({ where: { id: donorId } })).eligibilityStatus).toBe("UNASSESSED");
  });
});

describe("consent withdrawal (W9) and activity", () => {
  it("makes the donor inactive at once and blocks reactivation until consent is given again", async () => {
    const donorId = await createStaffDonor();
    await donors.withdrawConsent(ctx.STAFF, { donorId, purpose: "CONTACT" });

    let donor = await db.donor.findUniqueOrThrow({ where: { id: donorId } });
    expect(donor).toMatchObject({ activityStatus: "INACTIVE", inactiveReason: "CONSENT_WITHDRAWN" });
    expect(await errorCode(donors.reactivateDonor(ctx.STAFF, { donorId }))).toBe("INVALID_TRANSITION");
    expect(await errorCode(donors.withdrawConsent(ctx.STAFF, { donorId, purpose: "CONTACT" }))).toBe(
      "INVALID_TRANSITION",
    );

    await donors.grantConsent(ctx.STAFF, { donorId, purpose: "CONTACT" });
    await donors.reactivateDonor(ctx.STAFF, { donorId });
    donor = await db.donor.findUniqueOrThrow({ where: { id: donorId } });
    expect(donor).toMatchObject({ activityStatus: "ACTIVE", inactiveReason: null });

    const consents = await db.consentRecord.findMany({ where: { donorId, purpose: "CONTACT" } });
    expect(consents).toHaveLength(2);
    expect(consents.filter((c) => c.withdrawnAt === null)).toHaveLength(1);
  });

  it("refuses a second active consent for the same purpose", async () => {
    const donorId = await createStaffDonor();
    expect(await errorCode(donors.grantConsent(ctx.STAFF, { donorId, purpose: "REGISTRY" }))).toBe(
      "INVALID_TRANSITION",
    );
  });

  it("sets availability and records the change", async () => {
    const donorId = await createStaffDonor();
    await donors.setAvailability(ctx.STAFF, { donorId, availability: "UNAVAILABLE", unavailableUntil: "2026-11-01" });
    const donor = await db.donor.findUniqueOrThrow({ where: { id: donorId } });
    expect(donor.availability).toBe("UNAVAILABLE");
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: donorId, action: "donor.availability_changed" } });
    expect(audit.metadata).toEqual({ from: "UNKNOWN", to: "UNAVAILABLE" });
  });
});

describe("reads, masking and read audit", () => {
  it("masks phones in lists and audits profile views and reveals", async () => {
    const phone = nextPhone();
    const donorId = await createStaffDonor({ phone });
    await donors.addNote(ctx.STAFF, { donorId, body: "Prefers evening calls" });

    const page = await queries.listDonors(ctx.VIEWER, { page: 1 }, TODAY);
    const row = page.rows.find((r) => r.id === donorId);
    expect(row?.maskedPhone).toMatch(/^\+20 •+\d{2}$/);
    expect(JSON.stringify(page)).not.toContain(phone.slice(1));

    const viewerProfile = await queries.getDonorProfile(ctx.VIEWER, donorId, TODAY);
    expect(viewerProfile.notes).toBeNull();
    expect(JSON.stringify(viewerProfile)).not.toContain(phone.slice(1));
    expect((await queries.getDonorProfile(ctx.STAFF, donorId, TODAY)).notes).toHaveLength(1);

    expect(await errorCode(donors.revealContact(ctx.VIEWER, { donorId }))).toBe("FORBIDDEN");
    const revealed = await donors.revealContact(ctx.STAFF, { donorId });
    expect(revealed.phone.replace(/\D/g, "")).toBe(`20${phone.slice(1)}`);

    const actions = (await db.auditLog.findMany({ where: { entityId: donorId } })).map((a) => a.action);
    expect(actions.filter((a) => a === "donor.viewed")).toHaveLength(2);
    expect(actions).toContain("donor.contact_revealed");
  });

  it("finds donors by partial phone and by name, case-insensitively", async () => {
    const phone = nextPhone();
    const donorId = await createStaffDonor({ phone, fullName: "Searchable Fictional Name" });
    expect((await queries.searchDonors(ctx.STAFF, phone.slice(-6), { page: 1 }, TODAY)).map((r) => r.id)).toContain(
      donorId,
    );
    expect((await queries.searchDonors(ctx.STAFF, "searchable fict", { page: 1 }, TODAY)).map((r) => r.id)).toContain(
      donorId,
    );
  });

  it("never writes names, phones or notes into audit metadata", async () => {
    const rows = await db.auditLog.findMany({ where: { hospitalId } });
    const serialized = JSON.stringify(rows.map((r) => r.metadata));
    expect(serialized).not.toMatch(/Fictional|\+20\d|Prefers evening/);
  });
});

describe("cross-hospital isolation (IDOR)", () => {
  it("hides another hospital's donor from every read and write", async () => {
    const donorId = await createStaffDonor();
    const other = ctx.OTHER;
    expect(await errorCode(queries.getDonorProfile(other, donorId, TODAY))).toBe("NOT_FOUND");
    expect(await errorCode(donors.revealContact(other, { donorId }))).toBe("NOT_FOUND");
    expect(await errorCode(donors.verifyDonor(other, { donorId }))).toBe("NOT_FOUND");
    expect(await errorCode(donors.addNote(other, { donorId, body: "x" }))).toBe("NOT_FOUND");
    expect(await errorCode(donors.withdrawConsent(other, { donorId, purpose: "CONTACT" }))).toBe("NOT_FOUND");
    expect((await queries.listDonors(other, { page: 1 }, TODAY)).rows.map((r) => r.id)).not.toContain(donorId);
  });

  it("ignores an area from another hospital", async () => {
    const foreignArea = await db.area.create({ data: { hospitalId: otherHospitalId, city: "Elsewhere", name: "Foreign" } });
    const donorId = await createStaffDonor({ areaId: foreignArea.id });
    expect((await db.donor.findUniqueOrThrow({ where: { id: donorId } })).areaId).toBeNull();
  });
});

describe("database integrity rules", () => {
  it("keeps verification and eligibility history append-only", async () => {
    const donorId = await createStaffDonor({ verifyNow: "on" });
    await expect(
      db.$executeRawUnsafe(`UPDATE "donor_verification" SET "note" = 'x' WHERE "donorId" = '${donorId}'`),
    ).rejects.toThrow(/append-only/);
    await expect(db.$executeRawUnsafe(`DELETE FROM "donor_verification" WHERE "donorId" = '${donorId}'`)).rejects.toThrow(
      /append-only/,
    );
  });

  it("allows a consent row only to record its withdrawal, once", async () => {
    const donorId = await createStaffDonor();
    const consent = await db.consentRecord.findFirstOrThrow({ where: { donorId, purpose: "REGISTRY" } });
    await expect(db.consentRecord.update({ where: { id: consent.id }, data: { noticeVersion: "other" } })).rejects.toThrow();
    await expect(db.consentRecord.delete({ where: { id: consent.id } })).rejects.toThrow();
  });

  it("rejects inconsistent donor status fields", async () => {
    const donorId = await createStaffDonor();
    await expect(db.donor.update({ where: { id: donorId }, data: { activityStatus: "INACTIVE" } })).rejects.toThrow();
    await expect(
      db.donor.update({ where: { id: donorId }, data: { eligibilityStatus: "TEMPORARILY_INELIGIBLE" } }),
    ).rejects.toThrow();
  });
});
