"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action-result";

type FormStateLike = (ActionResult<unknown> & { values?: Record<string, string> }) | null;

/** Field-level messages arrive as keys under "fieldErrors"; unknown keys fall back to "invalid". */
export function useFieldError() {
  const t = useTranslations("fieldErrors");
  return (key: string) => (t.has(key) ? t(key) : t("invalid"));
}

export function fieldErrorsOf(state: FormStateLike, name: string): string[] | undefined {
  return state && !state.ok ? state.fieldErrors?.[name] : undefined;
}

export function valueOf(state: FormStateLike, name: string, fallback = ""): string {
  return state?.values?.[name] ?? fallback;
}

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  errors?: string[];
  className?: string;
  children: (aria: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
};

/** Label + control + hint + error, wired with aria-describedby so errors are announced. */
export function Field({ id, label, hint, optional, errors, className, children }: FieldProps) {
  const t = useTranslations("common");
  const message = useFieldError();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground"> ({t("optional")})</span> : null}
      </Label>
      {children({ id, "aria-invalid": Boolean(errorId), "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errorId ? (
        <p id={errorId} className="text-sm text-destructive">
          {message(errors?.[0] ?? "invalid")}
        </p>
      ) : null}
    </div>
  );
}

/** Form-level outcome. Validation errors are shown per field, so only a summary appears here. */
export function FormAlert({ state, messages }: { state: FormStateLike; messages?: Partial<Record<string, string>> }) {
  const t = useTranslations("errors");
  if (!state || state.ok) return null;
  const text = messages?.[state.error] ?? t(state.error);
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {text}
    </p>
  );
}

export function SubmitButton({ children, pendingLabel, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
