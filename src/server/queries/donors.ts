import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { AuthContext } from "@/server/auth/session-verifier";
import { auditDonor } from "@/server/services/donor-shared";
import { AUDIT_ACTIONS } from "@/domain/audit/actions";
import { assertPermission, roleHasPermission } from "@/domain/auth/permissions";
import { displayBloodGroup, type BloodGroup, type BloodGroupBasis } from "@/domain/blood-group";
import { fromIsoDate, toIsoDate } from "@/domain/dates";
import { DomainError } from "@/domain/errors";
import { maskPhone, normalizeEgyptianMobile } from "@/domain/phone";
import { isReassessmentDue } from "@/domain/donor/transitions";
import { DONOR_PAGE_SIZE, type DonorFilters } from "@/domain/donor/schemas";
import type {
  ActivityStatus,
  Availability,
  ConsentPurpose,
  EligibilityStatus,
  InactiveReason,
  RejectionReason,
  VerificationDecision,
  VerificationStatus,
} from "@/domain/donor/enums";

/**
 * Hospital-scoped donor reads returning minimal DTOs (spec §8). Phone numbers are
 * always masked here; the full number is only returned by the audited reveal.
 */

export type DonorRow = {
  id: string;
  fullName: string;
  maskedPhone: string;
  bloodGroup: { group: BloodGroup; basis: BloodGroupBasis } | null;
  verificationStatus: VerificationStatus;
  eligibilityStatus: EligibilityStatus;
  activityStatus: ActivityStatus;
  availability: Availability;
  needsReview: boolean;
  reassessmentDue: boolean;
  areaName: string | null;
  createdAt: string;
};

export type DonorPage = { rows: DonorRow[]; total: number; page: number; pages: number };

const rowSelect = {
  id: true,
  fullName: true,
  phoneE164: true,
  verifiedBloodGroup: true,
  selfReportedBloodGroup: true,
  verificationStatus: true,
  eligibilityStatus: true,
  ineligibleUntil: true,
  activityStatus: true,
  availability: true,
  needsReview: true,
  createdAt: true,
  area: { select: { name: true } },
} as const satisfies Prisma.DonorSelect;

function toRow(d: Prisma.DonorGetPayload<{ select: typeof rowSelect }>, today: string): DonorRow {
  return {
    id: d.id,
    fullName: d.fullName,
    maskedPhone: maskPhone(d.phoneE164),
    bloodGroup: displayBloodGroup(d),
    verificationStatus: d.verificationStatus,
    eligibilityStatus: d.eligibilityStatus,
    activityStatus: d.activityStatus,
    availability: d.availability,
    needsReview: d.needsReview,
    reassessmentDue: isReassessmentDue(
      d.eligibilityStatus,
      d.ineligibleUntil ? toIsoDate(d.ineligibleUntil) : null,
      today,
    ),
    areaName: d.area?.name ?? null,
    createdAt: d.createdAt.toISOString(),
  };
}

function filtersWhere(ctx: AuthContext, filters: DonorFilters, today: string): Prisma.DonorWhereInput {
  const and: Prisma.DonorWhereInput[] = [{ hospitalId: ctx.hospitalId, anonymisedAt: null }];
  // Blood-group filter matches the displayed group: verified if present, else self-reported.
  // This is a search, not a compatibility decision (spec §8).
  if (filters.bloodGroup) {
    and.push({
      OR: [
        { verifiedBloodGroup: filters.bloodGroup },
        { verifiedBloodGroup: null, selfReportedBloodGroup: filters.bloodGroup },
      ],
    });
  }
  if (filters.verification) and.push({ verificationStatus: filters.verification });
  if (filters.eligibility) and.push({ eligibilityStatus: filters.eligibility });
  if (filters.activity) and.push({ activityStatus: filters.activity });
  if (filters.availability) and.push({ availability: filters.availability });
  if (filters.areaId) and.push({ areaId: filters.areaId });
  if (filters.needsReview) and.push({ needsReview: true });
  if (filters.reassessmentDue) {
    and.push({ eligibilityStatus: "TEMPORARILY_INELIGIBLE", ineligibleUntil: { lte: fromIsoDate(today) } });
  }
  return { AND: and };
}

