"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createDonorAction, updateDonorAction, type FormState } from "@/features/donors/actions";
import { DonorFields, type AreaOption } from "@/features/donors/components/donor-fields";
import { FormAlert, SubmitButton, fieldErrorsOf, useFieldError } from "@/components/shared/form-kit";

type Props =
  | { mode: "create"; areas: readonly AreaOption[] }
  | { mode: "edit"; areas: readonly AreaOption[]; donorId: string; defaults: Record<string, string> };

/** Staff entry (W2) and edit. Consent capture only on create; re-grants happen on the profile. */
export function DonorForm(props: Props) {
  const t = useTranslations("donors");
  const tCommon = useTranslations("common");
  const fieldError = useFieldError();
  const [state, formAction] = useActionState<FormState, FormData>(
    props.mode === "create" ? createDonorAction : updateDonorAction,
    null,
  );
  const consentError = fieldErrorsOf(state, "consentRegistry")?.[0];

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5" noValidate>
      {props.mode === "edit" ? <input type="hidden" name="donorId" value={props.donorId} /> : null}
      <DonorFields state={state} areas={props.areas} defaults={props.mode === "edit" ? props.defaults : undefined} />

      {props.mode === "edit" ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("phoneChangeWarning")}
        </p>
      ) : (
        <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
          <legend className="px-1 text-sm font-semibold">{t("consent.title")}</legend>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="consentRegistry"
              defaultChecked={state?.values?.consentRegistry === "on"}
              aria-invalid={Boolean(consentError)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>{t("staffConsentRegistry")}</span>
          </label>
          {consentError ? <p className="text-sm text-destructive">{fieldError(consentError)}</p> : null}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="consentContact"
              defaultChecked={state?.values?.consentContact === "on"}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>{t("staffConsentContact")}</span>
          </label>
          <label className="flex items-start gap-3 border-t pt-3 text-sm">
            <input
              type="checkbox"
              name="verifyNow"
              defaultChecked={state?.values?.verifyNow === "on"}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>{t("verifyNow")}</span>
          </label>
        </fieldset>
      )}

      {/* On create, CONFLICT can only mean a duplicate phone; on edit it may be a concurrent change. */}
      <FormAlert state={state} messages={{ CONFLICT: props.mode === "create" ? t("duplicatePhone") : t("editConflict") }} />
      <SubmitButton className="self-start" pendingLabel={tCommon("saving")}>
        {tCommon("save")}
      </SubmitButton>
    </form>
  );
}
