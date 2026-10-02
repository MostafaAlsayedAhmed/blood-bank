import { describe, expect, it } from "vitest";
import {
  donorFiltersSchema,
  lastDonationMonthFor,
  recordEligibilitySchema,
  registrationSchema,
  setAvailabilitySchema,
} from "@/domain/donor/schemas";

const TODAY = "2026-10-02";

// Fictional person and number; never a real donor.
const valid = {
  fullName: "Test Donor One",
  phone: "010 0000 0012",
  dateOfBirth: "1990-05-01",
  bloodGroup: "O_POS",
  city: "Quseir",
  areaId: "",
  donatedBefore: "NO",
  lastDonationMonth: "",
  preferredContact: "WHATSAPP",
  consentRegistry: "on",
};

function errorsFor(input: Record<string, unknown>) {
  const result = registrationSchema(TODAY).safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe("registration schema (W1)", () => {
  it("accepts a valid form and normalizes it", () => {
    const parsed = registrationSchema(TODAY).parse(valid);
    expect(parsed.phone).toBe("+201000000012");
    expect(parsed.bloodGroup).toBe("O_POS");
    expect(parsed.areaId).toBeUndefined();
    expect(parsed.consentRegistry).toBe(true);
    expect(parsed.consentContact).toBe(false);
  });

  it("maps 'don't know' to a null blood group", () => {
    expect(registrationSchema(TODAY).parse({ ...valid, bloodGroup: "UNKNOWN" }).bloodGroup).toBeNull();
  });

  it("requires the registry consent and keeps the contact consent optional", () => {
    expect(errorsFor({ ...valid, consentRegistry: undefined })).toEqual({ consentRegistry: "consentRequired" });
    expect(registrationSchema(TODAY).parse({ ...valid, consentContact: "on" }).consentContact).toBe(true);
  });

  it("rejects under-18 registrants (A6) with a specific message", () => {
    expect(errorsFor({ ...valid, dateOfBirth: "2008-10-03" })).toEqual({ dateOfBirth: "underAge" });
    expect(errorsFor({ ...valid, dateOfBirth: "2008-10-02" })).toEqual({});
  });

  it("rejects impossible and future dates of birth", () => {
    expect(errorsFor({ ...valid, dateOfBirth: "2027-01-01" }).dateOfBirth).toBe("invalidDate");
    expect(errorsFor({ ...valid, dateOfBirth: "1800-01-01" }).dateOfBirth).toBe("invalidDate");
    expect(errorsFor({ ...valid, dateOfBirth: "1990-02-30" }).dateOfBirth).toBe("invalidDate");
  });

  it("rejects non-Egyptian or invalid numbers", () => {
    expect(errorsFor({ ...valid, phone: "+44 7700 900123" })).toEqual({ phone: "invalidPhone" });
  });

  it("rejects a future last-donation month", () => {
    expect(errorsFor({ ...valid, donatedBefore: "YES", lastDonationMonth: "2026-11" })).toEqual({
      lastDonationMonth: "dateInFuture",
    });
  });

  it("keeps the last-donation month only when the donor said YES", () => {
    expect(lastDonationMonthFor("YES", "2026-01")).toBe("2026-01");
    expect(lastDonationMonthFor("NO", "2026-01")).toBeNull();
  });
});

describe("eligibility schema (W4, M7)", () => {
  const schema = recordEligibilitySchema(TODAY);
  const donorId = "8f9c2a52-5d0e-4a8e-9a3b-0c2f4a1e9b10";

  it("requires an until-date in the future and a note for a temporary deferral", () => {
    const result = schema.safeParse({ donorId, status: "TEMPORARILY_INELIGIBLE" });
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["until", "note"]));
    expect(schema.safeParse({ donorId, status: "TEMPORARILY_INELIGIBLE", until: TODAY, note: "x" }).success).toBe(
      false,
    );
  });

  it("requires a note for a permanent deferral but not for ELIGIBLE", () => {
    expect(schema.safeParse({ donorId, status: "PERMANENTLY_INELIGIBLE" }).success).toBe(false);
    expect(schema.safeParse({ donorId, status: "ELIGIBLE" }).success).toBe(true);
  });

  it("drops an until-date that does not apply", () => {
    expect(schema.parse({ donorId, status: "ELIGIBLE", until: "2027-01-01" }).until).toBeUndefined();
  });
});

describe("availability schema", () => {
  it("keeps unavailableUntil only for UNAVAILABLE", () => {
    const schema = setAvailabilitySchema(TODAY);
    const donorId = "8f9c2a52-5d0e-4a8e-9a3b-0c2f4a1e9b10";
    expect(schema.parse({ donorId, availability: "AVAILABLE", unavailableUntil: "2027-01-01" }).unavailableUntil).toBe(
      undefined,
    );
    expect(schema.parse({ donorId, availability: "UNAVAILABLE", unavailableUntil: "2027-01-01" }).unavailableUntil).toBe(
      "2027-01-01",
    );
  });
});

describe("donor list filters", () => {
  it("drops invalid values instead of failing, so stale links still render", () => {
    expect(donorFiltersSchema.parse({ bloodGroup: "Z", verification: "VERIFIED", page: "-3" })).toEqual({
      verification: "VERIFIED",
      page: 1,
    });
  });
});
