"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { registerAction, type RegistrationState } from "@/features/registration/actions";
import { DonorFields, type AreaOption } from "@/features/donors/components/donor-fields";
import { FormAlert, SubmitButton, fieldErrorsOf, useFieldError } from "@/components/shared/form-kit";
import { HONEYPOT_FIELD } from "@/domain/donor/schemas";

/**
 * Public form (W1). Progressive enhancement: a plain form posting to a Server
 * Action, so it works before JavaScript loads on weak phones (spec §8).
 */
export function RegistrationForm({ areas }: { areas: readonly AreaOption[] }) {
  const t = useTranslations("register");
  const tNotice = useTranslations("privacyNotice");
  const fieldError = useFieldError();
  const [state, formAction] = useActionState<RegistrationState, FormData>(registerAction, null);
  const consentError = fieldErrorsOf(state, "consentRegistry")?.[0];
  const throttled = state?.ok && state.data === "throttled";

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <DonorFields state={state} areas={areas} />

      <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">{t("consentHeading")}</legend>
        <p className="text-sm text-muted-foreground">
          {t("consentIntro")}{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-primary underline underline-offset-4">
            {t("privacyLink")}
          </Link>
        </p>
        {/* Two separate, unticked consents (spec D13). */}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="consentRegistry"
            defaultChecked={state?.values?.consentRegistry === "on"}
            aria-invalid={Boolean(consentError)}
            aria-describedby={consentError ? "consentRegistry-error" : undefined}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>{tNotice("consentRegistry")}</span>
        </label>
        {consentError ? (
          <p id="consentRegistry-error" className="text-sm text-destructive">
            {fieldError(consentError)}
          </p>
        ) : null}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="consentContact"
            defaultChecked={state?.values?.consentContact === "on"}
            className="mt-0.5 size-4 shrink-0 accent-primary" />
          <span>{tNotice("consentContact")}</span>
        </label>
      </fieldset>

      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>{t("honeypot")}</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {throttled ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {t("throttled")}
        </p>
      ) : null}
      <FormAlert state={state} messages={{ INTERNAL: t("unavailable") }} />

      <SubmitButton size="lg" pendingLabel={t("submitting")}>
        {t("submit")}
      </SubmitButton>
    </form>
  );
}
