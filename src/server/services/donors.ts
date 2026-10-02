import "server-only";
import { db } from "@/server/db";
import type { AuthContext } from "@/server/auth/session-verifier";
import { currentNoticeEvidence } from "@/server/services/privacy-notice";
import {
  activeAreaId,
  auditDonor,
  grantConsents,
  guardedDonorUpdate,
  loadDonorState,
} from "@/server/services/donor-shared";
import { isUniqueViolation } from "@/server/prisma-errors";
import { AUDIT_ACTIONS } from "@/domain/audit/actions";
import { assertPermission } from "@/domain/auth/permissions";
import { DomainError } from "@/domain/errors";
import { fromIsoDate, monthToFirstDay, toIsoDate } from "@/domain/dates";
import { formatPhone } from "@/domain/phone";
import type { ConsentPurpose } from "@/domain/donor/enums";
import {
  assertCanDeactivate,
  assertCanReactivate,
  transitionEligibility,
  transitionVerification,
  type VerificationAction,
} from "@/domain/donor/transitions";
import {
  lastDonationMonthFor,
  type AddNoteInput,
  type AdminVerificationInput,
  type ConsentPurposeInput,
  type CorrectEligibilityInput,
  type DeactivateDonorInput,
  type DonorIdInput,
  type RecordEligibilityInput,
  type RejectDonorInput,
  type SetAvailabilityInput,
  type StaffCreateDonorInput,
  type UpdateDonorInput,
  type VerifyDonorInput,
} from "@/domain/donor/schemas";

/**
 * Staff donor writes (W2–W4, W9 withdrawal). Each function re-asserts its
 * permission, loads the donor scoped to ctx.hospitalId, applies a pure transition,
 * persists with a guarded update and writes the audit row in the same transaction.
 */

function rethrowDuplicatePhone(error: unknown): never {
  if (isUniqueViolation(error)) throw new DomainError("CONFLICT", "duplicate phone");
  throw error;
}

// ─── Create and edit (W2) ────────────────────────────────────────────────────

export async function createDonor(ctx: AuthContext, input: StaffCreateDonorInput): Promise<{ donorId: string }> {
  assertPermission(ctx, "donor:create");
  const evidence = currentNoticeEvidence();

  const donorId = await db
    .$transaction(async (tx) => {
      const areaId = await activeAreaId(tx, ctx.hospitalId, input.areaId);
      const lastMonth = lastDonationMonthFor(input.donatedBefore, input.lastDonationMonth);
      const donor = await tx.donor.create({
        data: {
          hospitalId: ctx.hospitalId,
          fullName: input.fullName,
          phoneE164: input.phone,
          dateOfBirth: fromIsoDate(input.dateOfBirth),
          city: input.city,
          areaId,
          preferredContact: input.preferredContact,
          selfReportedBloodGroup: input.bloodGroup,
          donatedBefore: input.donatedBefore,
          selfReportedLastDonationMonth: lastMonth ? fromIsoDate(monthToFirstDay(lastMonth)) : null,
          source: "STAFF_ENTRY",
        },
        select: { id: true },
      });
      const purposes: ConsentPurpose[] = input.consentContact ? ["REGISTRY", "CONTACT"] : ["REGISTRY"];
      await auditDonor(tx, ctx, AUDIT_ACTIONS.donorCreated, donor.id, {
        source: "STAFF_ENTRY",
        consentPurposes: purposes,
      });
      await grantConsents(tx, {
        hospitalId: ctx.hospitalId,
        donorId: donor.id,
        purposes,
        evidence,
        actorUserId: ctx.userId,
      });
      return donor.id;
    })
    .catch(rethrowDuplicatePhone);

  // "Verify now" is a second, separately audited step (spec W2).
  if (input.verifyNow) await verifyDonor(ctx, { donorId });
  return { donorId };
}

const EDITABLE_FIELDS = [
  "fullName",
  "phoneE164",
  "dateOfBirth",
  "city",
  "areaId",
  "preferredContact",
  "selfReportedBloodGroup",
  "donatedBefore",
  "selfReportedLastDonationMonth",
] as const;

