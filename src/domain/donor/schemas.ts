import * as z from "zod";
import { BLOOD_GROUPS } from "@/domain/blood-group";
import { ageOn, ISO_MONTH, isValidIsoDate } from "@/domain/dates";
import { normalizeEgyptianMobile } from "@/domain/phone";
import {
  AVAILABILITIES,
  ACTIVITY_STATUSES,
  CONSENT_PURPOSES,
  CONTACT_METHODS,
  DONATED_BEFORE,
  ELIGIBILITY_STATUSES,
  MANUAL_INACTIVE_REASONS,
  REJECTION_REASONS,
  VERIFICATION_STATUSES,
  type DonatedBefore,
} from "@/domain/donor/enums";

/**
 * Donor schemas, shared by the public form, staff forms and the server (spec §8).
 * Inputs arrive as FormData strings. Error messages are message keys under
 * `fieldErrors.*` in messages/en.json, never user-facing text.
 * Factories take `today` (ISO, hospital time zone) so date rules are deterministic.
 */

// Assumption A6: Law 8/2021 bars donation by children, so registrants must be adults.
// The actual donor age range is Medical Rule Required M3 and is NOT enforced here.
export const MIN_REGISTRATION_AGE_YEARS = 18;
// Sanity bound against typos (e.g. 1826), not a medical upper age limit.
const MAX_PLAUSIBLE_AGE_YEARS = 120;

export const NAME_MAX = 120;
export const CITY_MAX = 80;
export const NOTE_MAX = 2000;

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(emptyToUndefined, schema.optional());
}

/** HTML checkbox: "on" when ticked, absent when not. */
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

const uuid = z.uuid({ error: "invalid" });

const phone = z.string({ error: "required" }).transform((value, ctx) => {
  const normalized = normalizeEgyptianMobile(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "invalidPhone" });
    return z.NEVER;
  }
  return normalized;
});

function dateOfBirth(today: string) {
  return z
    .string({ error: "required" })
    .refine(isValidIsoDate, { error: "invalidDate", abort: true })
    .refine((v) => v <= today && ageOn(v, today) <= MAX_PLAUSIBLE_AGE_YEARS, { error: "invalidDate", abort: true })
    .refine((v) => ageOn(v, today) >= MIN_REGISTRATION_AGE_YEARS, { error: "underAge" });
}

function pastMonth(today: string) {
  return z
    .string()
    .regex(ISO_MONTH, { error: "invalidDate", abort: true })
    .refine((v) => v <= today.slice(0, 7), { error: "dateInFuture" });
}

function futureDate(today: string) {
  return z
    .string()
    .refine(isValidIsoDate, { error: "invalidDate", abort: true })
    .refine((v) => v > today, { error: "dateNotInFuture" });
}

const fullName = z
  .string({ error: "required" })
  .trim()
  .min(2, { error: "required" })
  .max(NAME_MAX, { error: "tooLong" });

const noteText = z.string().trim().max(NOTE_MAX, { error: "tooLong" });

/** Fields shared by public registration, staff entry and staff edit. */
function donorFields(today: string) {
  return {
    fullName,
    phone,
    dateOfBirth: dateOfBirth(today),
    bloodGroup: z
      .enum([...BLOOD_GROUPS, "UNKNOWN"], { error: "required" })
      .transform((v) => (v === "UNKNOWN" ? null : v)),
    city: z.string({ error: "required" }).trim().min(1, { error: "required" }).max(CITY_MAX, { error: "tooLong" }),
    areaId: optional(uuid),
    donatedBefore: z.enum(DONATED_BEFORE, { error: "required" }),
    lastDonationMonth: optional(pastMonth(today)),
    preferredContact: z.enum(CONTACT_METHODS, { error: "required" }),
  };
}

/** The self-reported last donation month only means something when the donor said YES. */
export function lastDonationMonthFor(donatedBefore: DonatedBefore, month: string | undefined): string | null {
  return donatedBefore === "YES" && month ? month : null;
}

// ─── Public registration (W1) ────────────────────────────────────────────────

export function registrationSchema(today: string) {
  return z.object({
    ...donorFields(today),
    // Two separate, unticked consents (spec D13). Registry consent is required to
    // store the record; contact consent is optional and gates matching (spec §8).
    consentRegistry: checkbox.refine((v) => v, { error: "consentRequired" }),
    consentContact: checkbox,
  });
}
export type RegistrationInput = z.infer<ReturnType<typeof registrationSchema>>;

/** Honeypot field name. Real users never see or fill it. */
export const HONEYPOT_FIELD = "website";

// ─── Staff entry and edit (W2) ───────────────────────────────────────────────

export function staffCreateDonorSchema(today: string) {
  return z.object({
    ...donorFields(today),
    consentRegistry: checkbox.refine((v) => v, { error: "consentRequired" }),
    consentContact: checkbox,
    // "Verify now" runs W3 as a second, separately audited step.
    verifyNow: checkbox,
  });
}
export type StaffCreateDonorInput = z.infer<ReturnType<typeof staffCreateDonorSchema>>;

