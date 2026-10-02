import { describe, expect, it } from "vitest";
import { ageOn, isValidIsoDate, todayIn } from "@/domain/dates";
import { displayBloodGroup } from "@/domain/blood-group";
import { maskPhone, normalizeEgyptianMobile } from "@/domain/phone";
import {
  allowedEligibilityTargets,
  assertCanDeactivate,
  assertCanReactivate,
  isReassessmentDue,
  transitionEligibility,
  transitionVerification,
} from "@/domain/donor/transitions";
import { ELIGIBILITY_STATUSES, VERIFICATION_STATUSES } from "@/domain/donor/enums";
import type { StaffRole } from "@/domain/auth/permissions";

describe("Egyptian mobile normalization (A5)", () => {
  it.each([
    ["01000000012", "+201000000012"],
    ["010 0000 0012", "+201000000012"],
    ["+20 100 000 0012", "+201000000012"],
    ["00201000000012", "+201000000012"],
    ["1000000012", "+201000000012"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeEgyptianMobile(input)).toBe(expected);
  });

  it.each(["", "abc", "0100", "+441234567890", "0223456789"])("rejects %s", (input) => {
    // Too short, non-Egyptian, or an Egyptian landline.
    expect(normalizeEgyptianMobile(input)).toBeNull();
  });

  it("masks all but the last two digits", () => {
    expect(maskPhone("+201000000012")).toBe("+20 ••••••••12");
    expect(maskPhone("+201000000012")).not.toContain("100000");
  });
});

describe("dates", () => {
  it("computes age on a reference date", () => {
    expect(ageOn("2008-10-03", "2026-10-02")).toBe(17);
    expect(ageOn("2008-10-02", "2026-10-02")).toBe(18);
  });

  it("rejects impossible calendar dates", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-02-28")).toBe(true);
  });

  it("uses the hospital time zone for today", () => {
    // 22:30 UTC on 1 Oct is already 2 Oct in Cairo (UTC+3 in summer time).
    expect(todayIn("Africa/Cairo", new Date("2026-10-01T22:30:00Z"))).toBe("2026-10-02");
  });
});

describe("displayed blood group keeps its source (D3)", () => {
  it("prefers the verified group", () => {
    expect(displayBloodGroup({ verifiedBloodGroup: "O_POS", selfReportedBloodGroup: "A_POS" })).toEqual({
      group: "O_POS",
      basis: "VERIFIED",
    });
  });
  it("falls back to self-reported and labels it", () => {
    expect(displayBloodGroup({ verifiedBloodGroup: null, selfReportedBloodGroup: "B_NEG" })).toEqual({
      group: "B_NEG",
      basis: "SELF_REPORTED",
    });
  });
  it("is null when unknown", () => {
    expect(displayBloodGroup({ verifiedBloodGroup: null, selfReportedBloodGroup: null })).toBeNull();
  });
});

describe("verification state machine (spec §6)", () => {
  const allowed: Array<[string, string, string, StaffRole]> = [
    ["PENDING", "verify", "VERIFIED", "STAFF"],
    ["PENDING", "reject", "REJECTED", "STAFF"],
    ["REJECTED", "reopen", "PENDING", "ADMIN"],
    ["VERIFIED", "revoke", "PENDING", "ADMIN"],
  ];

  it.each(allowed)("%s --%s--> %s as %s", (from, action, to, role) => {
    expect(transitionVerification(from as never, action as never, role).to).toBe(to);
  });

  it("rejects every other (state, action) pair", () => {
    for (const from of VERIFICATION_STATUSES) {
      for (const action of ["verify", "reject", "reopen", "revoke"] as const) {
        if (allowed.some(([f, a]) => f === from && a === action)) continue;
        expect(() => transitionVerification(from, action, "ADMIN")).toThrow(/INVALID_TRANSITION/);
      }
    }
  });

  it("restricts reopen and revoke to ADMIN", () => {
    expect(() => transitionVerification("REJECTED", "reopen", "STAFF")).toThrow(/FORBIDDEN/);
    expect(() => transitionVerification("VERIFIED", "revoke", "STAFF")).toThrow(/FORBIDDEN/);
  });

  it("forbids VIEWER from verifying", () => {
    expect(() => transitionVerification("PENDING", "verify", "VIEWER")).toThrow(/FORBIDDEN/);
  });
});

describe("eligibility state machine (spec §6)", () => {
  const allowed: Record<string, string[]> = {
    UNASSESSED: ["ELIGIBLE", "TEMPORARILY_INELIGIBLE", "PERMANENTLY_INELIGIBLE"],
    ELIGIBLE: ["TEMPORARILY_INELIGIBLE", "PERMANENTLY_INELIGIBLE"],
    TEMPORARILY_INELIGIBLE: ["ELIGIBLE", "PERMANENTLY_INELIGIBLE"],
    PERMANENTLY_INELIGIBLE: ["UNASSESSED"],
  };

  it("matches the diagram exactly", () => {
    for (const from of ELIGIBILITY_STATUSES) {
      expect([...allowedEligibilityTargets(from)].sort()).toEqual([...(allowed[from] ?? [])].sort());
      for (const to of ELIGIBILITY_STATUSES) {
        const ok = allowed[from]?.includes(to);
        const run = () => transitionEligibility(from, to, "ADMIN");
        if (ok) expect(run()).toBe(to);
        else expect(run).toThrow(/INVALID_TRANSITION/);
      }
    }
  });

  it("lets only ADMIN correct a permanent deferral", () => {
    expect(() => transitionEligibility("PERMANENTLY_INELIGIBLE", "UNASSESSED", "STAFF")).toThrow(/FORBIDDEN/);
  });

  it("never lets VIEWER record eligibility", () => {
    expect(() => transitionEligibility("UNASSESSED", "ELIGIBLE", "VIEWER")).toThrow(/FORBIDDEN/);
  });

  it("flags reassessment once a temporary deferral has passed, without changing status", () => {
    expect(isReassessmentDue("TEMPORARILY_INELIGIBLE", "2026-10-02", "2026-10-02")).toBe(true);
    expect(isReassessmentDue("TEMPORARILY_INELIGIBLE", "2026-10-03", "2026-10-02")).toBe(false);
    expect(isReassessmentDue("ELIGIBLE", null, "2026-10-02")).toBe(false);
  });
});

describe("activity", () => {
  it("blocks reactivation while either consent is withdrawn", () => {
    expect(() => assertCanReactivate("INACTIVE", ["REGISTRY"], "STAFF")).toThrow(/INVALID_TRANSITION/);
    expect(() => assertCanReactivate("INACTIVE", ["CONTACT"], "STAFF")).toThrow(/INVALID_TRANSITION/);
    expect(() => assertCanReactivate("INACTIVE", ["REGISTRY", "CONTACT"], "STAFF")).not.toThrow();
  });

  it("rejects no-op activity changes", () => {
    expect(() => assertCanReactivate("ACTIVE", ["REGISTRY", "CONTACT"], "STAFF")).toThrow(/INVALID_TRANSITION/);
    expect(() => assertCanDeactivate("INACTIVE", "STAFF")).toThrow(/INVALID_TRANSITION/);
  });

  it("forbids VIEWER", () => {
    expect(() => assertCanDeactivate("ACTIVE", "VIEWER")).toThrow(/FORBIDDEN/);
  });
});