export async function updateDonor(ctx: AuthContext, input: UpdateDonorInput): Promise<void> {
  assertPermission(ctx, "donor:update");

  await db
    .$transaction(async (tx) => {
      await loadDonorState(tx, ctx, input.donorId);
      const current = await tx.donor.findUniqueOrThrow({
        where: { id: input.donorId },
        select: {
          fullName: true,
          phoneE164: true,
          dateOfBirth: true,
          city: true,
          areaId: true,
          preferredContact: true,
          selfReportedBloodGroup: true,
          donatedBefore: true,
          selfReportedLastDonationMonth: true,
          verificationStatus: true,
          updatedAt: true,
        },
      });

      const lastMonth = lastDonationMonthFor(input.donatedBefore, input.lastDonationMonth);
      const next = {
        fullName: input.fullName,
        phoneE164: input.phone,
        dateOfBirth: fromIsoDate(input.dateOfBirth),
        city: input.city,
        areaId: await activeAreaId(tx, ctx.hospitalId, input.areaId),
        preferredContact: input.preferredContact,
        selfReportedBloodGroup: input.bloodGroup,
        donatedBefore: input.donatedBefore,
        selfReportedLastDonationMonth: lastMonth ? fromIsoDate(monthToFirstDay(lastMonth)) : null,
      };

      const changed = EDITABLE_FIELDS.filter((field) => !sameValue(current[field], next[field]));
      if (changed.length === 0) return;

      // Assumption A13: a new phone number needs re-verification.
      const phoneChanged = changed.includes("phoneE164");
      const revokes = phoneChanged && current.verificationStatus === "VERIFIED";

      await guardedDonorUpdate(tx, ctx, input.donorId, { updatedAt: current.updatedAt }, {
        ...next,
        ...(revokes ? { verificationStatus: "PENDING" as const } : {}),
      });
      if (revokes) {
        await tx.donorVerification.create({
          data: { hospitalId: ctx.hospitalId, donorId: input.donorId, decision: "REVOKED", decidedById: ctx.userId },
        });
      }
      await auditDonor(tx, ctx, AUDIT_ACTIONS.donorUpdated, input.donorId, {
        fields: changed,
        ...(revokes ? { verificationFrom: "VERIFIED", verificationTo: "PENDING", reason: "phone_changed" } : {}),
      });
    })
    .catch(rethrowDuplicatePhone);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return toIsoDate(a) === toIsoDate(b);
  return (a ?? null) === (b ?? null);
}

// ─── Verification (W3) ───────────────────────────────────────────────────────

const VERIFICATION_AUDIT = {
  verify: AUDIT_ACTIONS.donorVerified,
  reject: AUDIT_ACTIONS.donorRejected,
  reopen: AUDIT_ACTIONS.donorVerificationReopened,
  revoke: AUDIT_ACTIONS.donorVerificationRevoked,
} as const;

async function applyVerification(
  ctx: AuthContext,
  donorId: string,
  action: VerificationAction,
  details: { note?: string; rejectionReason?: RejectDonorInput["reason"] },
): Promise<void> {
  assertPermission(ctx, action === "verify" || action === "reject" ? "donor:verify" : "donor:verify_admin");

  await db.$transaction(async (tx) => {
    const donor = await loadDonorState(tx, ctx, donorId);
    const { to, decision } = transitionVerification(donor.verificationStatus, action, ctx.role);
    // A decision on the record also completes any pending review of it.
    await guardedDonorUpdate(tx, ctx, donorId, { verificationStatus: donor.verificationStatus }, {
      verificationStatus: to,
      needsReview: false,
    });
    await tx.donorVerification.create({
      data: {
        hospitalId: ctx.hospitalId,
        donorId,
        decision,
        rejectionReason: details.rejectionReason ?? null,
        note: details.note ?? "",
        decidedById: ctx.userId,
      },
    });
    await auditDonor(tx, ctx, VERIFICATION_AUDIT[action], donorId, {
      from: donor.verificationStatus,
      to,
      ...(details.rejectionReason ? { rejectionReason: details.rejectionReason } : {}),
    });
  });
}

export function verifyDonor(ctx: AuthContext, input: VerifyDonorInput): Promise<void> {
  return applyVerification(ctx, input.donorId, "verify", { note: input.note });
}

export function rejectDonor(ctx: AuthContext, input: RejectDonorInput): Promise<void> {
  return applyVerification(ctx, input.donorId, "reject", { note: input.note, rejectionReason: input.reason });
}

export function reopenDonor(ctx: AuthContext, input: AdminVerificationInput): Promise<void> {
  return applyVerification(ctx, input.donorId, "reopen", { note: input.note });
}

