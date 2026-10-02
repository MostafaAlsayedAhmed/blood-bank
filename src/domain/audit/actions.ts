/**
 * Audit action names (spec §8 Audit strategy). Format "<entity>.<verb>" is also
 * enforced by the audit_log_action_format CHECK constraint.
 * Later phases add their actions here.
 */
export const AUDIT_ACTIONS = {
  authLogin: "auth.login",
  authLogout: "auth.logout",
  seedCompleted: "seed.completed",

  // Donor writes (Phase 2)
  donorRegistered: "donor.registered",
  donorRegistrationResubmitted: "donor.registration_resubmitted",
  donorCreated: "donor.created",
  donorUpdated: "donor.updated",
  donorVerified: "donor.verified",
  donorRejected: "donor.rejected",
  donorVerificationRevoked: "donor.verification_revoked",
  donorVerificationReopened: "donor.verification_reopened",
  donorReviewCleared: "donor.review_cleared",
  donorEligibilityChanged: "donor.eligibility_changed",
  donorAvailabilityChanged: "donor.availability_changed",
  donorActivityChanged: "donor.activity_changed",
  donorNoteAdded: "donor.note_added",
  consentGranted: "consent.granted",
  consentWithdrawn: "consent.withdrawn",

  // Donor reads of personal data (spec D12)
  donorViewed: "donor.viewed",
  donorContactRevealed: "donor.contact_revealed",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITY_TYPES = {
  user: "user",
  hospital: "hospital",
  donor: "donor",
} as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];