export function updateDonorSchema(today: string) {
  return z.object({ donorId: uuid, ...donorFields(today) });
}
export type UpdateDonorInput = z.infer<ReturnType<typeof updateDonorSchema>>;

// ─── Verification (W3) ───────────────────────────────────────────────────────

export const verifyDonorSchema = z.object({ donorId: uuid, note: optional(noteText) });
export type VerifyDonorInput = z.infer<typeof verifyDonorSchema>;

export const rejectDonorSchema = z.object({
  donorId: uuid,
  reason: z.enum(REJECTION_REASONS, { error: "required" }),
  note: optional(noteText),
});
export type RejectDonorInput = z.infer<typeof rejectDonorSchema>;

/** Revoke and reopen are ADMIN corrections and always need a reason. */
export const adminVerificationSchema = z.object({
  donorId: uuid,
  note: z.string({ error: "required" }).trim().min(1, { error: "required" }).max(NOTE_MAX, { error: "tooLong" }),
});
export type AdminVerificationInput = z.infer<typeof adminVerificationSchema>;

export const donorIdSchema = z.object({ donorId: uuid });
export type DonorIdInput = z.infer<typeof donorIdSchema>;

// ─── Eligibility (W4) ────────────────────────────────────────────────────────

/**
 * Medical Rule Required M7: deferral reason categories are not approved yet, so a
 * deferral is explained by a staff note instead of a category.
 */
export function recordEligibilitySchema(today: string) {
  return z
    .object({
      donorId: uuid,
      status: z.enum(["ELIGIBLE", "TEMPORARILY_INELIGIBLE", "PERMANENTLY_INELIGIBLE"], { error: "required" }),
      until: optional(futureDate(today)),
      note: optional(noteText),
    })
    .superRefine((value, ctx) => {
      if (value.status === "TEMPORARILY_INELIGIBLE" && !value.until) {
        ctx.addIssue({ code: "custom", path: ["until"], message: "required" });
      }
      if (value.status !== "ELIGIBLE" && !value.note) {
        ctx.addIssue({ code: "custom", path: ["note"], message: "required" });
      }
    })
    .transform((value) => ({ ...value, until: value.status === "TEMPORARILY_INELIGIBLE" ? value.until : undefined }));
}
export type RecordEligibilityInput = z.infer<ReturnType<typeof recordEligibilitySchema>>;

/** ADMIN correction: PERMANENTLY_INELIGIBLE → UNASSESSED, reason required. */
export const correctEligibilitySchema = adminVerificationSchema;
export type CorrectEligibilityInput = AdminVerificationInput;

// ─── Availability and activity ───────────────────────────────────────────────

export function setAvailabilitySchema(today: string) {
  return z
    .object({
      donorId: uuid,
      availability: z.enum(AVAILABILITIES, { error: "required" }),
      unavailableUntil: optional(futureDate(today)),
    })
    .transform((value) => ({
      ...value,
      unavailableUntil: value.availability === "UNAVAILABLE" ? value.unavailableUntil : undefined,
    }));
}
export type SetAvailabilityInput = z.infer<ReturnType<typeof setAvailabilitySchema>>;

export const deactivateDonorSchema = z.object({
  donorId: uuid,
  reason: z.enum(MANUAL_INACTIVE_REASONS, { error: "required" }),
});
export type DeactivateDonorInput = z.infer<typeof deactivateDonorSchema>;

// ─── Notes and consent ───────────────────────────────────────────────────────

export const addNoteSchema = z.object({
  donorId: uuid,
  body: z.string({ error: "required" }).trim().min(1, { error: "required" }).max(NOTE_MAX, { error: "tooLong" }),
});
export type AddNoteInput = z.infer<typeof addNoteSchema>;

export const consentPurposeSchema = z.object({
  donorId: uuid,
  purpose: z.enum(CONSENT_PURPOSES, { error: "required" }),
});
export type ConsentPurposeInput = z.infer<typeof consentPurposeSchema>;

// ─── List filters and search ─────────────────────────────────────────────────

export const DONOR_PAGE_SIZE = 25;

const filterValue = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().catch(undefined);

/**
 * Structured filters live in the URL (spec §10). Free-text search does NOT: names
 * and phone numbers must not end up in URLs, history or server logs.
 * Invalid values are dropped rather than rejected, so a stale link still renders.
 */
export const donorFiltersSchema = z.object({
  bloodGroup: filterValue(BLOOD_GROUPS),
  verification: filterValue(VERIFICATION_STATUSES),
  eligibility: filterValue(ELIGIBILITY_STATUSES),
  activity: filterValue(ACTIVITY_STATUSES),
  availability: filterValue(AVAILABILITIES),
  areaId: z.uuid().optional().catch(undefined),
  needsReview: z.literal("1").optional().catch(undefined),
  reassessmentDue: z.literal("1").optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});
export type DonorFilters = z.infer<typeof donorFiltersSchema>;

export const donorSearchSchema = z.object({
  query: z.string().trim().min(2, { error: "searchTooShort" }).max(NAME_MAX, { error: "tooLong" }),
  filters: donorFiltersSchema,
});
export type DonorSearchInput = z.infer<typeof donorSearchSchema>;