export function revokeVerification(ctx: AuthContext, input: AdminVerificationInput): Promise<void> {
  return applyVerification(ctx, input.donorId, "revoke", { note: input.note });
}

/** Clears the "needs review" flag set by a repeated public registration. */
export async function clearReview(ctx: AuthContext, input: DonorIdInput): Promise<void> {
  assertPermission(ctx, "donor:verify");
  await db.$transaction(async (tx) => {
    const donor = await loadDonorState(tx, ctx, input.donorId);
    if (!donor.needsReview) throw new DomainError("INVALID_TRANSITION", "donor is not flagged for review");
    await guardedDonorUpdate(tx, ctx, donor.id, { needsReview: true }, { needsReview: false });
    await auditDonor(tx, ctx, AUDIT_ACTIONS.donorReviewCleared, donor.id);
  });
}

// ─── Eligibility (W4) ────────────────────────────────────────────────────────

export async function recordEligibility(ctx: AuthContext, input: RecordEligibilityInput): Promise<void> {
  assertPermission(ctx, "donor:set_eligibility");
  await setEligibility(ctx, input.donorId, input.status, input.until ?? null, input.note ?? "");
}

/** ADMIN correction of a permanent deferral back to UNASSESSED. */
export async function correctEligibility(ctx: AuthContext, input: CorrectEligibilityInput): Promise<void> {
  assertPermission(ctx, "donor:eligibility_correct");
  await setEligibility(ctx, input.donorId, "UNASSESSED", null, input.note);
}

async function setEligibility(
  ctx: AuthContext,
  donorId: string,
  target: RecordEligibilityInput["status"] | "UNASSESSED",
  until: string | null,
  note: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const donor = await loadDonorState(tx, ctx, donorId);
    const to = transitionEligibility(donor.eligibilityStatus, target, ctx.role);
    await guardedDonorUpdate(tx, ctx, donorId, { eligibilityStatus: donor.eligibilityStatus }, {
      eligibilityStatus: to,
      ineligibleUntil: until ? fromIsoDate(until) : null,
    });
    // rulesetVersion stays null: no approved ruleset produced this assessment (spec §8).
    await tx.eligibilityRecord.create({
      data: {
        hospitalId: ctx.hospitalId,
        donorId,
        status: to,
        until: until ? fromIsoDate(until) : null,
        note,
        recordedById: ctx.userId,
      },
    });
    await auditDonor(tx, ctx, AUDIT_ACTIONS.donorEligibilityChanged, donorId, {
      from: donor.eligibilityStatus,
      to,
    });
  });
}

// ─── Availability and activity ───────────────────────────────────────────────

export async function setAvailability(ctx: AuthContext, input: SetAvailabilityInput): Promise<void> {
  assertPermission(ctx, "donor:update");
  await db.$transaction(async (tx) => {
    const donor = await loadDonorState(tx, ctx, input.donorId);
    await guardedDonorUpdate(tx, ctx, donor.id, { availability: donor.availability }, {
      availability: input.availability,
      unavailableUntil: input.unavailableUntil ? fromIsoDate(input.unavailableUntil) : null,
    });
    await auditDonor(tx, ctx, AUDIT_ACTIONS.donorAvailabilityChanged, donor.id, {
      from: donor.availability,
      to: input.availability,
    });
  });
}

export async function deactivateDonor(ctx: AuthContext, input: DeactivateDonorInput): Promise<void> {
  assertPermission(ctx, "donor:update");
  await db.$transaction(async (tx) => {
    const donor = await loadDonorState(tx, ctx, input.donorId);
    assertCanDeactivate(donor.activityStatus, ctx.role);
    await guardedDonorUpdate(tx, ctx, donor.id, { activityStatus: "ACTIVE" }, {
      activityStatus: "INACTIVE",
      inactiveReason: input.reason,
    });
    await auditDonor(tx, ctx, AUDIT_ACTIONS.donorActivityChanged, donor.id, {
      from: "ACTIVE",
      to: "INACTIVE",
      reason: input.reason,
    });
  });
}

