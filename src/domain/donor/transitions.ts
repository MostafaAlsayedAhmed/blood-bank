import { DomainError } from "@/domain/errors";
import { assertPermission, type Permission, type StaffRole } from "@/domain/auth/permissions";
import type {
  ActivityStatus,
  ConsentPurpose,
  EligibilityStatus,
  VerificationDecision,
  VerificationStatus,
} from "@/domain/donor/enums";

/**
 * Donor state machines (spec §6). Each function is given the current state, the
 * requested action and the actor's role, and returns the next state or throws
 * INVALID_TRANSITION / FORBIDDEN. Services persist the result with a guarded
 * UPDATE … WHERE status = current, so concurrent clicks cannot double-transition.
 */

function assertRole(role: StaffRole, permission: Permission): void {
  assertPermission({ role }, permission);
}

// ─── verificationStatus ──────────────────────────────────────────────────────

export type VerificationAction = "verify" | "reject" | "reopen" | "revoke";

const VERIFICATION_TRANSITIONS: Readonly<
  Record<
    VerificationAction,
    { from: VerificationStatus; to: VerificationStatus; decision: VerificationDecision; permission: Permission }
  >
> = {
  verify: { from: "PENDING", to: "VERIFIED", decision: "VERIFIED", permission: "donor:verify" },
  reject: { from: "PENDING", to: "REJECTED", decision: "REJECTED", permission: "donor:verify" },
  reopen: { from: "REJECTED", to: "PENDING", decision: "REOPENED", permission: "donor:verify_admin" },
  revoke: { from: "VERIFIED", to: "PENDING", decision: "REVOKED", permission: "donor:verify_admin" },
};

export function transitionVerification(
  current: VerificationStatus,
  action: VerificationAction,
  role: StaffRole,
): { to: VerificationStatus; decision: VerificationDecision } {
  const rule = VERIFICATION_TRANSITIONS[action];
  assertRole(role, rule.permission);
  if (current !== rule.from) throw new DomainError("INVALID_TRANSITION", `verification ${current} -/-> ${action}`);
  return { to: rule.to, decision: rule.decision };
}

// ─── eligibilityStatus ───────────────────────────────────────────────────────

const ELIGIBILITY_TRANSITIONS: Readonly<Record<EligibilityStatus, readonly EligibilityStatus[]>> = {
  UNASSESSED: ["ELIGIBLE", "TEMPORARILY_INELIGIBLE", "PERMANENTLY_INELIGIBLE"],
  ELIGIBLE: ["TEMPORARILY_INELIGIBLE", "PERMANENTLY_INELIGIBLE"],
  TEMPORARILY_INELIGIBLE: ["ELIGIBLE", "PERMANENTLY_INELIGIBLE"],
  // Correction only (ADMIN, reason required).
  PERMANENTLY_INELIGIBLE: ["UNASSESSED"],
};

export function transitionEligibility(
  current: EligibilityStatus,
  target: EligibilityStatus,
  role: StaffRole,
): EligibilityStatus {
  assertRole(role, current === "PERMANENTLY_INELIGIBLE" ? "donor:eligibility_correct" : "donor:set_eligibility");
  if (!ELIGIBILITY_TRANSITIONS[current].includes(target)) {
    throw new DomainError("INVALID_TRANSITION", `eligibility ${current} -/-> ${target}`);
  }
  return target;
}

export function allowedEligibilityTargets(current: EligibilityStatus): readonly EligibilityStatus[] {
  return ELIGIBILITY_TRANSITIONS[current];
}

/** "Reassessment due": a temporary deferral whose until-date has passed (never auto-expires, M7). */
export function isReassessmentDue(
  status: EligibilityStatus,
  ineligibleUntil: string | null,
  today: string,
): boolean {
  return status === "TEMPORARILY_INELIGIBLE" && ineligibleUntil !== null && ineligibleUntil <= today;
}

// ─── activityStatus ──────────────────────────────────────────────────────────

/** Reactivation is blocked while either consent is withdrawn (spec §6, A12). */
export function assertCanReactivate(
  current: ActivityStatus,
  activeConsents: readonly ConsentPurpose[],
  role: StaffRole,
): void {
  assertRole(role, "donor:update");
  if (current !== "INACTIVE") throw new DomainError("INVALID_TRANSITION", "donor is already active");
  if (!activeConsents.includes("REGISTRY") || !activeConsents.includes("CONTACT")) {
    throw new DomainError("INVALID_TRANSITION", "reactivation needs active registry and contact consent");
  }
}

export function assertCanDeactivate(current: ActivityStatus, role: StaffRole): void {
  assertRole(role, "donor:update");
  if (current !== "ACTIVE") throw new DomainError("INVALID_TRANSITION", "donor is already inactive");
}
