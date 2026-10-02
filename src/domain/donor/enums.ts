/**
 * Donor enum values, mirrored from prisma/schema.prisma so the pure domain layer
 * does not import the generated client. tests/unit/donor-enums.test.ts keeps them in sync.
 */

export const VERIFICATION_STATUSES = ["PENDING", "VERIFIED", "REJECTED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ELIGIBILITY_STATUSES = [
  "UNASSESSED",
  "ELIGIBLE",
  "TEMPORARILY_INELIGIBLE",
  "PERMANENTLY_INELIGIBLE",
] as const;
export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];

export const ACTIVITY_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const INACTIVE_REASONS = ["DONOR_OPT_OUT", "UNREACHABLE", "CONSENT_WITHDRAWN", "DUPLICATE"] as const;
export type InactiveReason = (typeof INACTIVE_REASONS)[number];

/** Reasons staff may pick directly; CONSENT_WITHDRAWN is set only by a consent withdrawal. */
export const MANUAL_INACTIVE_REASONS = ["DONOR_OPT_OUT", "UNREACHABLE", "DUPLICATE"] as const;

export const AVAILABILITIES = ["AVAILABLE", "UNAVAILABLE", "UNKNOWN"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const DONATED_BEFORE = ["YES", "NO", "UNSURE"] as const;
export type DonatedBefore = (typeof DONATED_BEFORE)[number];

export const CONTACT_METHODS = ["PHONE", "WHATSAPP"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const DONOR_SOURCES = ["PUBLIC_FORM", "STAFF_ENTRY"] as const;
export type DonorSource = (typeof DONOR_SOURCES)[number];

export const CONSENT_PURPOSES = ["REGISTRY", "CONTACT"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const REJECTION_REASONS = ["DUPLICATE", "UNREACHABLE", "INVALID", "NOT_MEETING_CRITERIA", "OTHER"] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const VERIFICATION_DECISIONS = ["VERIFIED", "REJECTED", "REVOKED", "REOPENED"] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];
