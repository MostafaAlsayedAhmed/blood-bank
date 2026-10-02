"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FormAlert, SubmitButton } from "@/components/shared/form-kit";
import type { FormState } from "@/features/donors/actions";
import { cn } from "@/lib/utils";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  donorId: string;
  submitLabel: string;
  /** When set, the first click shows this consequence and asks for confirmation (spec §10). */
  confirmText?: string;
  variant?: ButtonProps["variant"];
  className?: string;
  children?: (state: FormState) => React.ReactNode;
};

/** A small Server Action form with inline errors and optional inline confirmation. */
export function ActionForm({ action, donorId, submitLabel, confirmText, variant, className, children }: Props) {
  const t = useTranslations("common");
  const [state, formAction] = useActionState<FormState, FormData>(action, null);
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={formAction} className={cn("flex flex-col gap-3", className)} onSubmit={() => setConfirming(false)}>
      <input type="hidden" name="donorId" value={donorId} />
      {children?.(state)}
      <FormAlert state={state} />
      {confirmText && !confirming ? (
        <Button variant={variant} onClick={() => setConfirming(true)} className="self-start">
          {submitLabel}
        </Button>
      ) : null}
      {confirmText && confirming ? (
        <div role="alertdialog" aria-label={submitLabel} className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm">{confirmText}</p>
          <div className="flex gap-2">
            <SubmitButton variant={variant ?? "destructive"} size="sm">
              {t("confirm")}
            </SubmitButton>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
      {!confirmText ? (
        <SubmitButton variant={variant} className="self-start" pendingLabel={t("saving")}>
          {submitLabel}
        </SubmitButton>
      ) : null}
    </form>
  );
}
