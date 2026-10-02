import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { recordAudit } from "@/server/services/audit";
import type { NoticeEvidence } from "@/server/services/privacy-notice";
import type { AuthContext } from "@/server/auth/session-verifier";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditAction } from "@/domain/audit/actions";
import type { AuditMetadata } from "@/domain/audit/metadata";
import { DomainError } from "@/domain/errors";
import type { ConsentPurpose } from "@/domain/donor/enums";

export type Tx = Prisma.TransactionClient;

/** Returns the area id if it is an active area of this hospital; otherwise null ("not listed"). */
export async function activeAreaId(tx: Tx, hospitalId: string, areaId: string | undefined): Promise<string | null> {
  if (!areaId) return null;
  const area = await tx.area.findFirst({ where: { id: areaId, hospitalId, active: true }, select: { id: true } });
  return area?.id ?? null;
}

/** Audit entry for a staff action on a donor. */
export function auditDonor(
  tx: Tx,
  ctx: AuthContext,
  action: AuditAction,
  donorId: string,
  metadata?: AuditMetadata,
): Promise<void> {
  return recordAudit(tx, {
    hospitalId: ctx.hospitalId,
    actorType: "STAFF",
    actorUserId: ctx.userId,
    action,
    entityType: AUDIT_ENTITY_TYPES.donor,
    entityId: donorId,
    metadata,
  });
}

/** Creates consent rows and one consent.granted audit entry each. `actor` null = public form. */
export async function grantConsents(
  tx: Tx,
  args: {
    hospitalId: string;
    donorId: string;
    purposes: readonly ConsentPurpose[];
    evidence: NoticeEvidence;
    actorUserId: string | null;
  },
): Promise<void> {
  for (const purpose of args.purposes) {
    const consent = await tx.consentRecord.create({
      data: {
        hospitalId: args.hospitalId,
        donorId: args.donorId,
        purpose,
        noticeVersion: args.evidence.noticeVersion,
        noticeSha256: args.evidence.noticeSha256,
        channel: args.actorUserId ? "STAFF_ENTRY" : "PUBLIC_FORM",
        capturedById: args.actorUserId,
      },
      select: { id: true },
    });
    const common = {
      hospitalId: args.hospitalId,
      action: AUDIT_ACTIONS.consentGranted,
      entityType: AUDIT_ENTITY_TYPES.donor,
      entityId: args.donorId,
      metadata: { consentId: consent.id, purpose, noticeVersion: args.evidence.noticeVersion },
    };
    await recordAudit(
      tx,
      args.actorUserId ? { ...common, actorType: "STAFF", actorUserId: args.actorUserId } : { ...common, actorType: "PUBLIC" },
    );
  }
}

const donorStateSelect = {
  id: true,
  phoneE164: true,
  verificationStatus: true,
  eligibilityStatus: true,
  activityStatus: true,
  inactiveReason: true,
  availability: true,
  needsReview: true,
} as const;

export type DonorState = Prisma.DonorGetPayload<{ select: typeof donorStateSelect }>;

/**
 * Loads a donor's current state, scoped to the caller's hospital (blocks IDOR,
 * spec §7). Anonymised donors are treated as not found.
 */
export async function loadDonorState(tx: Tx, ctx: AuthContext, donorId: string): Promise<DonorState> {
  const donor = await tx.donor.findFirst({
    where: { id: donorId, hospitalId: ctx.hospitalId, anonymisedAt: null },
    select: donorStateSelect,
  });
  if (!donor) throw new DomainError("NOT_FOUND");
  return donor;
}

/**
 * Guarded update (spec §6): applies only if the donor still has the expected
 * values, so a concurrent change surfaces as CONFLICT instead of being overwritten.
 */
export async function guardedDonorUpdate(
  tx: Tx,
  ctx: AuthContext,
  donorId: string,
  expected: Prisma.DonorWhereInput,
  data: Prisma.DonorUpdateManyMutationInput,
): Promise<void> {
  const { count } = await tx.donor.updateMany({
    where: { ...expected, id: donorId, hospitalId: ctx.hospitalId, anonymisedAt: null },
    data,
  });
  if (count !== 1) throw new DomainError("CONFLICT");
}
