"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { runAction } from "@/server/actions/run-action";
import * as donors from "@/server/services/donors";
import { searchDonors, type DonorRow } from "@/server/queries/donors";
import {
  addNoteSchema,
  adminVerificationSchema,
  consentPurposeSchema,
  correctEligibilitySchema,
  deactivateDonorSchema,
  donorIdSchema,
  donorSearchSchema,
  recordEligibilitySchema,
  rejectDonorSchema,
  setAvailabilitySchema,
  staffCreateDonorSchema,
  updateDonorSchema,
  verifyDonorSchema,
} from "@/domain/donor/schemas";
import { formDataToObject } from "@/lib/form-data";
import { hospitalToday } from "@/lib/today";
import type { ActionResult } from "@/lib/action-result";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";

/**
 * Thin Server Actions (spec §8): runAction → requirePermission → Zod → service.
 * Form actions follow the useActionState signature (previous state, FormData).
 */

export type FormState = (ActionResult<unknown> & { values?: Record<string, string> }) | null;

/** Language of the current UI, i.e. of the notice staff read to the donor. */
async function uiLocale(): Promise<Locale> {
  const locale = await getLocale();
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

function refreshDonor(donorId: string): void {
  revalidatePath("/donors", "layout");
  revalidatePath(`/donors/${donorId}`);
}

// ─── Create and edit ─────────────────────────────────────────────────────────

export async function createDonorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const locale = await uiLocale();
  const result = await runAction(
    {
      permission: "donor:create",
      schema: staffCreateDonorSchema(hospitalToday()),
      handler: (ctx, input) => donors.createDonor(ctx, input, locale),
    },
    raw,
  );
  if (!result.ok) return { ...result, values: raw };
  refreshDonor(result.data.donorId);
  redirect(`/donors/${result.data.donorId}`);
}

export async function updateDonorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const result = await runAction(
    { permission: "donor:update", schema: updateDonorSchema(hospitalToday()), handler: donors.updateDonor },
    raw,
  );
  if (!result.ok) return { ...result, values: raw };
  refreshDonor(raw.donorId ?? "");
  redirect(`/donors/${raw.donorId}`);
}

// ─── Small state-changing forms on the profile and review queue ──────────────

async function donorFormAction(formData: FormData, run: (raw: Record<string, string>) => Promise<ActionResult<unknown>>) {
  const raw = formDataToObject(formData);
  const result = await run(raw);
  if (result.ok && raw.donorId) refreshDonor(raw.donorId);
  return result;
}

export async function verifyDonorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction({ permission: "donor:verify", schema: verifyDonorSchema, handler: donors.verifyDonor }, raw),
  );
}

export async function rejectDonorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction({ permission: "donor:verify", schema: rejectDonorSchema, handler: donors.rejectDonor }, raw),
  );
}

export async function reopenDonorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction({ permission: "donor:verify_admin", schema: adminVerificationSchema, handler: donors.reopenDonor }, raw),
  );
}

export async function revokeVerificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction(
      { permission: "donor:verify_admin", schema: adminVerificationSchema, handler: donors.revokeVerification },
      raw,
    ),
  );
}

export async function clearReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction({ permission: "donor:verify", schema: donorIdSchema, handler: donors.clearReview }, raw),
  );
}

export async function recordEligibilityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction(
      {
        permission: "donor:set_eligibility",
        schema: recordEligibilitySchema(hospitalToday()),
        handler: donors.recordEligibility,
      },
      raw,
    ),
  );
}

export async function correctEligibilityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction(
      { permission: "donor:eligibility_correct", schema: correctEligibilitySchema, handler: donors.correctEligibility },
      raw,
    ),
  );
}

export async function setAvailabilityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction(
      { permission: "donor:update", schema: setAvailabilitySchema(hospitalToday()), handler: donors.setAvailability },
      raw,
    ),
  );
}

export async function deactivateDonorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction({ permission: "donor:update", schema: deactivateDonorSchema, handler: donors.deactivateDonor }, raw),
  );
}

export async function reactivateDonorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction({ permission: "donor:update", schema: donorIdSchema, handler: donors.reactivateDonor }, raw),
  );
}

export async function addNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction({ permission: "donor:note", schema: addNoteSchema, handler: donors.addNote }, raw),
  );
}

export async function withdrawConsentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return donorFormAction(formData, (raw) =>
    runAction({ permission: "consent:withdraw", schema: consentPurposeSchema, handler: donors.withdrawConsent }, raw),
  );
}

export async function grantConsentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await uiLocale();
  return donorFormAction(formData, (raw) =>
    runAction(
      {
        permission: "donor:update",
        schema: consentPurposeSchema,
        handler: (ctx, input) => donors.grantConsent(ctx, input, locale),
      },
      raw,
    ),
  );
}

// ─── Called directly from client components ──────────────────────────────────

/** Audited reveal of a donor's full mobile number. */
export async function revealContactAction(donorId: string): Promise<ActionResult<{ phone: string }>> {
  return runAction(
    { permission: "donor:read_contact", schema: donorIdSchema, handler: donors.revealContact },
    { donorId },
  );
}

/** Free-text search. A Server Action (POST) so names and numbers stay out of URLs. */
export async function searchDonorsAction(input: unknown): Promise<ActionResult<DonorRow[]>> {
  return runAction(
    {
      permission: "donor:read",
      schema: donorSearchSchema,
      handler: (ctx, { query, filters }) => searchDonors(ctx, query, filters, hospitalToday()),
    },
    input,
  );
}
