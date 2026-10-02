import "server-only";
import { db } from "@/server/db";
import { recordAudit } from "@/server/services/audit";
import { activeAreaId, grantConsents, type Tx } from "@/server/services/donor-shared";
import { currentNoticeEvidence, type NoticeEvidence } from "@/server/services/privacy-notice";
import type { PublicContext } from "@/server/public-context";
import { isUniqueViolation } from "@/server/prisma-errors";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/domain/audit/actions";
import { fromIsoDate, monthToFirstDay } from "@/domain/dates";
import { lastDonationMonthFor, type RegistrationInput } from "@/domain/donor/schemas";
import type { ConsentPurpose } from "@/domain/donor/enums";

/**
 * Technical Decision: at most 5 accepted submissions per client IP hash per hour.
 * Generous enough for a family registering together on one phone, tight enough
 * to stop scripted flooding. Rows older than the window are deleted as we go.
 */
export const REGISTRATION_THROTTLE = { maxAttempts: 5, windowMs: 60 * 60 * 1000 } as const;

export type RegistrationOutcome = "accepted" | "throttled";

/**
 * Public registration (W1). The caller sees the same "accepted" outcome whether a
 * new donor was created or an existing one was flagged for review, so the form
 * never reveals who is registered.
 */
export async function registerPublicDonor(
  pctx: PublicContext,
  input: RegistrationInput,
  now: Date = new Date(),
): Promise<RegistrationOutcome> {
  const evidence = currentNoticeEvidence(pctx.locale);

  if (await isThrottled(pctx, now)) return "throttled";

  try {
    await db.$transaction((tx) => createOrFlagDonor(tx, pctx.hospitalId, input, evidence));
  } catch (error) {
    // Two concurrent submissions with the same phone: the loser re-runs and takes the flag path.
    if (!isUniqueViolation(error)) throw error;
    await db.$transaction((tx) => createOrFlagDonor(tx, pctx.hospitalId, input, evidence));
  }
  return "accepted";
}

async function isThrottled(pctx: PublicContext, now: Date): Promise<boolean> {
  const windowStart = new Date(now.getTime() - REGISTRATION_THROTTLE.windowMs);
  return db.$transaction(async (tx) => {
    await tx.registrationAttempt.deleteMany({ where: { createdAt: { lt: windowStart } } });
    const recent = await tx.registrationAttempt.count({
      where: { hospitalId: pctx.hospitalId, ipHash: pctx.ipHash, createdAt: { gte: windowStart } },
    });
    if (recent >= REGISTRATION_THROTTLE.maxAttempts) return true;
    await tx.registrationAttempt.create({ data: { hospitalId: pctx.hospitalId, ipHash: pctx.ipHash, createdAt: now } });
    return false;
  });
}

async function createOrFlagDonor(
  tx: Tx,
  hospitalId: string,
  input: RegistrationInput,
  evidence: NoticeEvidence,
): Promise<void> {
  const existing = await tx.donor.findUnique({
    where: { hospitalId_phoneE164: { hospitalId, phoneE164: input.phone } },
    select: { id: true },
  });

  if (existing) {
    // Submitted details are discarded; staff review the existing record (spec W1).
    await tx.donor.update({ where: { id: existing.id }, data: { needsReview: true } });
    await recordAudit(tx, {
      hospitalId,
      actorType: "PUBLIC",
      action: AUDIT_ACTIONS.donorRegistrationResubmitted,
      entityType: AUDIT_ENTITY_TYPES.donor,
      entityId: existing.id,
    });
    return;
  }

  const areaId = await activeAreaId(tx, hospitalId, input.areaId);
  const lastMonth = lastDonationMonthFor(input.donatedBefore, input.lastDonationMonth);

  const donor = await tx.donor.create({
    data: {
      hospitalId,
      fullName: input.fullName,
      phoneE164: input.phone,
      dateOfBirth: fromIsoDate(input.dateOfBirth),
      city: input.city,
      areaId,
      preferredContact: input.preferredContact,
      selfReportedBloodGroup: input.bloodGroup,
      donatedBefore: input.donatedBefore,
      selfReportedLastDonationMonth: lastMonth ? fromIsoDate(monthToFirstDay(lastMonth)) : null,
      source: "PUBLIC_FORM",
      // verificationStatus PENDING, eligibilityStatus UNASSESSED, activityStatus ACTIVE by default.
    },
    select: { id: true },
  });

  const purposes: ConsentPurpose[] = input.consentContact ? ["REGISTRY", "CONTACT"] : ["REGISTRY"];
  await recordAudit(tx, {
    hospitalId,
    actorType: "PUBLIC",
    action: AUDIT_ACTIONS.donorRegistered,
    entityType: AUDIT_ENTITY_TYPES.donor,
    entityId: donor.id,
    metadata: { source: "PUBLIC_FORM", consentPurposes: purposes },
  });
  await grantConsents(tx, { hospitalId, donorId: donor.id, purposes, evidence, actorUserId: null });
}
