import { describe, expect, it } from "vitest";
import * as prismaEnums from "@/generated/prisma/enums";
import { BLOOD_GROUPS } from "@/domain/blood-group";
import * as domain from "@/domain/donor/enums";

/** The domain mirrors Prisma enums so it can stay free of the generated client. */
describe("domain enums match the Prisma schema", () => {
  it.each([
    ["BloodGroup", BLOOD_GROUPS],
    ["VerificationStatus", domain.VERIFICATION_STATUSES],
    ["EligibilityStatus", domain.ELIGIBILITY_STATUSES],
    ["ActivityStatus", domain.ACTIVITY_STATUSES],
    ["InactiveReason", domain.INACTIVE_REASONS],
    ["Availability", domain.AVAILABILITIES],
    ["DonatedBefore", domain.DONATED_BEFORE],
    ["ContactMethod", domain.CONTACT_METHODS],
    ["DonorSource", domain.DONOR_SOURCES],
    ["ConsentPurpose", domain.CONSENT_PURPOSES],
    ["RejectionReason", domain.REJECTION_REASONS],
    ["VerificationDecision", domain.VERIFICATION_DECISIONS],
  ] as const)("%s", (name, values) => {
    const prismaValues = Object.values((prismaEnums as Record<string, Record<string, string>>)[name] ?? {});
    expect([...values].sort()).toEqual(prismaValues.sort());
  });
});