export async function reactivateDonor(ctx: AuthContext, input: DonorIdInput): Promise<void> {
  assertPermission(ctx, "donor:update");
  await db.$transaction(async (tx) => {
    const donor = await loadDonorState(tx, ctx, input.donorId);
    const consents = await tx.consentRecord.findMany({
      where: { donorId: donor.id, hospitalId: ctx.hospitalId, withdrawnAt: null },
      select: { purpose: true },
    });
    assertCanReactivate(
      donor.activityStatus,
      consents.map((c) => c.purpose),
      ctx.role,
    );
    await guardedDonorUpdate(tx, ctx, donor.id, { activityStatus: "INACTIVE" }, {
      activityStatus: "ACTIVE",
      inactiveReason: null,
    });
    await auditDonor(tx, ctx, AUDIT_ACTIONS.donorActivityChanged, donor.id, { from: "INACTIVE", to: "ACTIVE" });
  });
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function addNote(ctx: AuthContext, input: AddNoteInput): Promise<void> {
  assertPermission(ctx, "donor:note");
  await db.$transaction(async (tx) => {
    const donor = await loadDonorState(tx, ctx, input.donorId);
    const note = await tx.donorNote.create({
      data: { hospitalId: ctx.hospitalId, donorId: donor.id, authorId: ctx.userId, body: input.body },
      select: { id: true },
    });
    await auditDonor(tx, ctx, AUDIT_ACTIONS.donorNoteAdded, donor.id, { noteId: note.id });
  });
}

// ─── Consent (W9 withdrawal, re-grant) ───────────────────────────────────────

/**
 * Records a consent withdrawal and immediately makes the donor INACTIVE
 * (reason CONSENT_WITHDRAWN), which excludes them from matching (spec W9, A12).
 */
export async function withdrawConsent(ctx: AuthContext, input: ConsentPurposeInput): Promise<void> {
  assertPermission(ctx, "consent:withdraw");
  await db.$transaction(async (tx) => {
    const donor = await loadDonorState(tx, ctx, input.donorId);
    const consent = await tx.consentRecord.findFirst({
      where: { donorId: donor.id, hospitalId: ctx.hospitalId, purpose: input.purpose, withdrawnAt: null },
      select: { id: true },
    });
    if (!consent) throw new DomainError("INVALID_TRANSITION", "no active consent for this purpose");

    await tx.consentRecord.update({
      where: { id: consent.id },
      data: { withdrawnAt: new Date(), withdrawnById: ctx.userId },
    });
    await auditDonor(tx, ctx, AUDIT_ACTIONS.consentWithdrawn, donor.id, {
      consentId: consent.id,
      purpose: input.purpose,
    });

    if (donor.activityStatus === "INACTIVE" && donor.inactiveReason === "CONSENT_WITHDRAWN") return;
    await guardedDonorUpdate(tx, ctx, donor.id, { activityStatus: donor.activityStatus }, {
      activityStatus: "INACTIVE",
      inactiveReason: "CONSENT_WITHDRAWN",
    });
    await auditDonor(tx, ctx, AUDIT_ACTIONS.donorActivityChanged, donor.id, {
      from: donor.activityStatus,
      to: "INACTIVE",
      reason: "CONSENT_WITHDRAWN",
    });
  });
}

/** Records a consent the donor has given again (staff entry, current notice version). */
export async function grantConsent(ctx: AuthContext, input: ConsentPurposeInput): Promise<void> {
  assertPermission(ctx, "donor:update");
  const evidence = currentNoticeEvidence();
  await db
    .$transaction(async (tx) => {
      const donor = await loadDonorState(tx, ctx, input.donorId);
      await grantConsents(tx, {
        hospitalId: ctx.hospitalId,
        donorId: donor.id,
        purposes: [input.purpose],
        evidence,
        actorUserId: ctx.userId,
      });
    })
    .catch((error: unknown) => {
      // The partial unique index allows one active consent per purpose.
      if (isUniqueViolation(error)) throw new DomainError("INVALID_TRANSITION", "consent already active");
      throw error;
    });
}

// ─── Contact reveal (audited read) ───────────────────────────────────────────

export async function revealContact(ctx: AuthContext, input: DonorIdInput): Promise<{ phone: string }> {
  assertPermission(ctx, "donor:read_contact");
  return db.$transaction(async (tx) => {
    const donor = await loadDonorState(tx, ctx, input.donorId);
    await auditDonor(tx, ctx, AUDIT_ACTIONS.donorContactRevealed, donor.id);
    return { phone: formatPhone(donor.phoneE164) };
  });
}