export async function listDonors(ctx: AuthContext, filters: DonorFilters, today: string): Promise<DonorPage> {
  assertPermission(ctx, "donor:read");
  const where = filtersWhere(ctx, filters, today);
  const total = await db.donor.count({ where });
  const pages = Math.max(1, Math.ceil(total / DONOR_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const rows = await db.donor.findMany({
    where,
    select: rowSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * DONOR_PAGE_SIZE,
    take: DONOR_PAGE_SIZE,
  });
  return { rows: rows.map((r) => toRow(r, today)), total, page, pages };
}

export const SEARCH_RESULT_LIMIT = 50;

/**
 * Free-text search by name or mobile number, combined with the URL filters.
 * Called through a Server Action so the query never appears in a URL.
 */
export async function searchDonors(
  ctx: AuthContext,
  query: string,
  filters: DonorFilters,
  today: string,
): Promise<DonorRow[]> {
  assertPermission(ctx, "donor:read");
  const where = filtersWhere(ctx, filters, today);
  const digits = query.replace(/\D/g, "");
  const looksLikePhone = digits.length >= 4 && !/\p{L}/u.test(query);

  let match: Prisma.DonorWhereInput;
  if (looksLikePhone) {
    const exact = normalizeEgyptianMobile(query);
    // Partial numbers match anywhere; a local leading 0 is dropped to match E.164.
    match = exact ? { phoneE164: exact } : { phoneE164: { contains: digits.replace(/^0/, "") } };
  } else {
    match = { fullName: { contains: query, mode: "insensitive" } };
  }

  const rows = await db.donor.findMany({
    where: { AND: [where, match] },
    select: rowSelect,
    orderBy: [{ fullName: "asc" }, { id: "asc" }],
    take: SEARCH_RESULT_LIMIT,
  });
  return rows.map((r) => toRow(r, today));
}

/** Pending Review queue (W3): PENDING donors and donors flagged needsReview, oldest first. */
export async function listPendingReview(ctx: AuthContext, today: string): Promise<DonorRow[]> {
  assertPermission(ctx, "donor:verify");
  const rows = await db.donor.findMany({
    where: {
      hospitalId: ctx.hospitalId,
      anonymisedAt: null,
      OR: [{ verificationStatus: "PENDING" }, { needsReview: true }],
    },
    select: rowSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
  });
  return rows.map((r) => toRow(r, today));
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export type DonorProfile = DonorRow & {
  dateOfBirth: string;
  city: string;
  areaId: string | null;
  preferredContact: "PHONE" | "WHATSAPP";
  selfReportedBloodGroup: BloodGroup | null;
  verifiedBloodGroup: BloodGroup | null;
  donatedBefore: "YES" | "NO" | "UNSURE";
  selfReportedLastDonationMonth: string | null;
  source: "PUBLIC_FORM" | "STAFF_ENTRY";
  ineligibleUntil: string | null;
  nextEligibleOn: string | null;
  inactiveReason: InactiveReason | null;
  unavailableUntil: string | null;
  consents: {
    id: string;
    purpose: ConsentPurpose;
    channel: "PUBLIC_FORM" | "STAFF_ENTRY";
    noticeVersion: string;
    grantedAt: string;
    withdrawnAt: string | null;
  }[];
  verifications: {
    id: string;
    decision: VerificationDecision;
    rejectionReason: RejectionReason | null;
    note: string;
    decidedBy: string;
    createdAt: string;
  }[];
  eligibilityHistory: {
    id: string;
    status: EligibilityStatus;
    until: string | null;
    note: string;
    recordedBy: string;
    createdAt: string;
  }[];
  /** Null when the viewer lacks donor:note (VIEWER), so the UI cannot render them. */
  notes: { id: string; body: string; author: string; createdAt: string }[] | null;
};

/** Loads a donor profile and records the read (donor.viewed) in the audit log. */
export async function getDonorProfile(ctx: AuthContext, donorId: string, today: string): Promise<DonorProfile> {
  assertPermission(ctx, "donor:read");
  const canReadNotes = roleHasPermission(ctx.role, "donor:note");

  return db.$transaction(async (tx) => {
    const d = await tx.donor.findFirst({
      where: { id: donorId, hospitalId: ctx.hospitalId, anonymisedAt: null },
      select: {
        ...rowSelect,
        dateOfBirth: true,
        city: true,
        areaId: true,
        preferredContact: true,
        donatedBefore: true,
        selfReportedLastDonationMonth: true,
        source: true,
        nextEligibleOn: true,
        inactiveReason: true,
        unavailableUntil: true,
        consents: {
          orderBy: [{ grantedAt: "desc" }],
          select: { id: true, purpose: true, channel: true, noticeVersion: true, grantedAt: true, withdrawnAt: true },
        },
        verifications: {
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            decision: true,
            rejectionReason: true,
            note: true,
            createdAt: true,
            decidedBy: { select: { name: true } },
          },
        },
        eligibility: {
          orderBy: [{ createdAt: "desc" }],
          select: { id: true, status: true, until: true, note: true, createdAt: true, recordedBy: { select: { name: true } } },
        },
      },
    });
    if (!d) throw new DomainError("NOT_FOUND");

    const notes = canReadNotes
      ? await tx.donorNote.findMany({
          where: { donorId: d.id, hospitalId: ctx.hospitalId },
          orderBy: [{ createdAt: "desc" }],
          select: { id: true, body: true, createdAt: true, author: { select: { name: true } } },
        })
      : null;

    await auditDonor(tx, ctx, AUDIT_ACTIONS.donorViewed, d.id);

    return {
      ...toRow(d, today),
      dateOfBirth: toIsoDate(d.dateOfBirth),
      city: d.city,
      areaId: d.areaId,
      preferredContact: d.preferredContact,
      selfReportedBloodGroup: d.selfReportedBloodGroup,
      verifiedBloodGroup: d.verifiedBloodGroup,
      donatedBefore: d.donatedBefore,
      selfReportedLastDonationMonth: d.selfReportedLastDonationMonth
        ? toIsoDate(d.selfReportedLastDonationMonth).slice(0, 7)
        : null,
      source: d.source,
      ineligibleUntil: d.ineligibleUntil ? toIsoDate(d.ineligibleUntil) : null,
      nextEligibleOn: d.nextEligibleOn ? toIsoDate(d.nextEligibleOn) : null,
      inactiveReason: d.inactiveReason,
      unavailableUntil: d.unavailableUntil ? toIsoDate(d.unavailableUntil) : null,
      consents: d.consents.map((c) => ({
        id: c.id,
        purpose: c.purpose,
        channel: c.channel,
        noticeVersion: c.noticeVersion,
        grantedAt: c.grantedAt.toISOString(),
        withdrawnAt: c.withdrawnAt?.toISOString() ?? null,
      })),
      verifications: d.verifications.map((v) => ({
        id: v.id,
        decision: v.decision,
        rejectionReason: v.rejectionReason,
        note: v.note,
        decidedBy: v.decidedBy.name,
        createdAt: v.createdAt.toISOString(),
      })),
      eligibilityHistory: d.eligibility.map((e) => ({
        id: e.id,
        status: e.status,
        until: e.until ? toIsoDate(e.until) : null,
        note: e.note,
        recordedBy: e.recordedBy.name,
        createdAt: e.createdAt.toISOString(),
      })),
      notes: notes
          ? notes.map((n) => ({ id: n.id, body: n.body, author: n.author.name, createdAt: n.createdAt.toISOString() }))
          : null,
    };
  });
}

export type DonorEditValues = {
  id: string;
  fullName: string;
  phone: string;
  dateOfBirth: string;
  bloodGroup: BloodGroup | "UNKNOWN";
  city: string;
  areaId: string;
  donatedBefore: "YES" | "NO" | "UNSURE";
  lastDonationMonth: string;
  preferredContact: "PHONE" | "WHATSAPP";
};

/**
 * Current values for the edit form. The form shows the full phone number, so
 * loading it is recorded as a contact reveal.
 */
export async function getDonorForEdit(ctx: AuthContext, donorId: string): Promise<DonorEditValues> {
  assertPermission(ctx, "donor:update");
  assertPermission(ctx, "donor:read_contact");
  return db.$transaction(async (tx) => {
    const d = await tx.donor.findFirst({
      where: { id: donorId, hospitalId: ctx.hospitalId, anonymisedAt: null },
      select: {
        id: true,
        fullName: true,
        phoneE164: true,
        dateOfBirth: true,
        selfReportedBloodGroup: true,
        city: true,
        areaId: true,
        donatedBefore: true,
        selfReportedLastDonationMonth: true,
        preferredContact: true,
      },
    });
    if (!d) throw new DomainError("NOT_FOUND");
    await auditDonor(tx, ctx, AUDIT_ACTIONS.donorContactRevealed, d.id, { context: "edit" });
    return {
      id: d.id,
      fullName: d.fullName,
      phone: d.phoneE164,
      dateOfBirth: toIsoDate(d.dateOfBirth),
      bloodGroup: d.selfReportedBloodGroup ?? "UNKNOWN",
      city: d.city,
      areaId: d.areaId ?? "",
      donatedBefore: d.donatedBefore,
      lastDonationMonth: d.selfReportedLastDonationMonth ? toIsoDate(d.selfReportedLastDonationMonth).slice(0, 7) : "",
      preferredContact: d.preferredContact,
    };
  });
}

// ─── Areas ───────────────────────────────────────────────────────────────────

export type AreaOption = { id: string; name: string; city: string };

export async function listActiveAreas(hospitalId: string): Promise<AreaOption[]> {
  return db.area.findMany({
    where: { hospitalId, active: true },
    select: { id: true, name: true, city: true },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });
}
